import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
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

  // Device polling: no more auto-preview/auto-anything -- just keeps the
  // sidebar/Home page's connection status current, and resyncs session
  // state if scrcpy exits unexpectedly (crash, device unplugged mid-record).
  useEffect(() => {
    const poll = async () => {
      const { device: currentDevice, sessionState: currentState } = stateRef.current;

      const running = await isScrcpyRunning().catch(() => false);
      if (currentState === "recording" && !running) {
        setSessionState("idle");
        setElapsedMs(0);
      }

      const raw = await listDevices().catch(() => []);
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
  }, []);

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
          {page === "about" && <AboutPage />}
        </div>
      </div>
      <StatusBar device={device} hotkeys={hotkeys} onOpenFolder={handleOpenFolder} />
    </div>
  );
}
