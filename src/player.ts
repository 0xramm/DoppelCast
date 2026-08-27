import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

// Opens a clip in its own small native window instead of embedding a player
// in the main UI -- gets native window chrome (drag/resize/close) for free,
// and main.tsx just renders <PlayerPage> there instead of the full app.
export function openClipPlayer(path: string, title: string) {
  const label = `player-${Date.now()}`;
  const url = `index.html?clip=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}`;
  new WebviewWindow(label, {
    url,
    title,
    width: 560,
    height: 380,
    minWidth: 320,
    minHeight: 220,
  });
}

// Same pattern as the clip player, but for screenshots -- its own small
// native window instead of a file-manager round trip.
export function openImageViewer(path: string, title: string) {
  const label = `viewer-${Date.now()}`;
  const url = `index.html?image=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}`;
  new WebviewWindow(label, {
    url,
    title,
    width: 480,
    height: 380,
    minWidth: 240,
    minHeight: 200,
  });
}
