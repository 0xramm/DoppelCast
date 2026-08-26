import { useEffect, useState } from "react";
import { Square, Camera as CameraIcon, FolderSearch, Play } from "lucide-react";
import type { DeviceInfo, SessionState } from "../types";
import { listClips, type BoundHotkeys, type ClipInfo } from "../api";
import { formatHotkey } from "../hotkeys";
import { openClipPlayer } from "../player";

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
}

function formatClipMeta(clip: ClipInfo) {
  const date = new Date(clip.modified_ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const mb = (clip.size_bytes / (1024 * 1024)).toFixed(1);
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
}: Props) {
  const statusText =
    sessionState === "recording" ? "Recording..." : device ? "Ready to record" : "No device connected";
  const recordHint = hotkeys.record ? formatHotkey(hotkeys.record) : "no hotkey available";
  const screenshotHint = hotkeys.screenshot ? formatHotkey(hotkeys.screenshot) : "no hotkey available";

  const [clips, setClips] = useState<ClipInfo[]>([]);
  // Re-lists whenever the folder changes or a recording just finished --
  // the folder itself is the source of truth, no separate clip index to keep in sync.
  useEffect(() => {
    listClips(outputFolder)
      .then(setClips)
      .catch(() => setClips([]));
  }, [outputFolder, sessionState]);

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
        <div className="card-header">Recent Clips</div>
        <div className="clips-list">
          {clips.length === 0 && <div className="clips-empty">No recordings yet</div>}
          {clips.map((clip) => (
            <div className="clip-row" key={clip.path}>
              <div className="clip-info">
                <span className="clip-name">{clip.name}</span>
                <span className="clip-meta">{formatClipMeta(clip)}</span>
              </div>
              <button className="btn-browse" title="Play" onClick={() => openClipPlayer(clip.path, clip.name)}>
                <Play size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
