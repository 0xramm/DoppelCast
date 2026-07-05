import { Square, Camera as CameraIcon, FolderOpen, FolderSearch } from "lucide-react";
import type { DeviceInfo, SessionState, UserSettings } from "../types";
import type { BoundHotkeys } from "../api";

interface Props {
  device: DeviceInfo | null;
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
  sessionState: SessionState;
  elapsed: string;
  hotkeys: BoundHotkeys;
  onRecordClick: () => void;
  onStopClick: () => void;
  onScreenshotClick: () => void;
  onBrowseClick: () => void;
  onOpenFolderClick: () => void;
}

const RESOLUTIONS = [
  { label: "1920p", value: 1920 },
  { label: "1600p", value: 1600 },
  { label: "1280p", value: 1280 },
  { label: "No Limit", value: 0 },
];
const FPS_OPTIONS = [30, 60, 90, 120];
const QUALITY = [
  { label: "Low", bitrate: 15 },
  { label: "Medium", bitrate: 40 },
  { label: "High", bitrate: 80 },
  { label: "Ultra", bitrate: 150 },
];

export default function HomePage({
  device,
  settings,
  onSettingsChange,
  sessionState,
  elapsed,
  hotkeys,
  onRecordClick,
  onStopClick,
  onScreenshotClick,
  onBrowseClick,
  onOpenFolderClick,
}: Props) {
  const statusText =
    sessionState === "recording" ? "Recording..." : device ? "Ready to record" : "No device connected";
  const qualityLabel = QUALITY.find((q) => q.bitrate === settings.bitrateMbps)?.label ?? "High";
  const recordHint = hotkeys.record ?? "no hotkey available";
  const screenshotHint = hotkeys.screenshot ?? "no hotkey available";

  return (
    <div className="home-page">
      <div className="home-top-row">
        <div className="card">
          <div className="card-header">Record</div>
          <div className="record-card-body">
            <div className="record-left">
              <div className="record-buttons">
                <button
                  className={`btn-rec${sessionState === "recording" ? " recording" : ""}`}
                  disabled={!device || sessionState === "recording"}
                  onClick={onRecordClick}
                  title={`Start recording (${recordHint})`}
                >
                  REC
                </button>
                <button
                  className="btn-icon-square"
                  disabled={sessionState !== "recording"}
                  onClick={onStopClick}
                  title={`Stop recording (${recordHint})`}
                >
                  <Square size={13} />
                </button>
              </div>
              <div className="record-timer">{elapsed}</div>
              <div className="record-status-text">{statusText}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Quick Actions</div>
          <div className="quick-actions-grid">
            <button className="quick-action-btn" disabled={!device} onClick={onScreenshotClick}>
              <span className="icon-circle">
                <CameraIcon size={14} />
              </span>
              <span className="label">Screenshot</span>
              <span className="hint">{screenshotHint}</span>
            </button>
            <button className="quick-action-btn" onClick={onOpenFolderClick}>
              <span className="icon-circle">
                <FolderSearch size={14} />
              </span>
              <span className="label">Open Folder</span>
              <span className="hint">&nbsp;</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Settings</div>
        <div className="settings-bar-row">
          <div className="settings-bar-item">
            <span className="settings-bar-label">Resolution</span>
            <select value={settings.resolution} onChange={(e) => onSettingsChange({ resolution: Number(e.target.value) })}>
              {RESOLUTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-bar-item">
            <span className="settings-bar-label">Frame Rate</span>
            <select value={settings.fps} onChange={(e) => onSettingsChange({ fps: Number(e.target.value) })}>
              {FPS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f} FPS
                </option>
              ))}
            </select>
          </div>
          <div className="settings-bar-item">
            <span className="settings-bar-label">Quality</span>
            <select
              value={qualityLabel}
              onChange={(e) => {
                const q = QUALITY.find((q) => q.label === e.target.value)!;
                onSettingsChange({ bitrateMbps: q.bitrate });
              }}
            >
              {QUALITY.map((q) => (
                <option key={q.label} value={q.label}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-bar-item">
            <span className="settings-bar-label">Save Location</span>
            <div className="save-location-row">
              <input type="text" value={settings.outputFolder} onChange={(e) => onSettingsChange({ outputFolder: e.target.value })} />
              <button className="btn-browse" title="Browse" onClick={onBrowseClick}>
                <FolderOpen size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
