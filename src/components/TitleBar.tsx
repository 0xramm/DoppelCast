import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings, Minus, Square, X } from "lucide-react";
import logoIcon from "../assets/logo-icon.png";

const win = getCurrentWindow();

export default function TitleBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src={logoIcon} alt="" className="logo-mark" />
        <div className="titlebar-text">
          <div className="title">DoppelCast</div>
          <div className="subtitle">Android Screen Recorder</div>
        </div>
      </div>
      <div className="titlebar-controls">
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
