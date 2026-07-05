use serde::Serialize;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, TRUE};
use windows_sys::Win32::System::Console::{AttachConsole, FreeConsole, GenerateConsoleCtrlEvent, GetConsoleWindow, SetConsoleCtrlHandler, CTRL_C_EVENT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindow, GetWindowThreadProcessId, IsWindowVisible, PostMessageW, ShowWindow, GW_OWNER, SW_HIDE, WM_CLOSE,
};

const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// scrcpy/adb are fetched by the WinForms build's installer into this same
// location -- reused here rather than shipping/downloading a second copy.
fn install_dir() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
    Path::new(&base).join("DoppelCast").join("scrcpy")
}

pub fn adb_path() -> PathBuf {
    install_dir().join("adb.exe")
}

pub fn scrcpy_path() -> PathBuf {
    install_dir().join("scrcpy.exe")
}

#[derive(Serialize, Clone, Debug)]
pub struct DeviceInfo {
    pub serial: String,
    pub model: String,
    pub state: String,
    pub wireless: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct DeviceDetails {
    pub android_version: String,
    pub battery_percent: i32,
    pub charging: bool,
}

fn run_hidden(cmd: &mut Command) -> std::io::Result<std::process::Output> {
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output()
}

#[tauri::command]
pub fn list_devices() -> Result<Vec<DeviceInfo>, String> {
    let adb = adb_path();
    if !adb.exists() {
        return Ok(vec![]);
    }

    let output = run_hidden(Command::new(&adb).args(["devices", "-l"])).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);

    let mut devices = vec![];
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("List of devices") {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        let serial = parts[0].to_string();
        let state = parts[1].to_string();
        let model = parts
            .iter()
            .find_map(|p| p.strip_prefix("model:"))
            .unwrap_or("")
            .to_string();
        let wireless = serial.contains(':');
        devices.push(DeviceInfo { serial, model, state, wireless });
    }
    Ok(devices)
}

#[tauri::command]
pub fn get_device_details(serial: String) -> Result<DeviceDetails, String> {
    let adb = adb_path();
    if !adb.exists() {
        return Ok(DeviceDetails::default());
    }

    let version_out = run_hidden(Command::new(&adb).args(["-s", &serial, "shell", "getprop", "ro.build.version.release"]))
        .map_err(|e| e.to_string())?;
    let android_version = String::from_utf8_lossy(&version_out.stdout).trim().to_string();

    let battery_out = run_hidden(Command::new(&adb).args(["-s", &serial, "shell", "dumpsys", "battery"]))
        .map_err(|e| e.to_string())?;
    let battery_text = String::from_utf8_lossy(&battery_out.stdout);

    let mut battery_percent = -1;
    let mut charging = false;
    for line in battery_text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("level:") {
            battery_percent = rest.trim().parse().unwrap_or(-1);
        }
        if line.to_lowercase().contains("powered: true") {
            charging = true;
        }
    }

    Ok(DeviceDetails { android_version, battery_percent, charging })
}

// Plain Command::spawn -- not routed through the opener plugin's JS API,
// so there's no ACL permission to misconfigure. Same trusted pattern
// already used for adb/scrcpy everywhere else in this file.
#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Command::new("explorer.exe").arg(&path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn capture_screenshot(serial: String, folder: String) -> Result<String, String> {
    let adb = adb_path();
    if !adb.exists() {
        return Err("adb.exe not found".into());
    }
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    let device_path = "/sdcard/doppelcast_screenshot.png";
    let filename = format!("Screenshot_{}.png", chrono::Local::now().format("%Y-%m-%d_%H-%M-%S"));
    let local_path = Path::new(&folder).join(&filename);

    run_hidden(Command::new(&adb).args(["-s", &serial, "shell", "screencap", "-p", device_path])).map_err(|e| e.to_string())?;
    run_hidden(Command::new(&adb).args(["-s", &serial, "pull", device_path, local_path.to_str().unwrap()])).map_err(|e| e.to_string())?;
    run_hidden(Command::new(&adb).args(["-s", &serial, "shell", "rm", device_path])).map_err(|e| e.to_string())?;

    if !local_path.exists() {
        return Err("Screenshot capture failed -- no file was pulled from the device.".into());
    }
    Ok(local_path.to_string_lossy().to_string())
}

// Only one scrcpy session runs at a time. `windowed` records which stop
// strategy applies: a real (visible) mirror window can just be closed like
// clicking its X button, but headless (--no-playback) recording has no
// window at all, so the only way to signal it is a hidden console + Ctrl+C.
pub struct ScrcpySession {
    pub child: Child,
    pub windowed: bool,
}

pub struct ScrcpyState(pub Mutex<Option<ScrcpySession>>);

impl Default for ScrcpyState {
    fn default() -> Self {
        ScrcpyState(Mutex::new(None))
    }
}

#[tauri::command]
pub fn start_scrcpy(args: Vec<String>, state: tauri::State<'_, ScrcpyState>) -> Result<u32, String> {
    let scrcpy = scrcpy_path();
    if !scrcpy.exists() {
        return Err("scrcpy.exe not found".into());
    }

    let mut guard = state.0.lock().unwrap();
    if guard.is_some() {
        return Err("A recording is already running.".into());
    }

    // scrcpy fails outright if --record's parent folder doesn't exist yet
    // (freshly changed output folder, first run, etc.) -- create it here
    // rather than surfacing a cryptic "Failed to open output file" error.
    if let Some(record_arg) = args.iter().find(|a| a.starts_with("--record=")) {
        let path = &record_arg["--record=".len()..];
        if let Some(parent) = Path::new(path).parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let windowed = !args.iter().any(|a| a == "--no-playback");

    let child = if windowed {
        // A real mirror window exists -- no console needed at all, so
        // there's nothing to accidentally leave visible.
        Command::new(&scrcpy).args(&args).creation_flags(CREATE_NO_WINDOW).spawn().map_err(|e| e.to_string())?
    } else {
        // Headless: no window will ever exist, so a hidden console is the
        // only way a later stop can send a graceful Ctrl+C (killing the
        // process outright skips ffmpeg's trailer write and can leave an
        // unplayable mp4).
        let child = Command::new(&scrcpy).args(&args).creation_flags(CREATE_NEW_CONSOLE).spawn().map_err(|e| e.to_string())?;
        hide_console_window(child.id());
        child
    };

    let pid = child.id();
    *guard = Some(ScrcpySession { child, windowed });
    Ok(pid)
}

#[tauri::command]
pub fn stop_scrcpy(graceful: bool, state: tauri::State<'_, ScrcpyState>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    let Some(mut session) = guard.take() else { return Ok(()) };
    drop(guard);

    if !graceful {
        let _ = session.child.kill();
        return Ok(());
    }

    let pid = session.child.id();
    let mut signaled = false;
    if session.windowed {
        for _ in 0..30 {
            let hwnd = find_window_for_pid(pid);
            if !hwnd.is_null() {
                unsafe { PostMessageW(hwnd, WM_CLOSE, 0, 0) };
                signaled = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    } else {
        send_ctrl_c(pid);
        signaled = true;
    }

    if signaled {
        for _ in 0..50 {
            if let Ok(Some(_)) = session.child.try_wait() {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }
    // ponytail: scrcpy ignored the graceful signal (or its window never
    // appeared) -- force-stop as a last resort. The recording may be
    // missing its trailer/be unplayable in this fallback case.
    let _ = session.child.kill();
    Ok(())
}

#[tauri::command]
pub fn is_scrcpy_running(state: tauri::State<'_, ScrcpyState>) -> bool {
    state.0.lock().unwrap().is_some()
}

static FOUND_HWND: std::sync::atomic::AtomicIsize = std::sync::atomic::AtomicIsize::new(0);

unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let target_pid = lparam as u32;
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, &mut pid);
    // Visible, top-level (no owner), belonging to the target process --
    // scrcpy's real mirror window, not some other window it happens to own.
    if pid == target_pid && IsWindowVisible(hwnd) != 0 && GetWindow(hwnd, GW_OWNER).is_null() {
        FOUND_HWND.store(hwnd as isize, std::sync::atomic::Ordering::SeqCst);
        return 0; // stop enumeration
    }
    TRUE
}

fn find_window_for_pid(pid: u32) -> HWND {
    FOUND_HWND.store(0, std::sync::atomic::Ordering::SeqCst);
    unsafe {
        EnumWindows(Some(enum_windows_proc), pid as isize);
    }
    FOUND_HWND.load(std::sync::atomic::Ordering::SeqCst) as HWND
}

// AttachConsole(pid) makes GetConsoleWindow() resolve *the target process's*
// console (not ours) for as long as we stay attached -- this is the
// correct way to reach it, unlike searching top-level windows by PID: a
// spawned console's window is actually owned by a separate conhost.exe
// process, so matching against scrcpy's own PID never finds it.
fn hide_console_window(pid: u32) {
    unsafe {
        // 40 tries: AttachConsole can succeed before conhost has actually
        // created the window, in which case GetConsoleWindow briefly
        // returns null -- that must keep retrying, not be treated as done.
        for _ in 0..40 {
            FreeConsole();
            if AttachConsole(pid) != 0 {
                let hwnd = GetConsoleWindow();
                if !hwnd.is_null() {
                    ShowWindow(hwnd, SW_HIDE);
                    FreeConsole();
                    return;
                }
                FreeConsole();
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }
}

fn send_ctrl_c(pid: u32) {
    unsafe {
        FreeConsole();
        if AttachConsole(pid) == 0 {
            return;
        }
        SetConsoleCtrlHandler(None, TRUE); // ignore the signal in our own process
        GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0);
        FreeConsole();
        SetConsoleCtrlHandler(None, 0);
    }
}
