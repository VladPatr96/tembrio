import React from "react";
import ReactDOM from "react-dom/client";
import "../App.css";
import "./kit-page.css";
import { KitPage } from "./KitPage";

// `?theme=dark` / `?theme=light` pins a theme (the screenshot tests use it);
// without it the page follows the system, like the app.
const theme = new URLSearchParams(window.location.search).get("theme");
if (theme === "dark" || theme === "light") {
  document.documentElement.dataset.theme = theme;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <KitPage />
  </React.StrictMode>,
);
