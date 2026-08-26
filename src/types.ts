export type PageId = "home" | "video" | "audio" | "settings" | "about";

// Which of the (possibly several -- adb can see a phone twice, once per
// transport) matching devices the app prefers when picking the active one.
export type ConnectionMode = "usb" | "wifi";

export interface DeviceInfo {
  model: string;
  serial: string;
  androidVersion: string;
  wireless: boolean;
  batteryPercent: number;
  charging: boolean;
}

// No live-preview state anymore -- an embedded native scrcpy window inside
// the webview isn't reliably achievable, and going fully headless
// (--no-playback) sidesteps the problem instead of fighting it.
export type SessionState = "idle" | "recording";

export interface UserSettings {
  outputFolder: string;
  resolution: number; // long-edge px, 0 = no limit
  fps: number;
  bitrateKbps: number; // OBS-style Kbps, e.g. 8000
  videoCodec: "h264" | "h265" | "av1";
  // scrcpy's SDL render driver for the (optional) mirror window -- has no
  // effect when showMirrorWindow is off (headless recording).
  renderDriver: "auto" | "direct3d" | "opengl" | "software";
  audioCodec: "aac" | "opus" | "raw";
  recordAudio: boolean;
  showTouches: boolean;
  turnScreenOff: boolean;
  stayAwake: boolean;
  // Shows scrcpy's own (separate, non-embedded) window while recording.
  // On by default -- most people recording gameplay want to see what
  // they're capturing.
  showMirrorWindow: boolean;
  // scrcpy's --window-borderless -- only takes effect when showMirrorWindow
  // is on.
  borderlessWindow: boolean;
  // Global hotkey combos, e.g. "Ctrl+Alt+KeyR" -- Ctrl/Alt/Shift/Win
  // modifiers plus a KeyboardEvent.code name (matches Rust's Code::from_str
  // 1:1, see hotkeys.ts).
  hotkeyRecord: string;
  hotkeyScreenshot: string;
  // Wireless-connect state -- the ip:port a phone's Wireless debugging
  // screen shows changes often (new network, toggle, reboot), so this is
  // just the last-used values prefilled for convenience, not a fixed target.
  connectionMode: ConnectionMode;
  wifiIp: string;
  wifiPort: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  outputFolder: "D:\\DoppelCast\\Videos",
  resolution: 1920,
  fps: 60,
  bitrateKbps: 8000,
  videoCodec: "h264",
  renderDriver: "auto",
  audioCodec: "aac",
  recordAudio: true,
  showTouches: false,
  turnScreenOff: false,
  stayAwake: true,
  showMirrorWindow: true,
  borderlessWindow: false,
  hotkeyRecord: "Ctrl+Alt+KeyR",
  hotkeyScreenshot: "Ctrl+Alt+KeyS",
  connectionMode: "usb",
  wifiIp: "",
  wifiPort: 5555,
};
