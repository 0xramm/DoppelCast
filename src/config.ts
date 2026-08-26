import { DEFAULT_SETTINGS, type UserSettings } from "./types";

// ponytail: localStorage on the webview's own origin (tauri://localhost)
// persists across app restarts already -- no need for a Rust-side config
// file/plugin just to remember resolution/fps/save-folder etc. Swap for a
// JSON file in the app-data dir if this ever needs to be human-editable or
// shared outside the app.
const STORAGE_KEY = "doppelcast-settings";

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // best-effort -- a full/blocked storage just means settings reset next launch
  }
}
