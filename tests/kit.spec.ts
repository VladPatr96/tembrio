import { test, expect } from "@playwright/test";
import { watchErrors } from "./helpers";

const KIT = "/src/kit/index.html";

test.describe("design kit", () => {
  test("shows all ten shelves without errors", async ({ page }) => {
    const { noErrors } = watchErrors(page);
    await page.goto(KIT);

    await expect(page.locator("[data-shelf]")).toHaveCount(18);
    await expect(
      page.getByRole("img", { name: "Tembrio" }).first(),
    ).toBeVisible();
    noErrors();
  });

  test("theme switch flips the whole palette", async ({ page }) => {
    await page.goto(`${KIT}?theme=light`);
    const paper = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--tb-paper")
          .trim()
          .toLowerCase(),
      );
    expect(await paper()).toBe("#fbf8f3");

    await page.getByRole("radio", { name: "Тёмная" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await paper()).toBe("#16141c");
  });

  test("switch reports its state to screen readers", async ({ page }) => {
    await page.goto(KIT);
    const sounds = page.getByRole("switch", { name: "Звуки записи" }).first();
    await expect(sounds).toHaveAttribute("aria-checked", "true");
    await sounds.click();
    await expect(sounds).toHaveAttribute("aria-checked", "false");
  });

  test("a «Listen» button shows sound only while it plays", async ({
    page,
  }) => {
    await page.goto(KIT);
    const listen = page.locator('[data-shelf="5"] .tb-listen').first();
    await expect(listen).not.toHaveClass(/tb-playing/);
    await listen.click();
    await expect(listen).toHaveClass(/tb-playing/);
  });

  test("the spend counter rolls to the new amount", async ({ page }) => {
    await page.goto(KIT);
    const ticker = page.locator('[data-shelf="10"] .tb-ticker');
    const before = await ticker.getAttribute("aria-label");
    await page.getByRole("button", { name: "+ фраза" }).click();
    await expect(ticker).not.toHaveAttribute("aria-label", before ?? "");
  });

  test("karaoke moves the highlight to the next word", async ({ page }) => {
    await page.goto(KIT);
    const current = page.locator('[data-shelf="10"] .tb-w.tb-cur');
    await expect(current).toHaveText(/года/);
    await page.getByRole("button", { name: "Следующее слово" }).click();
    await expect(current).toHaveText(/сумма/);
  });
});
