import { test, expect } from "@playwright/test";

/*
 * Screenshot baselines of the design kit, shelf by shelf, in both themes.
 * Linux-only: run `bun run test:visual` (Docker) or let CI do it; refresh
 * baselines with `bun run test:visual -- --update` or the «Update
 * screenshots» workflow, then look at every changed PNG before committing.
 */
test.skip(
  process.platform !== "linux",
  "screenshot baselines are taken on Linux only: bun run test:visual",
);

const SHELVES = [
  "logo",
  "colors",
  "type",
  "icons",
  "buttons",
  "fields",
  "choice",
  "messages",
  "settings-group",
  "sound",
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`kit · ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/src/kit/index.html?theme=${theme}`);
      await expect(page.locator("[data-shelf]")).toHaveCount(SHELVES.length);
    });

    SHELVES.forEach((name, i) => {
      test(name, async ({ page }) => {
        const shelf = page.locator(`[data-shelf="${i + 1}"]`);
        await expect(shelf).toHaveScreenshot(
          `kit-${theme}-${i + 1}-${name}.png`,
        );
      });
    });
  });
}
