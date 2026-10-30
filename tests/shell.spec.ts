import { test, expect } from "@playwright/test";
import { watchErrors } from "./helpers";

/*
 * The shell: seven tabs, the theme button, the bottom strip. Each tab must
 * open something real — an inherited Handy screen or an honest «скоро» —
 * because losing a section is the one thing this stage must not do.
 */

const TABS = [
  "Голоса",
  "Диктовка",
  "Произношение",
  "История",
  "Модели",
  "Затраты",
  "Общие",
];

test.describe("window shell", () => {
  test("shows the logo, the seven tabs and the strip", async ({ page }) => {
    const { noErrors } = watchErrors(page);
    await page.goto("/");

    await expect(
      page.getByRole("img", { name: "Tembrio" }).first(),
    ).toBeVisible();
    const tabs = page
      .getByRole("navigation", { name: "Разделы" })
      .getByRole("button");
    await expect(tabs).toHaveText(TABS);
    await expect(page.locator(".tb-strip")).toContainText("Выделите текст");
    noErrors();
  });

  test("each tab opens something, and says which one is current", async ({
    page,
  }) => {
    const { noErrors } = watchErrors(page);
    await page.goto("/");

    for (const name of TABS) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".tb-views")).not.toBeEmpty();
    }
    noErrors();
  });

  test("sections without a screen yet say «скоро» instead of showing nothing", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: "Произношение", exact: true })
      .click();
    await expect(page.locator(".tb-soon")).toContainText("Скоро");

    await page.getByRole("button", { name: "Затраты", exact: true }).click();
    await expect(page.locator(".tb-soon")).toContainText("Скоро");
  });

  test("General keeps the advanced settings reachable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Общие", exact: true }).click();
    const view = page.locator(".tb-views");
    await expect(view).toContainText("О программе");
    await expect(view).toContainText("Метод вставки");
  });

  test("the strip names the speak-selection hotkey", async ({ page }) => {
    await page.goto("/");
    const strip = page.locator(".tb-strip");
    await expect(strip.locator(".tb-kbd")).toHaveText(["Ctrl", "Alt", "S"]);
  });

  test("the theme button walks light, dark and system", async ({ page }) => {
    await page.goto("/");
    const button = page.locator(".tb-toolbar .tb-icon-btn");
    const theme = () =>
      page.evaluate(() => document.documentElement.dataset.theme ?? "system");

    // The mock starts on the system theme, so the first press goes light.
    expect(await theme()).toBe("system");
    await button.click();
    expect(await theme()).toBe("light");
    await button.click();
    expect(await theme()).toBe("dark");
    await button.click();
    expect(await theme()).toBe("system");
  });
});
