import type { ReactNode } from "react";
import Toggle from "../components/Toggle";
import type { UserSettings } from "../types";
import type { BoundHotkeys } from "../api";

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

export function VideoSettingsPage({ settings, onChange }: Props) {
  return (
    <Page title="Video">
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

// Android-side capture behavior -- these all map to real scrcpy flags.
export function CaptureSettingsPage({ settings, onChange }: Props) {
  return (
    <Page title="Capture">
      <ToggleRow
        label="Turn device screen off while capturing"
        checked={settings.turnScreenOff}
        onChange={(v) => onChange({ turnScreenOff: v })}
      />
      <ToggleRow label="Keep device awake while connected" checked={settings.stayAwake} onChange={(v) => onChange({ stayAwake: v })} />
    </Page>
  );
}

export function GeneralSettingsPage() {
  return (
    <Page title="Settings">
      <p style={{ color: "var(--text-muted)", margin: 0 }}>More app-wide preferences are coming in a future update.</p>
    </Page>
  );
}

export function HotkeysSettingsPage({ hotkeys }: { hotkeys: BoundHotkeys }) {
  return (
    <Page title="Hotkeys">
      <div className="hotkey-row">
        <span>Start / stop recording</span>
        <span className="hotkey-combo">{hotkeys.record ?? "unavailable"}</span>
      </div>
      <div className="hotkey-row">
        <span>Take a screenshot</span>
        <span className="hotkey-combo">{hotkeys.screenshot ?? "unavailable"}</span>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 16, marginBottom: 0 }}>
        These work system-wide, even when DoppelCast isn't focused. If a combo shows "unavailable", something else on
        your PC already claimed every candidate. Custom hotkey rebinding is coming in a future update.
      </p>
    </Page>
  );
}
