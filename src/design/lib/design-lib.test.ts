import { describe, expect, test } from "bun:test";
import { karaokeShift, wordState } from "./karaoke";
import { hashId, portraitBars } from "./portrait";
import { tickerCells } from "./ticker";

describe("voice portrait", () => {
  test("the same voice always gets the same shape", () => {
    expect(portraitBars("piper:ru_RU-denis-medium")).toEqual(
      portraitBars("piper:ru_RU-denis-medium"),
    );
  });

  test("different voices look different", () => {
    const heights = (id: string) => portraitBars(id).map((bar) => bar.height);
    expect(heights("piper:ru_RU-denis-medium")).not.toEqual(
      heights("piper:ru_RU-irina-medium"),
    );
  });

  test("bars stay visible and inside the box", () => {
    for (const id of ["a", "openrouter:achird", "кириллица", ""]) {
      for (const bar of portraitBars(id, 22)) {
        expect(bar.height).toBeGreaterThanOrEqual(0.12);
        expect(bar.height).toBeLessThanOrEqual(1);
        expect(bar.delay).toBeLessThanOrEqual(0);
      }
    }
  });

  test("the gradient runs from the first bar to the last", () => {
    const bars = portraitBars("x", 28);
    expect(bars).toHaveLength(28);
    expect(bars[0].gradientAt).toBe(0);
    expect(bars[27].gradientAt).toBe(100);
  });

  test("hash is stable across runs (portraits must not change on update)", () => {
    expect(hashId("Tembrio")).toBe(hashId("Tembrio"));
    expect(hashId("")).toBe(2166136261);
  });
});

describe("karaoke", () => {
  test("words before the current one are past, after it are future", () => {
    expect([0, 1, 2].map((i) => wordState(i, 1))).toEqual([
      "past",
      "current",
      "future",
    ]);
  });

  test("before the first word nothing is spoken yet", () => {
    expect(wordState(0, -1)).toBe("future");
  });

  test("the line slides so the spoken word sits at 30% of the box", () => {
    expect(karaokeShift(400, 300)).toBe(-180);
  });

  test("the line never slides right of its start", () => {
    expect(karaokeShift(400, 20)).toBe(0);
  });
});

describe("ticker", () => {
  test("digits roll, symbols stay", () => {
    expect(tickerCells("$0.18")).toEqual([
      { kind: "text", text: "$" },
      { kind: "digit", digit: 0 },
      { kind: "text", text: "." },
      { kind: "digit", digit: 1 },
      { kind: "digit", digit: 8 },
    ]);
  });

  test("rouble amounts keep the comma and the sign", () => {
    expect(
      tickerCells("17,74 ₽").filter((cell) => cell.kind === "text"),
    ).toEqual([
      { kind: "text", text: "," },
      { kind: "text", text: " " },
      { kind: "text", text: "₽" },
    ]);
  });
});
