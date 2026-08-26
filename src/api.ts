import { invoke } from "@tauri-apps/api/core";

export interface RawDevice {
  serial: string;
  model: string;
  state: string;
  wireless: boolean;
}

export interface DeviceDetails {
  android_version: string;
  battery_percent: number;
  charging: boolean;
}

export interface BoundHotkeys {
  record: string | null;
  screenshot: string | null;
}

export interface ScrcpySetupResult {
  ok: boolean;
  error: string | null;
}

export interface ClipInfo {
  name: string;
  path: string;
  modified_ms: number;
  size_bytes: number;
}

export interface MdnsDevice {
  kind: "connect" | "pair";
  address: string;
}

export const listDevices = () => invoke<RawDevice[]>("list_devices");
// adb's own mDNS auto-discovery -- every Wireless debugging device
// currently broadcasting, split into already-trusted ("connect") and
// showing-a-pairing-code ("pair").
export const listMdnsDevices = () => invoke<MdnsDevice[]>("list_mdns_devices");
// One-time trust setup (Android 11+ Wireless debugging pairing code) --
// `address`/`code` come off the phone's pairing screen. Permanent once done.
export const pairWifi = (address: string, code: string) => invoke<string>("pair_wifi", { address, code });
// The frequent path: plain `adb connect ip:port`, works once paired.
export const connectWifi = (ip: string, port: number) => invoke<string>("connect_wifi", { ip, port });
export const listClips = (folder: string) => invoke<ClipInfo[]>("list_clips", { folder });
// Registers `combo` (e.g. "Ctrl+Alt+KeyR") as the global hotkey for `action`,
// unregistering whatever was bound before. Rejects if the combo is invalid
// or already claimed (by this app's other hotkey, or another program).
export const setHotkey = (action: "record" | "screenshot", combo: string) =>
  invoke<string>("set_hotkey", { action, combo });
// Cached result of the background scrcpy/adb install check -- null until
// it's actually finished. Lets the frontend pull the outcome directly
// instead of relying solely on catching the one-shot "scrcpy-setup-done"
// event, which can fire before a listener's registered.
export const getScrcpyStatus = () => invoke<ScrcpySetupResult | null>("get_scrcpy_status");
export const getDeviceDetails = (serial: string) => invoke<DeviceDetails>("get_device_details", { serial });
export const openFolder = (path: string) => invoke<void>("open_folder", { path });
export const captureScreenshot = (serial: string, folder: string) =>
  invoke<string>("capture_screenshot", { serial, folder });
export const startScrcpy = (args: string[]) => invoke<number>("start_scrcpy", { args });
export const stopScrcpy = (graceful: boolean) => invoke<void>("stop_scrcpy", { graceful });
export const isScrcpyRunning = () => invoke<boolean>("is_scrcpy_running");
