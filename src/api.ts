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

export const listDevices = () => invoke<RawDevice[]>("list_devices");
export const getHotkeys = () => invoke<BoundHotkeys>("get_hotkeys");
export const getDeviceDetails = (serial: string) => invoke<DeviceDetails>("get_device_details", { serial });
export const openFolder = (path: string) => invoke<void>("open_folder", { path });
export const captureScreenshot = (serial: string, folder: string) =>
  invoke<string>("capture_screenshot", { serial, folder });
export const startScrcpy = (args: string[]) => invoke<number>("start_scrcpy", { args });
export const stopScrcpy = (graceful: boolean) => invoke<void>("stop_scrcpy", { graceful });
export const isScrcpyRunning = () => invoke<boolean>("is_scrcpy_running");
