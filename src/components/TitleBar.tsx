import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bell, Settings, Minus, Square, X, Usb, Wifi } from "lucide-react";
import logoIcon from "../assets/logo-icon.png";
import type { ConnectionMode } from "../types";

const win = getCurrentWindow();

interface Props {
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  updateAvailable: boolean;
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
}

export default function TitleBar({ onOpenSettings, onOpenAbout, updateAvailable, mode, onModeChange }: Props) {
  return (
    <div className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src={logoIcon} alt="" className="logo-mark" />
        <div className="titlebar-text">
          <div className="title">DoppelCast</div>
          <div className="subtitle">Android Gameplay Recorder</div>
        </div>
      </div>
      <div className="titlebar-controls">
        <div className="mode-switch" title="Switch between USB and Wi-Fi mode">
          <button className={mode === "usb" ? "active" : ""} onClick={() => onModeChange("usb")} title="USB">
            <Usb size={12} />
          </button>
          <button className={mode === "wifi" ? "active" : ""} onClick={() => onModeChange("wifi")} title="Wi-Fi">
            <Wifi size={12} />
          </button>
        </div>
        {updateAvailable && (
          <button className="titlebar-btn" onClick={onOpenAbout} title="Update available">
            <Bell size={13} />
            <span className="update-dot" />
          </button>
        )}
        <button className="titlebar-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={13} />
        </button>
        <button className="titlebar-btn" onClick={() => win.minimize()} title="Minimize">
          <Minus size={13} />
        </button>
        <button className="titlebar-btn" onClick={() => win.toggleMaximize()} title="Maximize">
          <Square size={11} />
        </button>
        <button className="titlebar-btn close" onClick={() => win.close()} title="Close">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
