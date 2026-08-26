import { useEffect, useState } from "react";
import { Home, Video, Volume2, Settings, Info, Smartphone, Usb, Wifi, Loader2 } from "lucide-react";
import type { PageId, DeviceInfo, ConnectionMode, UserSettings } from "../types";
import { connectWifi, pairWifi, listMdnsDevices, type MdnsDevice } from "../api";

const NAV_ITEMS: { id: PageId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "about", label: "About", icon: Info },
];

interface Props {
  active: PageId;
  onNavigate: (page: PageId) => void;
  device: DeviceInfo | null;
  mode: ConnectionMode;
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
}

// Shown only in Wi-Fi mode. Two separate flows:
// - Connect: the frequent path -- ip:port persisted in settings and
//   prefilled, since it changes often (new network, toggle, reboot) but
//   rarely changes *while the app is closed*, so last-used is a good guess.
// - Pair: a one-time trust setup (tucked behind a toggle since most people
//   only ever need it once) -- permanent once done, no ip:port persistence
//   needed since the pairing address/code are single-use anyway.
function WifiConnectPanel({ settings, onChange }: { settings: UserSettings; onChange: (patch: Partial<UserSettings>) => void }) {
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [showPair, setShowPair] = useState(false);
  const [pairAddress, setPairAddress] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairResult, setPairResult] = useState<string | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);

  // Live mDNS discovery -- whatever Wireless debugging devices are
  // currently broadcasting, split into already-trusted ("connect") and
  // showing-a-pairing-code ("pair"). Polled, since a device can start/stop
  // broadcasting at any time (toggling Wireless debugging, walking into
  // Wi-Fi range).
  const [mdnsDevices, setMdnsDevices] = useState<MdnsDevice[]>([]);
  useEffect(() => {
    const poll = () => listMdnsDevices().then(setMdnsDevices).catch(() => {});
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);
  const connectable = mdnsDevices.filter((d) => d.kind === "connect");
  const pairable = mdnsDevices.filter((d) => d.kind === "pair");

  const doConnect = async (ip: string, port: number) => {
    setConnecting(true);
    setConnectError(null);
    try {
      await connectWifi(ip, port);
      onChange({ wifiIp: ip, wifiPort: port });
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = () => {
    if (settings.wifiIp) doConnect(settings.wifiIp, settings.wifiPort);
  };

  const handlePair = async () => {
    if (!pairAddress || !pairCode) return;
    setPairing(true);
    setPairError(null);
    setPairResult(null);
    try {
      await pairWifi(pairAddress, pairCode);
      setPairResult("Paired -- this PC is now trusted, permanently.");
    } catch (err) {
      setPairError(err instanceof Error ? err.message : String(err));
    } finally {
      setPairing(false);
    }
  };

  return (
    <div className="wifi-panel">
      <div className="wifi-panel-label">Connect over Wi-Fi</div>
      {connectable.length > 0 && (
        <div className="wifi-mdns-list">
          {connectable.map((d) => (
            <button
              key={d.address}
              className="wifi-mdns-item"
              disabled={connecting}
              onClick={() => {
                const [ip, port] = d.address.split(":");
                doConnect(ip, Number(port));
              }}
            >
              {d.address}
            </button>
          ))}
        </div>
      )}
      <input type="text" value={settings.wifiIp} onChange={(e) => onChange({ wifiIp: e.target.value })} placeholder="IP address" />
      <input
        type="number"
        value={settings.wifiPort}
        onChange={(e) => onChange({ wifiPort: Number(e.target.value) })}
        placeholder="Port"
      />
      <button className="btn-update wifi-connect-btn" onClick={handleConnect} disabled={connecting || !settings.wifiIp}>
        {connecting ? <Loader2 className="spin-icon" size={12} /> : null}
        {connecting ? "Connecting…" : "Connect"}
      </button>
      {connectError && <p className="wifi-panel-error">{connectError}</p>}

      <button className="wifi-pair-toggle" onClick={() => setShowPair((v) => !v)}>
        {showPair ? "Hide pairing" : "First time? Pair a device"}
      </button>
      {showPair && (
        <div className="wifi-pair-section">
          <p className="wifi-panel-hint">
            Phone: Developer options → Wireless debugging → Pair device with pairing code. One-time -- this PC stays
            trusted afterwards.
          </p>
          {pairable.length > 0 && (
            <div className="wifi-mdns-list">
              {pairable.map((d) => (
                <button key={d.address} className="wifi-mdns-item" onClick={() => setPairAddress(d.address)}>
                  {d.address}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={pairAddress}
            onChange={(e) => setPairAddress(e.target.value)}
            placeholder="Pairing IP & port"
          />
          <input type="text" value={pairCode} onChange={(e) => setPairCode(e.target.value)} placeholder="6-digit code" maxLength={6} />
          <button className="btn-update wifi-connect-btn" onClick={handlePair} disabled={pairing || !pairAddress || !pairCode}>
            {pairing ? <Loader2 className="spin-icon" size={12} /> : null}
            {pairing ? "Pairing…" : "Pair"}
          </button>
          {pairResult && <p className="wifi-panel-success">{pairResult}</p>}
          {pairError && <p className="wifi-panel-error">{pairError}</p>}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ active, onNavigate, device, mode, settings, onSettingsChange }: Props) {
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

      {mode === "wifi" && <WifiConnectPanel settings={settings} onChange={onSettingsChange} />}

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
            {device?.wireless ? <Wifi size={10} /> : <Usb size={10} />}
            {device ? (device.wireless ? "Wi-Fi" : "USB") : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}
