mod scrcpy;

use serde::Serialize;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Clone, Serialize, Default)]
pub struct BoundHotkeys {
    pub record: Option<String>,
    pub screenshot: Option<String>,
}

#[tauri::command]
fn get_hotkeys(state: tauri::State<'_, BoundHotkeys>) -> BoundHotkeys {
    state.inner().clone()
}

// Tries each candidate in order and registers the first one Windows will
// actually grant -- Ctrl+Alt+R alone turned out to already be claimed by
// something else on at least one real machine, and there's no way to know
// what's free ahead of time, so the app needs to just try and fall back.
fn register_first_available(
    shortcuts_api: &tauri_plugin_global_shortcut::GlobalShortcut<tauri::Wry>,
    candidates: &[(Shortcut, &str)],
) -> Option<String> {
    for (shortcut, label) in candidates {
        if shortcuts_api.register(*shortcut).is_ok() {
            return Some(label.to_string());
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let record_candidates = [
        (Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyR), "Ctrl+Alt+R"),
        (Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT), Code::KeyR), "Ctrl+Alt+Shift+R"),
        (Shortcut::new(Some(Modifiers::SUPER | Modifiers::ALT), Code::KeyR), "Win+Alt+R"),
    ];
    let screenshot_candidates = [
        (Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyS), "Ctrl+Alt+S"),
        (Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT), Code::KeyS), "Ctrl+Alt+Shift+S"),
        (Shortcut::new(Some(Modifiers::SUPER | Modifiers::ALT), Code::KeyS), "Win+Alt+S"),
    ];

    // Only ever one shortcut per action actually gets registered (the loop
    // above stops at the first success), so the handler just needs to know
    // which *group* a firing shortcut belongs to, not exactly which one.
    let record_shortcuts: Vec<Shortcut> = record_candidates.iter().map(|(s, _)| *s).collect();
    let screenshot_shortcuts: Vec<Shortcut> = screenshot_candidates.iter().map(|(s, _)| *s).collect();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    if record_shortcuts.contains(shortcut) {
                        let _ = app.emit("hotkey-toggle-record", ());
                    } else if screenshot_shortcuts.contains(shortcut) {
                        let _ = app.emit("hotkey-screenshot", ());
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let shortcuts_api = app.global_shortcut();

            let record = register_first_available(&shortcuts_api, &record_candidates);
            if record.is_none() {
                eprintln!("Could not register any record-toggle hotkey candidate");
            }
            let screenshot = register_first_available(&shortcuts_api, &screenshot_candidates);
            if screenshot.is_none() {
                eprintln!("Could not register any screenshot hotkey candidate");
            }

            app.manage(BoundHotkeys { record, screenshot });
            Ok(())
        })
        .manage(scrcpy::ScrcpyState::default())
        .invoke_handler(tauri::generate_handler![
            get_hotkeys,
            scrcpy::list_devices,
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
