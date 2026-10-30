import { defineConfig, devices } from "@playwright/test";

/*
 * Two kinds of browser tests, both against the UI running on the mock
 * backend (`vite --mode mock`, src/dev/mock) — no Rust, no build:
 *
 * - e2e: scenarios (click, type, receive backend events). Run anywhere.
 * - visual: screenshot comparisons. Baselines are Linux-only, taken inside
 *   the official Playwright image so CI and local runs see the same fonts.
 *   Locally: `bun run test:visual` (needs Docker); on CI they run in the same
 *   image. Elsewhere the visual project skips itself.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  snapshotPathTemplate: "{testDir}/visual/__screenshots__/{arg}{ext}",
  expect: {
    // The first page of a cold dev server compiles for a few seconds.
    timeout: 15000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "e2e",
      testIgnore: /visual[\\/]/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual",
      testMatch: /visual[\\/].*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        // Fixed motion settings so a frame never lands mid-animation.
        reducedMotion: "reduce",
        locale: "ru-RU",
      },
    },
  ],
  webServer: {
    // node, not bunx: bun is not on the PATH cmd.exe sees on every Windows setup
    command: "node node_modules/vite/bin/vite.js --mode mock",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
