mod clips;
mod scrcpy;

use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Custom, user-rebindable hotkeys (see set_hotkey below) -- replaces the old
// fixed candidate-list auto-fallback now that the Hotkeys settings page lets
// people pick their own combo instead.
#[derive(Default)]
struct HotkeyBindings {
    record: Option<(Shortcut, String)>,
    screenshot: Option<(Shortcut, String)>,
}
type HotkeyState = Mutex<HotkeyBindings>;

#[derive(Clone, Serialize)]
struct ScrcpySetupResult {
    ok: bool,
    error: Option<String>,
}

// The background setup thread usually finishes (it's just fs::exists()
// checks once scrcpy's already installed) before the frontend's event
// listener has registered -- Tauri doesn't buffer events for late
// listeners, so a plain emit can fire into the void and the "Preparing..."
// screen waits forever. Caching the result here lets the frontend pull it
// directly to cover that race, alongside still listening for the event to
// cover a genuinely slow (first-run download) case.
type ScrcpyReadyState = Mutex<Option<ScrcpySetupResult>>;

#[tauri::command]
fn get_scrcpy_status(state: tauri::State<'_, ScrcpyReadyState>) -> Option<ScrcpySetupResult> {
    state.lock().unwrap().clone()
}

// Parses combos like "Ctrl+Alt+KeyR" (as built by the frontend from
// KeyboardEvent.code, which already matches Code's variant names) into a
// registerable Shortcut. ponytail: only Ctrl/Alt/Shift/Win modifiers and
// whatever Code::from_str covers (letters, digits, F-keys, ...) -- extend if
// a combo format outside that ever needs supporting.
fn parse_shortcut(combo: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = combo.split('+').collect();
    let (key_part, mod_parts) = parts.split_last().ok_or("empty hotkey")?;

    let mut mods = Modifiers::empty();
    for m in mod_parts {
        mods |= match *m {
            "Ctrl" => Modifiers::CONTROL,
            "Alt" => Modifiers::ALT,
            "Shift" => Modifiers::SHIFT,
            "Win" => Modifiers::SUPER,
            other => return Err(format!("unknown modifier: {other}")),
        };
    }
    if mods.is_empty() {
        return Err("hotkey needs at least one of Ctrl/Alt/Shift/Win".into());
    }

    let code: Code = key_part.parse().map_err(|_| format!("unknown key: {key_part}"))?;
    Ok(Shortcut::new(Some(mods), code))
}

#[tauri::command]
fn set_hotkey(app: AppHandle, action: String, combo: String) -> Result<String, String> {
    let shortcut = parse_shortcut(&combo)?;
    let shortcuts_api = app.global_shortcut();
    let state = app.state::<HotkeyState>();
    let mut bindings = state.lock().unwrap();

    let slot = match action.as_str() {
        "record" => &mut bindings.record,
        "screenshot" => &mut bindings.screenshot,
        other => return Err(format!("unknown hotkey action: {other}")),
    };

    if let Some((existing, _)) = slot.clone() {
        if existing == shortcut {
            return Ok(combo);
        }
    }

    // Register the new combo before dropping the old one -- if the new one
    // is taken (by this app's other action, or another program entirely),
    // this errors out and the previously-working hotkey stays bound instead
    // of leaving nothing registered.
    shortcuts_api
        .register(shortcut)
        .map_err(|e| format!("Could not bind {combo}: {e}"))?;
    if let Some((old, _)) = slot.take() {
        let _ = shortcuts_api.unregister(old);
    }
    *slot = Some((shortcut, combo.clone()));
    Ok(combo)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let bindings = app.state::<HotkeyState>();
                    let bindings = bindings.lock().unwrap();
                    if bindings.record.as_ref().is_some_and(|(s, _)| s == shortcut) {
                        let _ = app.emit("hotkey-toggle-record", ());
                    } else if bindings.screenshot.as_ref().is_some_and(|(s, _)| s == shortcut) {
                        let _ = app.emit("hotkey-screenshot", ());
                    }
                })
                .build(),
        )
        .manage(HotkeyState::default())
        .manage(ScrcpyReadyState::default())
        .setup(move |app| {
            // Downloading scrcpy (first run only) can take several seconds --
            // running it here on the setup thread would block the window's
            // message pump before the event loop even starts, so Windows
            // shows "(Not Responding)" right as a first-time user opens the
            // app. Do it on a background thread instead and let the frontend
            // show its own "preparing" state until this event fires.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let result = scrcpy::ensure_scrcpy_installed();
                scrcpy::kill_adb_server();
                let (ok, error) = match result {
                    Ok(()) => (true, None),
                    Err(e) => (false, Some(e)),
                };
                let payload = ScrcpySetupResult { ok, error };
                *handle.state::<ScrcpyReadyState>().lock().unwrap() = Some(payload.clone());
                let _ = handle.emit("scrcpy-setup-done", payload);
            });

            // Hotkeys themselves are bound by the frontend (via set_hotkey)
            // once it has loaded the user's saved combos -- nothing to
            // register here.
            Ok(())
        })
        .manage(scrcpy::ScrcpyState::default())
        .invoke_handler(tauri::generate_handler![
            set_hotkey,
            get_scrcpy_status,
            clips::list_clips,
            clips::list_screenshots,
            scrcpy::list_devices,
            scrcpy::list_mdns_devices,
            scrcpy::pair_wifi,
            scrcpy::connect_wifi,
            scrcpy::get_device_details,
            scrcpy::open_folder,
            scrcpy::capture_screenshot,
            scrcpy::start_scrcpy,
            scrcpy::stop_scrcpy,
            scrcpy::is_scrcpy_running,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
