import { Wifi, Usb } from "lucide-react";
import type { DeviceInfo } from "../types";
import type { BoundHotkeys } from "../api";
import { formatHotkey } from "../hotkeys";

function deviceStatusText(device: DeviceInfo | null, hasScanned: boolean, deviceCount: number) {
  if (device) return `● Connected via ${device.wireless ? "Wi-Fi" : "USB"}: ${device.model}`;
  if (!hasScanned) return "Searching for devices…";
  return deviceCount === 0 ? "○ 0 devices found" : `○ ${deviceCount} device${deviceCount === 1 ? "" : "s"} found`;
}

export default function StatusBar({
  device,
  hotkeys,
  version,
  hasScanned,
  deviceCount,
}: {
  device: DeviceInfo | null;
  hotkeys: BoundHotkeys;
  version: string;
  hasScanned: boolean;
  deviceCount: number;
}) {
  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span>DoppelCast{version ? ` v${version}` : ""}</span>
        <span className="statusbar-device">
          {device ? device.wireless ? <Wifi size={10} /> : <Usb size={10} /> : null}
          {deviceStatusText(device, hasScanned, deviceCount)}
        </span>
      </div>
      <div className="statusbar-right">
        <span>
          {hotkeys.record ? formatHotkey(hotkeys.record) : "--"} · {hotkeys.screenshot ? formatHotkey(hotkeys.screenshot) : "--"}
        </span>
      </div>
    </div>
  );
}
