import { Wifi, Usb, Play, Square } from "lucide-react";
import type { DeviceInfo, SessionState } from "../types";
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
  sessionState,
  onTogglePreview,
}: {
  device: DeviceInfo | null;
  hotkeys: BoundHotkeys;
  version: string;
  hasScanned: boolean;
  deviceCount: number;
  sessionState: SessionState;
  onTogglePreview: () => void;
}) {
  const previewing = sessionState === "previewing";
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
        <button
          onClick={onTogglePreview}
          disabled={!device || (sessionState !== "idle" && !previewing)}
          title={previewing ? "Stop preview" : "Preview (live mirror, not recorded)"}
        >
          {previewing ? <Square size={10} /> : <Play size={10} />}
          {previewing ? "Stop" : "Preview"}
        </button>
        <span>
          {hotkeys.record ? formatHotkey(hotkeys.record) : "--"} · {hotkeys.screenshot ? formatHotkey(hotkeys.screenshot) : "--"}
        </span>
      </div>
    </div>
  );
}
