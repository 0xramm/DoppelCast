import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/outfit";
import "./theme.css";
import "./App.css";
import App from "./App";
import PlayerPage from "./pages/PlayerPage";

// The clip player opens as a separate native window (see player.ts) pointed
// at this same index.html with a `clip` query param -- no router, just a
// one-time check of which "page" this particular window instance is.
const params = new URLSearchParams(window.location.search);
const clip = params.get("clip");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{clip ? <PlayerPage path={clip} title={params.get("title") ?? "Clip"} /> : <App />}</React.StrictMode>,
);
