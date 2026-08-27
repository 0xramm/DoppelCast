import { convertFileSrc } from "@tauri-apps/api/core";

export default function ImageViewerPage({ path, title }: { path: string; title: string }) {
  return (
    <div className="player-page">
      <img src={convertFileSrc(path)} alt={title} className="viewer-image" />
    </div>
  );
}
