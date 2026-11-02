import { test, expect } from "@playwright/test";

/*
 * Baselines of the speech pill in its five looks — preparing, speaking, paused
 * and two messages — in both themes: the pill wears the app's own colours, so
 * each theme has its own picture.
 */
test.skip(
  process.platform !== "linux",
  "screenshot baselines are taken on Linux only: bun run test:visual",
);

const WORDS = ["До", "шестнадцатого", "октября", "сумма", "составит"];

const STATES = [
  {
    name: "prep",
    show: "speech-prep",
    payload: { kind: "preparing" },
  },
  {
    name: "speak",
    show: "speaking",
    payload: {
      kind: "speaking",
      paused: false,
      voice: "Денис",
      words: WORDS,
      word_index: 3,
      progress: 0.42,
    },
  },
  {
    name: "paused",
    show: "speaking",
    payload: {
      kind: "speaking",
      paused: true,
      voice: "Денис",
      words: WORDS,
      word_index: 2,
      progress: 0.31,
    },
  },
  {
    name: "msg-key",
    show: "message",
    payload: { kind: "message", message_key: "noKey", message_detail: "401" },
  },
  {
    name: "msg-plain",
    show: "message",
    payload: {
      kind: "message",
      message_key: "nothingSelected",
      message_detail: "",
    },
  },
];

for (const theme of ["light", "dark"] as const) {
  for (const state of STATES) {
    test(`${state.name} · ${theme}`, async ({ page }) => {
      await page.goto(`/src/overlay/index.html?theme=${theme}`);
      // Events sent before the overlay subscribes are lost, so wait for it.
      await page.waitForFunction(
        () =>
          (window as { __overlayListenersReady?: boolean })
            .__overlayListenersReady === true,
      );
      await page.evaluate(
        ([state, payload]) => {
          window.__TEMBRIO_MOCK__?.emit("show-overlay", state);
          return window.__TEMBRIO_MOCK__?.emit(
            "sound-state",
            payload as object,
          );
        },
        [state.show, state.payload] as unknown as [string, object],
      );
      await expect(page.locator(".tb-pill")).toBeVisible();
      await expect(page.locator(".tb-pill")).toHaveScreenshot(
        `pill-${state.name}-${theme}.png`,
        { animations: "disabled" },
      );
    });
  }
}
