import { expect, type Page } from "@playwright/test";

/**
 * Collects uncaught page errors and console errors, so every scenario can
 * end with `await noErrors()` — the same «no errors» bar the v5 prototype
 * checks used.
 */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return {
    errors,
    noErrors: () => expect(errors, errors.join("\n")).toEqual([]),
  };
}

/** Commands the UI sent to the mock backend, by name. */
export async function mockCalls(page: Page): Promise<string[]> {
  return page.evaluate(
    () => window.__TEMBRIO_MOCK__?.calls.map((call) => call.cmd) ?? [],
  );
}

/** Deliver a backend event, as Rust would with `app.emit`. */
export async function emitEvent(page: Page, event: string, payload?: unknown) {
  await page.evaluate(
    ([name, data]) => window.__TEMBRIO_MOCK__?.emit(name as string, data),
    [event, payload] as const,
  );
}
