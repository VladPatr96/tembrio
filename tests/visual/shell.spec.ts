import { test, expect } from "@playwright/test";

/*
 * The window shell in both themes. The section bodies still belong to Handy
 * until their own stage lands, so these shots are the same screens those
 * stages will replace — a deliberate, visible diff then.
 */
test.skip(
  process.platform !== "linux",
  "screenshot baselines are taken on Linux only: bun run test:visual",
);

const VIEWS = [
  { name: "voices", tab: "Голоса" },
  { name: "general", tab: "Общие" },
  { name: "soon", tab: "Затраты" },
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`shell · ${theme}`, () => {
    for (const view of VIEWS) {
      test(view.name, async ({ page }) => {
        // Pin the theme the way a person would: press the theme button until
        // the document says what we want.
        await page.goto("/");
        for (let i = 0; i < 3; i++) {
          const current = await page.evaluate(
            () => document.documentElement.dataset.theme ?? "system",
          );
          if (current === theme) break;
          await page.locator(".tb-toolbar .tb-icon-btn").click();
        }
        await page.getByRole("button", { name: view.tab, exact: true }).click();
        await expect(page.locator(".tb-shell")).toHaveScreenshot(
          `shell-${theme}-${view.name}.png`,
          { maxDiffPixelRatio: 0.02 },
        );
      });
    }
  });
}
