import { FolderOpen } from "lucide-react";
import type { DeviceInfo } from "../types";
import type { BoundHotkeys } from "../api";

export default function StatusBar({
  device,
  hotkeys,
  onOpenFolder,
}: {
  device: DeviceInfo | null;
  hotkeys: BoundHotkeys;
  onOpenFolder: () => void;
}) {
  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span>DoppelCast v1.0.0</span>
        <span>{device ? `● Connected: ${device.model}` : "○ No device connected"}</span>
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
