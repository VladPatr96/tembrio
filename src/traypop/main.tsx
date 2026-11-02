import React from "react";
import ReactDOM from "react-dom/client";
import "@/design/tokens.css";
import "@/design/kit.css";
import "@/i18n";
import {
  applyTheme,
  getStoredTheme,
  syncThemeFromSettings,
} from "@/lib/utils/theme";
import type { Theme } from "@/bindings";
import { listen } from "@tauri-apps/api/event";
import { TrayPanel } from "./TrayPanel";
import "./traypanel.css";

// Its own webview, like the overlay: set the theme before the first paint so the
// panel never flashes the wrong paper colour.
// `?theme=dark` / `?theme=light` pins a theme (the screenshot tests use it);
// without it the panel follows the saved theme, like the rest of the app. A pin
// also skips the settings sync below, which would otherwise overwrite it.
const pinned = new URLSearchParams(window.location.search).get("theme");
const isPinned = pinned === "dark" || pinned === "light";
applyTheme(isPinned ? (pinned as Theme) : getStoredTheme());
if (!isPinned) syncThemeFromSettings();
listen<Theme>("theme-changed", (event) => applyTheme(event.payload));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TrayPanel />
  </React.StrictMode>,
);
