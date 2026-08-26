export type PageId = "home" | "video" | "audio" | "capture" | "settings" | "hotkeys" | "about";

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
  bitrateMbps: number;
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
}

export const DEFAULT_SETTINGS: UserSettings = {
  outputFolder: "D:\\DoppelCast\\Videos",
  resolution: 1920,
  fps: 60,
  bitrateMbps: 80,
  videoCodec: "h264",
  renderDriver: "auto",
  audioCodec: "aac",
  recordAudio: true,
  showTouches: false,
  turnScreenOff: false,
  stayAwake: true,
  showMirrorWindow: true,
};
