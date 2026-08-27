import { useEffect, useState } from "react";
import { Square, Camera as CameraIcon, FolderSearch, Play, Eye } from "lucide-react";
import type { DeviceInfo, SessionState } from "../types";
import { listClips, listScreenshots, type BoundHotkeys, type ClipInfo } from "../api";
import { formatHotkey } from "../hotkeys";
import { openClipPlayer, openImageViewer } from "../player";

interface Props {
  device: DeviceInfo | null;
  outputFolder: string;
  sessionState: SessionState;
  elapsed: string;
  hotkeys: BoundHotkeys;
  onRecordClick: () => void;
  onStopClick: () => void;
  onScreenshotClick: () => void;
  onOpenFolderClick: () => void;
  onTogglePreview: () => void;
}

type MediaTab = "clips" | "shots";

function formatMeta(item: ClipInfo) {
  const date = new Date(item.modified_ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const mb = (item.size_bytes / (1024 * 1024)).toFixed(1);
  return `${date} · ${mb} MB`;
}

export default function HomePage({
  device,
  outputFolder,
  sessionState,
  elapsed,
  hotkeys,
  onRecordClick,
  onStopClick,
  onScreenshotClick,
  onOpenFolderClick,
  onTogglePreview,
}: Props) {
  const previewing = sessionState === "previewing";
  const statusText =
    sessionState === "recording"
      ? "Recording..."
      : sessionState === "previewing"
        ? "Previewing (not recorded)"
        : device
          ? "Ready to record"
          : "No device connected";
  const recordHint = hotkeys.record ? formatHotkey(hotkeys.record) : "no hotkey available";
  const screenshotHint = hotkeys.screenshot ? formatHotkey(hotkeys.screenshot) : "no hotkey available";

  const [tab, setTab] = useState<MediaTab>("clips");
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [shots, setShots] = useState<ClipInfo[]>([]);
  // Re-lists whenever the folder changes or a recording/screenshot just
  // happened -- the folder itself is the source of truth, no separate
  // index to keep in sync.
  useEffect(() => {
    listClips(outputFolder)
      .then(setClips)
      .catch(() => setClips([]));
    listScreenshots(`${outputFolder}\\Screenshots`)
      .then(setShots)
      .catch(() => setShots([]));
  }, [outputFolder, sessionState]);

  const items = tab === "clips" ? clips : shots;

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
                  disabled={!device || sessionState !== "idle"}
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
            <button
              className="quick-action-btn"
              disabled={!device || (sessionState !== "idle" && !previewing)}
              onClick={onTogglePreview}
            >
              <span className="icon-circle">{previewing ? <Square size={14} /> : <Play size={14} />}</span>
              <span className="label">{previewing ? "Stop" : "Preview"}</span>
              <span className="hint">&nbsp;</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="media-tabs">
          <button className={`media-tab${tab === "clips" ? " active" : ""}`} onClick={() => setTab("clips")}>
            Clips
          </button>
          <button className={`media-tab${tab === "shots" ? " active" : ""}`} onClick={() => setTab("shots")}>
            Shots
          </button>
        </div>
        <div className="clips-list">
          {items.length === 0 && <div className="clips-empty">{tab === "clips" ? "No recordings yet" : "No screenshots yet"}</div>}
          {items.map((item) => (
            <div className="clip-row" key={item.path}>
              <div className="clip-info">
                <span className="clip-name">{item.name}</span>
                <span className="clip-meta">{formatMeta(item)}</span>
              </div>
              <button
                className="btn-browse"
                title={tab === "clips" ? "Play" : "View"}
                onClick={() => (tab === "clips" ? openClipPlayer(item.path, item.name) : openImageViewer(item.path, item.name))}
              >
                {tab === "clips" ? <Play size={11} /> : <Eye size={11} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
