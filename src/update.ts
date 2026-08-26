import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function checkForUpdate(): Promise<Update | null> {
  try {
    const update = await check();
    return update?.available ? update : null;
  } catch (err) {
    console.error("Update check failed:", err);
    return null;
  }
}

export async function installUpdate(update: Update, onProgress?: (downloaded: number, total: number) => void) {
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? 0;
    else if (event.event === "Progress") downloaded += event.data.chunkLength;
    onProgress?.(downloaded, total);
  });
  await relaunch();
}
