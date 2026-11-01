import { test, expect } from "@playwright/test";

/*
 * Baselines of the tray sheet: the panel and the short menu, each in both
 * themes. The sheet is opaque, so both themes matter.
 */
test.skip(
  process.platform !== "linux",
  "screenshot baselines are taken on Linux only: bun run test:visual",
);

for (const theme of ["light", "dark"] as const) {
  for (const mode of ["panel", "menu"] as const) {
    test(`${mode} · ${theme}`, async ({ page }) => {
      await page.setViewportSize(
        mode === "panel"
          ? { width: 342, height: 308 }
          : { width: 300, height: 222 },
      );
      await page.goto(`/src/traypop/index.html?theme=${theme}`);
      await expect(page.locator(".tp-root")).toBeVisible();
      if (mode === "menu") {
        await page.evaluate(() =>
          window.__TEMBRIO_MOCK__?.emit("tray-panel", "menu"),
        );
      }
      const sheet = page.locator(
        mode === "panel" ? ".tb-traypop" : ".tb-traymenu",
      );
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveScreenshot(`traypanel-${mode}-${theme}.png`, {
        animations: "disabled",
      });
    });
  }
}
