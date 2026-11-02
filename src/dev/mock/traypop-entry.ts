/*
 * Tray panel entry for `vite --mode mock`: install the mock backend first, then
 * load the real panel. `?mode=menu` opens the short menu instead of the panel,
 * so both looks can be developed and screenshotted in a browser.
 */
import { installMockBackend } from "./backend";

installMockBackend("returning");

void import("../../traypop/main");
