import { test, expect, type Page } from "@playwright/test";

/*
 * The tray panel: the glass sheet at the icon (left click) and the short menu
 * (right click). Both are the same page; Rust sends `tray-panel` with the look
 * it wants, exactly as the real window does.
 */

const PAGE = "/src/traypop/index.html";

/** Deliver one backend event, as Rust would with `emit_to`. */
async function emit(page: Page, name: string, payload: unknown) {
  await page.evaluate(
    ([name, payload]) => window.__TEMBRIO_MOCK__?.emit(name as string, payload),
    [name, payload] as [string, unknown],
  );
}

async function open(page: Page, mode: "panel" | "menu" = "panel") {
  await page.goto(PAGE);
  await expect(page.locator(".tp-root")).toBeVisible();
  if (mode === "menu") await emit(page, "tray-panel", "menu");
}

test.describe("tray panel", () => {
  test("shows the voice, its speed and the two actions", async ({ page }) => {
    await open(page);
    const panel = page.locator(".tb-traypop");
    await expect(panel).toBeVisible();
    // The logo is drawn, not written: the wordmark is an SVG.
    await expect(panel.locator(".tb-tph svg")).toBeVisible();
    await expect(panel.locator(".tb-tpv")).toContainText("Achird");
    await expect(panel.locator(".tb-tps")).toContainText("1.10×");
    await expect(
      panel.getByRole("button", { name: /Прочитать/ }),
    ).toBeVisible();
    await expect(panel.getByRole("button", { name: /Диктовка/ })).toBeVisible();
    await expect(panel.locator(".tp-today")).toContainText("$0.00");
  });

  test("says what is sounding right now", async ({ page }) => {
    await open(page);
    await expect(page.locator(".tb-tph .tb-state")).toContainText("отдыхает");
    await emit(page, "sound-state", { kind: "speaking", voice: "Achird" });
    await expect(page.locator(".tb-tph .tb-state")).toContainText("читает");
    await emit(page, "sound-state", {
      kind: "speaking",
      voice: "Achird",
      paused: true,
    });
    await expect(page.locator(".tb-tph .tb-state")).toContainText("пауза");
  });

  test("«read the clipboard» asks the backend to speak and closes", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("button", { name: /Прочитать/ }).click();
    const calls = await page.evaluate(() =>
      window.__TEMBRIO_MOCK__.calls.map((call) => call.cmd),
    );
    expect(calls).toContain("speak_clipboard_command");
    expect(calls).toContain("hide_tray_panel");
  });

  test("choosing another voice stores it", async ({ page }) => {
    await open(page);
    await page.locator(".tb-tpv select").selectOption("Kore");
    const calls = await page.evaluate(() =>
      window.__TEMBRIO_MOCK__.calls.map((call) => call.cmd),
    );
    expect(calls).toContain("change_tts_voice_setting");
  });

  test("Escape closes the panel", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Escape");
    const last = await page.evaluate(
      () => window.__TEMBRIO_MOCK__.calls.at(-1)?.cmd,
    );
    expect(last).toBe("hide_tray_panel");
  });

  test("the short menu lists the four commands and the voice", async ({
    page,
  }) => {
    await open(page, "menu");
    const menu = page.locator(".tb-traymenu");
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("Открыть Tembrio");
    await expect(menu).toContainText("Прочитать буфер обмена");
    await expect(menu).toContainText("Пауза");
    await expect(menu).toContainText("Голос:");
    await expect(menu).toContainText("Achird");
    await expect(menu).toContainText("Настройки");
  });

  test("the menu's pause reaches the reading", async ({ page }) => {
    await open(page, "menu");
    await page.getByRole("menuitem", { name: /Пауза/ }).click();
    const calls = await page.evaluate(() =>
      window.__TEMBRIO_MOCK__.calls.map((call) => call.cmd),
    );
    expect(calls).toContain("pause_tts");
    expect(calls).toContain("hide_tray_panel");
  });

  test("the menu's «open» brings the window forward", async ({ page }) => {
    await open(page, "menu");
    await page.getByRole("menuitem", { name: "Открыть Tembrio" }).click();
    const calls = await page.evaluate(() =>
      window.__TEMBRIO_MOCK__.calls.map((call) => call.cmd),
    );
    expect(calls).toContain("show_main_window_command");
  });
});
