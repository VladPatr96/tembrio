import { test, expect, type Page } from "@playwright/test";
import { watchErrors } from "./helpers";

/*
 * The speech pill, driven only by events — exactly how the real backend talks
 * to it. The page is the overlay window itself (`/src/overlay/index.html` on
 * the mock backend), and `show-overlay` + `sound-state` arrive as Rust sends
 * them.
 */

declare global {
  interface Window {
    __overlayListenersReady?: boolean;
  }
}

const OVERLAY = "/src/overlay/index.html";

const WORDS = ["До", "шестнадцатого", "октября", "сумма", "составит"];

/** Deliver one backend event, as Rust would with `emit_to`. */
async function emit(page: Page, name: string, payload: unknown) {
  await page.evaluate(
    ([name, payload]) => window.__TEMBRIO_MOCK__?.emit(name as string, payload),
    [name, payload] as [string, unknown],
  );
}

const speakState = (over: object = {}) => ({
  kind: "speaking",
  paused: false,
  voice: "Денис",
  words: WORDS,
  word_index: 3,
  progress: 0.42,
  ...over,
});

test.describe("speech pill", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(OVERLAY);
    await page.waitForFunction(() => window.__overlayListenersReady === true);
  });

  test("reads aloud: voice, the sounding word and the controls", async ({
    page,
  }) => {
    const { noErrors } = watchErrors(page);
    await emit(page, "show-overlay", "speaking");
    await emit(page, "sound-state", speakState());
    const pill = page.locator(".tb-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("Денис");
    await expect(pill.locator(".tb-w.tb-cur")).toHaveText(/сумма/);
    await expect(pill.getByRole("button", { name: "Пауза" })).toBeVisible();
    await expect(pill.getByRole("button", { name: "Стоп" })).toBeVisible();
    await expect(pill.locator(".tb-pprog i")).toHaveAttribute("style", /42%/);
    noErrors();
  });

  test("preparing spins and names the voice it waits for", async ({ page }) => {
    await emit(page, "show-overlay", "speech-prep");
    await emit(page, "sound-state", { kind: "preparing", voice: "Achird" });
    const pill = page.locator(".tb-pill");
    await expect(pill).toBeVisible();
    await expect(pill.locator(".tb-spinner")).toBeVisible();
    await expect(pill).toContainText("Готовлю голос Achird…");
    // Nothing to pause or stop until the voice sounds.
    await expect(pill.locator(".tb-pbt")).toHaveCount(0);
  });

  test("preparing without a voice name still says what is happening", async ({
    page,
  }) => {
    await emit(page, "show-overlay", "speech-prep");
    await emit(page, "sound-state", { kind: "preparing" });
    await expect(page.locator(".tb-pill")).toContainText(/Готовлю голос/);
  });

  test("pause holds the word and the button turns into «continue»", async ({
    page,
  }) => {
    const { noErrors } = watchErrors(page);
    await emit(page, "show-overlay", "speaking");
    await emit(page, "sound-state", speakState());
    await page.getByRole("button", { name: "Пауза" }).click();
    await expect(
      page.evaluate(() => window.__TEMBRIO_MOCK__.calls.at(-1)?.cmd),
    ).resolves.toBe("pause_tts");
    // The backend answers with the same state, paused.
    await emit(page, "sound-state", speakState({ paused: true }));
    await expect(
      page.getByRole("button", { name: "Продолжить" }),
    ).toBeVisible();
    noErrors();
  });

  test("stop tells the backend to stop", async ({ page }) => {
    await emit(page, "show-overlay", "speaking");
    await emit(page, "sound-state", speakState());
    await page.getByRole("button", { name: "Стоп" }).click();
    await expect(
      page.evaluate(() => window.__TEMBRIO_MOCK__.calls.at(-1)?.cmd),
    ).resolves.toBe("stop_tts");
  });

  test("a message shows its text and, for a missing key, the way out", async ({
    page,
  }) => {
    await emit(page, "sound-state", speakState());
    await emit(page, "show-overlay", "message");
    await emit(page, "sound-state", {
      kind: "message",
      message_key: "noKey",
      message_detail: "401",
    });
    const pill = page.locator(".tb-pill");
    await expect(pill).toContainText(/Нет ключа/);
    await expect(pill.getByRole("button", { name: "Добавить" })).toBeVisible();
  });

  test("a message without an action shows only the text", async ({ page }) => {
    await emit(page, "show-overlay", "message");
    await emit(page, "sound-state", {
      kind: "message",
      message_key: "nothingSelected",
      message_detail: "",
    });
    const pill = page.locator(".tb-pill");
    await expect(pill).toContainText(/выделите текст/);
    await expect(pill.locator(".tb-pact")).toHaveCount(0);
  });

  test("karaoke keeps the words of the phrase from the first event", async ({
    page,
  }) => {
    // The progress ticks carry no word list; the words must stick.
    await emit(page, "show-overlay", "speaking");
    await emit(page, "sound-state", speakState());
    await emit(page, "sound-state", {
      kind: "speaking",
      paused: false,
      word_index: 4,
      progress: 0.8,
    });
    await expect(page.locator(".tb-pill .tb-w.tb-cur")).toHaveText(/составит/);
  });
});
