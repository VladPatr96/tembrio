/*
 * Overlay window entry for `vite --mode mock`: installs the mock backend
 * first (the pill window talks to `get_app_settings` on boot too), then loads
 * the real overlay. In production builds this file does not exist for Vite.
 */
import { installMockBackend } from "./backend";

installMockBackend("returning");

void import("../../overlay/main");
