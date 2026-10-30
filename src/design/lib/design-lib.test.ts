import { describe, expect, test } from "bun:test";
import { karaokeShift, wordState } from "./karaoke";
import { formatMoney } from "./money";
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

// Amounts from a real OpenRouter bill: a sentence, a page, a day, a balance.
const RATE = 96.4; // roubles per dollar
const NBSP = " ";

describe("money in dollars", () => {
  test("from a cent up: two digits", () => {
    expect(formatMoney(0.18, "usd", RATE)).toBe("$0.18");
    expect(formatMoney(12.4, "usd", RATE)).toBe("$12.40");
  });

  test("below a cent: four digits, so spending never reads as zero", () => {
    expect(formatMoney(0.0042, "usd", RATE)).toBe("$0.0042");
  });

  test("a sentence's worth: «меньше тысячной»", () => {
    expect(formatMoney(0.0004, "usd", RATE)).toBe("<$0.001");
  });

  test("exactly zero is a clean zero", () => {
    expect(formatMoney(0, "usd", RATE)).toBe("$0.00");
  });

  test("digits are cut, never rounded up", () => {
    expect(formatMoney(0.009999, "usd", RATE)).toBe("$0.0099");
    expect(formatMoney(0.189, "usd", RATE)).toBe("$0.18");
  });
});

describe("money in roubles", () => {
  test("kopecks below a hundred roubles, with a decimal comma", () => {
    expect(formatMoney(0.18, "rub", RATE)).toBe(`17,35${NBSP}₽`);
    expect(formatMoney(0.0042, "rub", RATE)).toBe(`0,40${NBSP}₽`);
  });

  test("whole roubles from a hundred up, thousands split", () => {
    expect(formatMoney(12.4, "rub", RATE)).toBe(`1${NBSP}195${NBSP}₽`);
    expect(formatMoney(20.15, "rub", RATE)).toBe(`1${NBSP}942${NBSP}₽`);
  });

  test("far below a kopeck says so", () => {
    expect(formatMoney(0.00004, "rub", RATE)).toBe(
      "<0,01 ₽".replace(" ", NBSP),
    );
  });

  test("a missing rate falls back to dollars instead of «0,00 ₽»", () => {
    expect(formatMoney(0.18, "rub", 0)).toBe("$0.18");
    expect(formatMoney(0.18, "rub", Number.NaN)).toBe("$0.18");
  });
});

describe("money edge cases", () => {
  test("a negative balance keeps its sign", () => {
    expect(formatMoney(-0.18, "usd", RATE)).toBe("-$0.18");
    expect(formatMoney(-12.4, "rub", RATE)).toBe(`-1${NBSP}195${NBSP}₽`);
  });

  test("a broken number shows a dash, not a made-up amount", () => {
    expect(formatMoney(Number.NaN, "usd", RATE)).toBe("—");
  });
});
