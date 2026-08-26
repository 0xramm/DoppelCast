import { convertFileSrc } from "@tauri-apps/api/core";

// Native video controls already have a playback-speed option (right-click
// menu / "..." overflow) -- no need to build a custom speed row on top.
export default function PlayerPage({ path, title }: { path: string; title: string }) {
  return (
    <div className="player-page">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={convertFileSrc(path)} controls autoPlay className="player-video" title={title} />
    </div>
  );
}
