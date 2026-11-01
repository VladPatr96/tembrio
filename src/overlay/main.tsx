import React from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import RecordingOverlay from "./RecordingOverlay";
import {
  applyTheme,
  getStoredTheme,
  syncThemeFromSettings,
} from "@/lib/utils/theme";
import type { Theme } from "@/bindings";
import "@/i18n";

// A separate webview from the settings window, so the overlay has to set
// `data-theme` on its own document: last-known theme before render (shared
// localStorage) to avoid a flash, reconcile with the persisted setting in case
// the overlay booted first, then follow live changes.
// `?theme=dark` / `?theme=light` pins a theme (the screenshot tests use it);
// without it the overlay follows the saved theme. A pin skips the settings sync,
// which would otherwise overwrite it.
const pinned = new URLSearchParams(window.location.search).get("theme");
const isPinned = pinned === "dark" || pinned === "light";
applyTheme(isPinned ? (pinned as Theme) : getStoredTheme());
if (!isPinned) syncThemeFromSettings();
listen<Theme>("theme-changed", (event) => applyTheme(event.payload));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RecordingOverlay />
  </React.StrictMode>,
);
