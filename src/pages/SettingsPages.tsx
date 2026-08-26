import { useEffect, useState, type ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import Toggle from "../components/Toggle";
import type { UserSettings } from "../types";
import type { BoundHotkeys } from "../api";
import { captureCombo, formatHotkey } from "../hotkeys";

interface Props {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-page">
      <div className="page-title">{title}</div>
      <div className="card">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

const RESOLUTIONS = [
  { label: "1920p", value: 1920 },
  { label: "1600p", value: 1600 },
  { label: "1280p", value: 1280 },
  { label: "No Limit", value: 0 },
];
const FPS_OPTIONS = [30, 60, 90, 120];

export function VideoSettingsPage({ settings, onChange }: Props) {
  return (
    <Page title="Video">
      <div className="field-row">
        <span className="field-label">Resolution</span>
        <div className="field-control">
          <select value={settings.resolution} onChange={(e) => onChange({ resolution: Number(e.target.value) })}>
            {RESOLUTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <span className="field-label">Frame Rate</span>
        <div className="field-control">
          <select value={settings.fps} onChange={(e) => onChange({ fps: Number(e.target.value) })}>
            {FPS_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f} FPS
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <span className="field-label">Bitrate</span>
        <div className="field-control">
          <input
            type="number"
            min={500}
            max={200000}
            step={500}
            value={settings.bitrateKbps}
            onChange={(e) => onChange({ bitrateKbps: Number(e.target.value) })}
            style={{ width: 160 }}
          />
        </div>
      </div>
      <div className="field-row">
        <span className="field-label">Video Codec</span>
        <div className="field-control">
          <select value={settings.videoCodec} onChange={(e) => onChange({ videoCodec: e.target.value as UserSettings["videoCodec"] })}>
            <option value="h264">h264</option>
            <option value="h265">h265</option>
            <option value="av1">av1</option>
          </select>
        </div>
      </div>
      <ToggleRow label="Show touches on screen" checked={settings.showTouches} onChange={(v) => onChange({ showTouches: v })} />
      <ToggleRow
        label="Show device mirror window while recording"
        checked={settings.showMirrorWindow}
        onChange={(v) => onChange({ showMirrorWindow: v })}
      />
      <div className="field-row">
        <span className="field-label">Renderer</span>
        <div className="field-control">
          <select
            value={settings.renderDriver}
            onChange={(e) => onChange({ renderDriver: e.target.value as UserSettings["renderDriver"] })}
            disabled={!settings.showMirrorWindow}
          >
            <option value="auto">Auto</option>
            <option value="direct3d">Direct3D</option>
            <option value="opengl">OpenGL</option>
            <option value="software">Software</option>
          </select>
        </div>
      </div>
    </Page>
  );
}

export function AudioSettingsPage({ settings, onChange }: Props) {
  return (
    <Page title="Audio">
      <ToggleRow label="Record audio" checked={settings.recordAudio} onChange={(v) => onChange({ recordAudio: v })} />
      <div className="field-row">
        <span className="field-label">Audio Codec</span>
        <div className="field-control">
          <select value={settings.audioCodec} onChange={(e) => onChange({ audioCodec: e.target.value as UserSettings["audioCodec"] })}>
            <option value="aac">aac</option>
            <option value="opus">opus</option>
            <option value="raw">raw</option>
          </select>
        </div>
      </div>
    </Page>
  );
}

function HotkeysSection({
  hotkeys,
  onRebind,
}: {
  hotkeys: BoundHotkeys;
  onRebind: (action: "record" | "screenshot", combo: string) => Promise<string | null>;
}) {
  const [listening, setListening] = useState<"record" | "screenshot" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Captures the *next* real key combo while `listening` is set -- a bare
  // modifier press doesn't count (captureCombo returns null for those), so
  // the listener just waits for the following keydown instead of resolving.
  useEffect(() => {
    if (!listening) return;
    const action = listening;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const combo = captureCombo(e);
      if (!combo) return;
      setListening(null);
      onRebind(action, combo).then(setError);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [listening, onRebind]);

  const row = (label: string, action: "record" | "screenshot", bound: string | null) => (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div className="field-control" style={{ alignItems: "center" }}>
        <span className="hotkey-combo">
          {listening === action ? "Press a key combo…" : bound ? formatHotkey(bound) : "unavailable"}
        </span>
        <button
          className="btn-browse"
          style={{ width: "auto", padding: "0 10px" }}
          onClick={() => {
            setError(null);
            setListening(listening === action ? null : action);
          }}
        >
          {listening === action ? "Cancel" : "Change"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">Hotkeys</div>
      {row("Start / stop recording", "record", hotkeys.record)}
      {row("Take a screenshot", "screenshot", hotkeys.screenshot)}
      {error && <p style={{ color: "var(--record-active)", fontSize: 13, marginTop: 4 }}>{error}</p>}
      <p style={{ color: "var(--text-muted)", marginTop: 16, marginBottom: 0 }}>
        These work system-wide, even when DoppelCast isn't focused. Click "Change" and press a key combo that
        includes at least one of Ctrl, Alt, Shift, or Win.
      </p>
    </div>
  );
}

export function GeneralSettingsPage({
  settings,
  onChange,
  onBrowseClick,
  hotkeys,
  onRebindHotkey,
}: Props & {
  onBrowseClick: () => void;
  hotkeys: BoundHotkeys;
  onRebindHotkey: (action: "record" | "screenshot", combo: string) => Promise<string | null>;
}) {
  return (
    <div className="settings-page">
      <div className="page-title">Settings</div>
      <div className="card">
        <div className="field-row">
          <span className="field-label">Save Location</span>
          <div className="field-control">
            <input type="text" value={settings.outputFolder} onChange={(e) => onChange({ outputFolder: e.target.value })} />
            <button className="btn-browse" title="Browse" onClick={onBrowseClick}>
              <FolderOpen size={11} />
            </button>
          </div>
        </div>
        <ToggleRow
          label="Turn device screen off while capturing"
          checked={settings.turnScreenOff}
          onChange={(v) => onChange({ turnScreenOff: v })}
        />
        <ToggleRow label="Keep device awake while connected" checked={settings.stayAwake} onChange={(v) => onChange({ stayAwake: v })} />
        <ToggleRow
          label="Borderless mirror window"
          checked={settings.borderlessWindow}
          onChange={(v) => onChange({ borderlessWindow: v })}
        />
      </div>
      <HotkeysSection hotkeys={hotkeys} onRebind={onRebindHotkey} />
    </div>
  );
}
