import { Home, Video, Volume2, Camera, Settings, Keyboard, Info, Smartphone, Usb } from "lucide-react";
import type { PageId, DeviceInfo } from "../types";

const NAV_ITEMS: { id: PageId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "capture", label: "Capture", icon: Camera },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "hotkeys", label: "Hotkeys", icon: Keyboard },
  { id: "about", label: "About", icon: Info },
];

interface Props {
  active: PageId;
  onNavigate: (page: PageId) => void;
  device: DeviceInfo | null;
}

export default function Sidebar({ active, onNavigate, device }: Props) {
  return (
    <div className="sidebar">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`nav-button${active === item.id ? " active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={14} />
            {item.label}
          </button>
        );
      })}

      <div className="sidebar-spacer" />

      <div className="device-status-card">
        <div className="device-status-row">
          <span className={`status-dot${device ? " connected" : ""}`} />
          <span className="device-status-name">{device ? device.model : "No device"}</span>
        </div>
        <div className="device-status-meta">
          <span>
            <Smartphone size={10} />
            {device ? `Android ${device.androidVersion}` : "--"}
          </span>
          <span>
            <Usb size={10} />
            {device ? (device.wireless ? "Wi-Fi" : "USB") : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}
