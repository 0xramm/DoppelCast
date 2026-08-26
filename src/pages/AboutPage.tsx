import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import type { Update } from "@tauri-apps/plugin-updater";
import { installUpdate } from "../update";

export default function AboutPage({ version, update }: { version: string; update: Update | null }) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (!update) return;
    setInstalling(true);
    setError(null);
    try {
      await installUpdate(update);
      // installUpdate relaunches the app on success -- nothing left to do here.
    } catch (err) {
      setInstalling(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="about-page">
      <div className="page-title">DoppelCast</div>
      <p style={{ color: "var(--text-secondary)" }}>App version {version}</p>
      {update ? (
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <p style={{ margin: "0 0 8px", color: "var(--text-primary)", fontWeight: 600 }}>
            Update available: v{update.version}
          </p>
          <button className="btn-update" disabled={installing} onClick={handleUpdate}>
            {installing ? <Loader2 className="spin-icon" size={13} /> : <Download size={13} />}
            {installing ? "Installing…" : "Update Now"}
          </button>
          {error && <p style={{ color: "var(--record-active)", fontSize: 13, marginTop: 6 }}>Update failed: {error}</p>}
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>You're on the latest version.</p>
      )}
      <p style={{ color: "var(--text-secondary)" }}>Android gameplay recorder.</p>
      <p style={{ color: "var(--text-secondary)" }}>
        Developed by <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>0xramm</span>
      </p>
      <a href="https://github.com/0xramm/DoppelCast" target="_blank" rel="noreferrer">
        github.com/0xramm/DoppelCast
      </a>
      <p style={{ color: "var(--text-muted)", fontSize: 11 }}>Issues and contributions welcome on the repo above.</p>
    </div>
  );
}
