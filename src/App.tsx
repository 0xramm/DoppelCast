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
  CaptureSettingsPage,
  GeneralSettingsPage,
  HotkeysSettingsPage,
} from "./pages/SettingsPages";
import type { DeviceInfo, PageId, SessionState, UserSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  listDevices,
  getDeviceDetails,
  openFolder,
  captureScreenshot,
  startScrcpy,
  stopScrcpy,
  isScrcpyRunning,
  getHotkeys,
  type BoundHotkeys,
  type ScrcpySetupResult,
} from "./api";
import { buildScrcpyArgs, generateFilename } from "./scrcpyArgs";

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
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
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

  const handleRecord = async () => {
    const { device: currentDevice, settings: currentSettings, sessionState: currentState } = stateRef.current;
    if (!currentDevice || currentState === "recording") return;

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
  // fs::exists() checks once the binaries are already there.
  useEffect(() => {
    const unlisten = listen<ScrcpySetupResult>("scrcpy-setup-done", (e) => {
      setReady(true);
      if (!e.payload.ok && e.payload.error) console.error("scrcpy setup:", e.payload.error);
    });
    return () => {
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
      const { device: currentDevice, sessionState: currentState } = stateRef.current;

      const running = await isScrcpyRunning().catch(() => false);
      if (currentState === "recording" && !running) {
        setSessionState("idle");
        setElapsedMs(0);
      }

      const raw = await listDevices().catch(() => []);
      setDeviceCount(raw.length);
      setHasScanned(true);
      const found = raw.find((d) => d.state === "device");

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

  // Global hotkeys (registered on the Rust side, with fallback key combos
  // if the preferred one is already claimed by other software) fire even
  // when the window isn't focused -- Rust just emits an event on press.
  useEffect(() => {
    const unlistenRecord = listen("hotkey-toggle-record", () => handleToggleRecord());
    const unlistenScreenshot = listen("hotkey-screenshot", () => void handleScreenshot());
    return () => {
      unlistenRecord.then((f) => f());
      unlistenScreenshot.then((f) => f());
    };
  }, []);

  // Fetch which key combo Rust actually managed to bind -- the preferred
  // one isn't guaranteed to be free, so the UI shows the real one instead
  // of assuming.
  useEffect(() => {
    getHotkeys()
      .then(setHotkeys)
      .catch(() => {});
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
        <TitleBar onOpenSettings={() => {}} />
        <div className="loading-screen">
          <Loader2 className="spin-icon" size={26} />
          <span>Preparing DoppelCast…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <TitleBar onOpenSettings={() => setPage("settings")} />
      <div className="body">
        <Sidebar active={page} onNavigate={setPage} device={device} />
        <div className="content">
          {page === "home" && (
            <HomePage
              device={device}
              settings={settings}
              onSettingsChange={patchSettings}
              sessionState={sessionState}
              elapsed={formatElapsed(elapsedMs)}
              hotkeys={hotkeys}
              onRecordClick={handleRecord}
              onStopClick={handleStop}
              onScreenshotClick={handleScreenshot}
              onBrowseClick={handleBrowse}
              onOpenFolderClick={handleOpenFolder}
            />
          )}
          {page === "video" && <VideoSettingsPage settings={settings} onChange={patchSettings} />}
          {page === "audio" && <AudioSettingsPage settings={settings} onChange={patchSettings} />}
          {page === "capture" && <CaptureSettingsPage settings={settings} onChange={patchSettings} />}
          {page === "settings" && <GeneralSettingsPage />}
          {page === "hotkeys" && <HotkeysSettingsPage hotkeys={hotkeys} />}
          {page === "about" && <AboutPage version={version} />}
        </div>
      </div>
      <StatusBar
        device={device}
        hotkeys={hotkeys}
        onOpenFolder={handleOpenFolder}
        version={version}
        hasScanned={hasScanned}
        deviceCount={deviceCount}
      />
    </div>
  );
}
