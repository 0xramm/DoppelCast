import { FolderOpen } from "lucide-react";
import type { DeviceInfo } from "../types";
import type { BoundHotkeys } from "../api";

function deviceStatusText(device: DeviceInfo | null, hasScanned: boolean, deviceCount: number) {
  if (device) return `● Connected: ${device.model}`;
  if (!hasScanned) return "Searching for devices…";
  return deviceCount === 0 ? "○ 0 devices found" : `○ ${deviceCount} device${deviceCount === 1 ? "" : "s"} found`;
}

export default function StatusBar({
  device,
  hotkeys,
  onOpenFolder,
  version,
  hasScanned,
  deviceCount,
}: {
  device: DeviceInfo | null;
  hotkeys: BoundHotkeys;
  onOpenFolder: () => void;
  version: string;
  hasScanned: boolean;
  deviceCount: number;
}) {
  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span>DoppelCast{version ? ` v${version}` : ""}</span>
        <span>{deviceStatusText(device, hasScanned, deviceCount)}</span>
      </div>
      <div className="statusbar-right">
        <button onClick={onOpenFolder}>
          <FolderOpen size={10} /> Open Folder
        </button>
        <span>
          {hotkeys.record ?? "--"} · {hotkeys.screenshot ?? "--"}
        </span>
      </div>
    </div>
  );
}
