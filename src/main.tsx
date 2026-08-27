import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/outfit";
import "./theme.css";
import "./App.css";
import App from "./App";
import PlayerPage from "./pages/PlayerPage";
import ImageViewerPage from "./pages/ImageViewerPage";

// The clip player / screenshot viewer open as separate native windows (see
// player.ts) pointed at this same index.html with a `clip`/`image` query
// param -- no router, just a one-time check of which "page" this
// particular window instance is.
const params = new URLSearchParams(window.location.search);
const clip = params.get("clip");
const image = params.get("image");
const title = params.get("title") ?? "Clip";

function page() {
  if (clip) return <PlayerPage path={clip} title={title} />;
  if (image) return <ImageViewerPage path={image} title={title} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<React.StrictMode>{page()}</React.StrictMode>);
