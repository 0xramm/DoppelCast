import type { UserSettings } from "./types";

export function buildScrcpyArgs(settings: UserSettings, outputPath: string, serial: string): string[] {
  const args: string[] = [];
  if (serial) {
    args.push("-s", serial);
  }

  args.push(`--video-codec=${settings.videoCodec}`);
  args.push(`--video-bit-rate=${settings.bitrateKbps}K`);
  args.push(`--max-fps=${settings.fps}`);

  if (settings.resolution > 0) {
    args.push(`--max-size=${settings.resolution}`);
  }

  if (settings.recordAudio) {
    args.push(`--audio-codec=${settings.audioCodec}`);
    // ponytail: --audio-source=mic reliably corrupted recordings on this
    // device, so only "output" (device audio) is offered -- no UI control
    // for it, deliberately.
    args.push("--audio-source=output");
  } else {
    args.push("--no-audio");
  }

  args.push(`--record=${outputPath}`);

  if (settings.turnScreenOff) args.push("--turn-screen-off");
  if (settings.stayAwake) args.push("--stay-awake");
  if (settings.showTouches) args.push("--show-touches");
  // No embedding, no in-app preview -- headless by default so recording
  // doesn't depend on a window existing at all. Showing scrcpy's own
  // (separate, unembedded) window is opt-in for people who want to watch --
  // custom-titled so nothing reveals what it actually is under the hood.
  if (settings.showMirrorWindow) {
    args.push("--window-title=DoppelCast");
    if (settings.renderDriver !== "auto") {
      args.push(`--render-driver=${settings.renderDriver}`);
    }
    if (settings.borderlessWindow) {
      args.push("--window-borderless");
    }
  } else {
    args.push("--no-playback");
  }

  return args;
}

// Live preview -- just the mirror window, no --record at all. Always shows
// the window (that's the whole point) regardless of showMirrorWindow, and
// skips audio since it's a quick visual check, not a capture.
export function buildPreviewArgs(settings: UserSettings, serial: string): string[] {
  const args: string[] = [];
  if (serial) {
    args.push("-s", serial);
  }

  args.push(`--video-codec=${settings.videoCodec}`);
  args.push(`--max-fps=${settings.fps}`);
  if (settings.resolution > 0) {
    args.push(`--max-size=${settings.resolution}`);
  }
  args.push("--no-audio");
  args.push("--window-title=DoppelCast Preview");
  if (settings.renderDriver !== "auto") {
    args.push(`--render-driver=${settings.renderDriver}`);
  }
  if (settings.borderlessWindow) {
    args.push("--window-borderless");
  }

  return args;
}

export function generateFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.mp4`;
}
