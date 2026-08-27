import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { Loader2 } from "lucide-react";
import "./theme.css";
import "./App.css";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import {
  VideoSettingsPage,
  AudioSettingsPage,
  GeneralSettingsPage,
} from "./pages/SettingsPages";
import type { ConnectionMode, DeviceInfo, PageId, SessionState, UserSettings } from "./types";
import {
  listDevices,
  getDeviceDetails,
  openFolder,
  captureScreenshot,
  startScrcpy,
  stopScrcpy,
  isScrcpyRunning,
  setHotkey,
  getScrcpyStatus,
  connectWifi,
  listMdnsDevices,
  type BoundHotkeys,
  type ScrcpySetupResult,
} from "./api";
import { buildScrcpyArgs, buildPreviewArgs, generateFilename } from "./scrcpyArgs";
import { loadSettings, saveSettings } from "./config";
import { checkForUpdate } from "./update";
import type { Update } from "@tauri-apps/plugin-updater";

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [page, setPage] = useState<PageId>("home");
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [update, setUpdate] = useState<Update | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hotkeys, setHotkeys] = useState<BoundHotkeys>({ record: null, screenshot: null });
  const [version, setVersion] = useState("");
  // hasScanned distinguishes "haven't checked yet" (Searching...) from
  // "checked and found nothing" (0 devices found) in the footer.
  const [hasScanned, setHasScanned] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  // Rust fetches scrcpy/adb in the background on first run -- stay on a
  // loading screen until it reports done, instead of showing the normal
  // (misleadingly idle-looking) UI while a multi-second download is in
  // flight behind the scenes.
  const [ready, setReady] = useState(false);

  // Latest values for use inside the polling interval / hotkey listener
  // closures, which are only set up once (see the [] dependency arrays).
  const stateRef = useRef({ device, settings, sessionState });
  stateRef.current = { device, settings, sessionState };
  const startRef = useRef(0);

  useEffect(() => {
    if (sessionState !== "recording") return;
    startRef.current = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, [sessionState]);

  const patchSettings = (patch: Partial<UserSettings>) => setSettings((s) => ({ ...s, ...patch }));
  // Persisted like any other setting -- the switch position and last
  // wireless ip/port should all survive a restart together.
  const connectionMode = settings.connectionMode;
  const setConnectionMode = (m: ConnectionMode) => patchSettings({ connectionMode: m });

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Checked once per launch, after the setup/ready gate -- no need to poll,
  // a new release doesn't show up mid-session.
  useEffect(() => {
    if (!ready) return;
    checkForUpdate().then(setUpdate);
  }, [ready]);

  // A previously-connected Wi-Fi device doesn't survive the adb server
  // restart below (kill_adb_server, on the Rust side) -- that's what
  // actually held the wireless connection, not the phone's pairing/trust,
  // which is permanent. So reconnect automatically whenever Wi-Fi mode is
  // (or becomes) active, instead of making the user hit Connect again.
  // Keyed on `connectionMode` itself (not just `ready`) so this only ever
  // scans/connects while Wi-Fi mode is actually selected -- switching to
  // USB cancels any in-flight retry immediately, and USB mode never
  // triggers this at all. Prefers a live mDNS discovery hit (the device's
  // *current* address) over the persisted last-used ip:port, giving mDNS a
  // few retries since discovery takes a moment right after the adb server
  // restarts. All of this is best-effort: silent failure just leaves the
  // manual Connect button in the sidebar as the fallback.
  useEffect(() => {
    if (!ready || connectionMode !== "wifi") return;

    let cancelled = false;
    let attempts = 0;
    const tryReconnect = () => {
      if (cancelled) return;
      listMdnsDevices()
        .then((devices) => {
          if (cancelled) return;
          const found = devices.find((d) => d.kind === "connect");
          if (found) {
            const [ip, port] = found.address.split(":");
            connectWifi(ip, Number(port)).catch(() => {});
          } else if (attempts < 3) {
            attempts++;
            setTimeout(tryReconnect, 1500);
          } else {
            const { wifiIp, wifiPort } = stateRef.current.settings;
            if (wifiIp) connectWifi(wifiIp, wifiPort).catch(() => {});
          }
        })
        .catch(() => {
          if (cancelled) return;
          const { wifiIp, wifiPort } = stateRef.current.settings;
          if (wifiIp) connectWifi(wifiIp, wifiPort).catch(() => {});
        });
    };
    tryReconnect();
    return () => {
      cancelled = true;
    };
  }, [ready, connectionMode]);

  // Binds `combo` as the OS-level global shortcut for `action`, updates the
  // displayed hotkeys on success, and persists it as the user's choice.
  // Returns an error message on failure (combo invalid, or already taken)
  // instead of throwing, so callers can just show it.
  const bindHotkey = async (action: "record" | "screenshot", combo: string): Promise<string | null> => {
    try {
      await setHotkey(action, combo);
      setHotkeys((h) => ({ ...h, [action]: combo }));
      patchSettings(action === "record" ? { hotkeyRecord: combo } : { hotkeyScreenshot: combo });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  };

  // Applies the user's saved hotkeys once Rust is ready to register them --
  // there's no fixed default binding on the Rust side anymore, the frontend
  // is the source of truth for which combo goes with which action.
  useEffect(() => {
    if (!ready) return;
    const { hotkeyRecord, hotkeyScreenshot } = stateRef.current.settings;
    bindHotkey("record", hotkeyRecord).then((err) => err && console.error("record hotkey:", err));
    bindHotkey("screenshot", hotkeyScreenshot).then((err) => err && console.error("screenshot hotkey:", err));
  }, [ready]);

  const handleRecord = async () => {
    const { device: currentDevice, settings: currentSettings, sessionState: currentState } = stateRef.current;
    if (!currentDevice || currentState !== "idle") return;

    const outputPath = `${currentSettings.outputFolder}\\${generateFilename()}`;
    const args = buildScrcpyArgs(currentSettings, outputPath, currentDevice.serial);
    try {
      await startScrcpy(args);
      setElapsedMs(0);
      setSessionState("recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const handleStop = async () => {
    if (stateRef.current.sessionState !== "recording") return;
    await stopScrcpy(true);
    setSessionState("idle");
    setElapsedMs(0);
  };

  const handleToggleRecord = () => {
    if (stateRef.current.sessionState === "recording") void handleStop();
    else void handleRecord();
  };

  // Live preview: just scrcpy's own mirror window, no --record -- a quick
  // "what does this look like" check without capturing anything. Shares
  // the same single-session Rust state as recording (start_scrcpy already
  // refuses a second session), so the two just can't run at once.
  const handleTogglePreview = async () => {
    const { device: currentDevice, settings: currentSettings, sessionState: currentState } = stateRef.current;
    if (currentState === "previewing") {
      await stopScrcpy(true);
      setSessionState("idle");
      return;
    }
    if (!currentDevice || currentState !== "idle") return;
    try {
      await startScrcpy(buildPreviewArgs(currentSettings, currentDevice.serial));
      setSessionState("previewing");
    } catch (err) {
      console.error("Failed to start preview:", err);
    }
  };

  const handleScreenshot = async () => {
    const { device: currentDevice, settings: currentSettings } = stateRef.current;
    if (!currentDevice) return;
    await captureScreenshot(currentDevice.serial, `${currentSettings.outputFolder}\\Screenshots`).catch((err) =>
      console.error("Screenshot failed:", err),
    );
  };

  const handleBrowse = async () => {
    const folder = await open({ directory: true, defaultPath: settings.outputFolder });
    if (typeof folder === "string") patchSettings({ outputFolder: folder });
  };

  const handleOpenFolder = () => {
    openFolder(stateRef.current.settings.outputFolder).catch((err) => console.error("Could not open folder:", err));
  };

  // Waits for the Rust side's background scrcpy/adb install check -- fires
  // near-instantly on every run after the first, since it's just two
  // fs::exists() checks once the binaries are already there. That speed is
  // exactly the problem: it can finish before the listener below has
  // registered, and Tauri doesn't replay missed events -- so once
  // registration resolves, also pull the cached result directly in case it
  // already happened.
  useEffect(() => {
    let cancelled = false;
    const handleResult = (result: ScrcpySetupResult) => {
      setReady(true);
      if (!result.ok && result.error) console.error("scrcpy setup:", result.error);
    };
    const unlisten = listen<ScrcpySetupResult>("scrcpy-setup-done", (e) => handleResult(e.payload));
    unlisten.then(() => {
      if (cancelled) return;
      getScrcpyStatus()
        .then((status) => status && handleResult(status))
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      unlisten.then((f) => f());
    };
  }, []);

  // Device polling: no more auto-preview/auto-anything -- just keeps the
  // sidebar/Home page's connection status current, and resyncs session
  // state if scrcpy exits unexpectedly (crash, device unplugged mid-record).
  // Gated on `ready` so it doesn't start hitting adb before the background
  // install check above has had a chance to fetch it.
  useEffect(() => {
    if (!ready) return;
    const poll = async () => {
      const { device: currentDevice, sessionState: currentState, settings: currentSettings } = stateRef.current;
      const mode = currentSettings.connectionMode;

      const running = await isScrcpyRunning().catch(() => false);
      if (currentState !== "idle" && !running) {
        // Covers both a recording that crashed/got unplugged mid-capture
        // and a preview window the user just closed by hand.
        setSessionState("idle");
        setElapsedMs(0);
      }

      const raw = await listDevices().catch(() => []);
      setDeviceCount(raw.length);
      setHasScanned(true);
      // adb can see the same phone twice (once per transport) once it's been
      // wireless-connected -- prefer whichever transport matches the
      // selected mode, but fall back to whatever's there rather than
      // showing "no device" if only the other transport is up.
      const found = raw.find((d) => d.state === "device" && d.wireless === (mode === "wifi")) ?? raw.find((d) => d.state === "device");

      if (!found) {
        if (currentDevice) setDevice(null);
        return;
      }

      if (!currentDevice || currentDevice.serial !== found.serial) {
        const details = await getDeviceDetails(found.serial).catch(() => null);
        setDevice({
          model: found.model || found.serial,
          serial: found.serial,
          androidVersion: details?.android_version ?? "",
          wireless: found.wireless,
          batteryPercent: details?.battery_percent ?? -1,
          charging: details?.charging ?? false,
        });
      }
    };

    const id = setInterval(poll, 2000);
    poll();
    return () => clearInterval(id);
  }, [ready]);

  // Global hotkeys (bound above via bindHotkey once ready) fire even when
  // the window isn't focused -- Rust just emits an event on press.
  useEffect(() => {
    const unlistenRecord = listen("hotkey-toggle-record", () => handleToggleRecord());
    const unlistenScreenshot = listen("hotkey-screenshot", () => void handleScreenshot());
    return () => {
      unlistenRecord.then((f) => f());
      unlistenScreenshot.then((f) => f());
    };
  }, []);

  // Reads the version straight from tauri.conf.json (via Tauri's app API)
  // instead of a hardcoded string, so it can't drift from the real build
  // version again on the next release.
  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  if (!ready) {
    return (
      <div className="shell">
        <TitleBar
          onOpenSettings={() => {}}
          onOpenAbout={() => {}}
          updateAvailable={false}
          mode={connectionMode}
          onModeChange={setConnectionMode}
        />
        <div className="loading-screen">
          <Loader2 className="spin-icon" size={26} />
          <span>Preparing DoppelCast…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <TitleBar
        onOpenSettings={() => setPage("settings")}
        onOpenAbout={() => setPage("about")}
        updateAvailable={!!update}
        mode={connectionMode}
        onModeChange={setConnectionMode}
      />
      <div className="body">
        <Sidebar
          active={page}
          onNavigate={setPage}
          device={device}
          mode={connectionMode}
          settings={settings}
          onSettingsChange={patchSettings}
        />
        <div className="content">
          {page === "home" && (
            <HomePage
              device={device}
              outputFolder={settings.outputFolder}
              sessionState={sessionState}
              elapsed={formatElapsed(elapsedMs)}
              hotkeys={hotkeys}
              onRecordClick={handleRecord}
              onStopClick={handleStop}
              onScreenshotClick={handleScreenshot}
              onOpenFolderClick={handleOpenFolder}
              onTogglePreview={handleTogglePreview}
            />
          )}
          {page === "video" && <VideoSettingsPage settings={settings} onChange={patchSettings} />}
          {page === "audio" && <AudioSettingsPage settings={settings} onChange={patchSettings} />}
          {page === "settings" && (
            <GeneralSettingsPage
              settings={settings}
              onChange={patchSettings}
              onBrowseClick={handleBrowse}
              hotkeys={hotkeys}
              onRebindHotkey={bindHotkey}
            />
          )}
          {page === "about" && <AboutPage version={version} update={update} />}
        </div>
      </div>
      <StatusBar
        device={device}
        hotkeys={hotkeys}
        version={version}
        hasScanned={hasScanned}
        deviceCount={deviceCount}
        sessionState={sessionState}
        onTogglePreview={handleTogglePreview}
      />
    </div>
  );
}
