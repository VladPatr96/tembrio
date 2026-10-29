import { test, expect } from "@playwright/test";
import { mockCalls, watchErrors } from "./helpers";

test.describe("Tembrio on the mock backend", () => {
  test("a returning user lands in the app without errors", async ({ page }) => {
    const { noErrors } = watchErrors(page);
    await page.goto("/");

    await expect.poll(() => mockCalls(page)).toContain("get_app_settings");
    await expect(page.locator("#root")).not.toBeEmpty();
    noErrors();
  });

  test("a first-time user starts with onboarding", async ({ page }) => {
    const { noErrors } = watchErrors(page);
    await page.goto("/?mock=new");

    await expect.poll(() => mockCalls(page)).toContain("get_app_settings");
    await expect(
      page.evaluate(
        () => window.__TEMBRIO_MOCK__?.settings().onboarding_completed,
      ),
    ).resolves.toBe(false);
    noErrors();
  });
});
