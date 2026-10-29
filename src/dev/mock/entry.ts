/*
 * Entry point for `vite --mode mock`: the mock backend has to be in place
 * before any app module touches Tauri, so it is installed first and the real
 * entry is imported afterwards. `?mock=new` starts as a first-time user.
 */
import { installMockBackend } from "./backend";

const scenario =
  new URLSearchParams(window.location.search).get("mock") === "new"
    ? "new"
    : "returning";
installMockBackend(scenario);

void import("../../main");
