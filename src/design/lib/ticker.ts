/**
 * Number ticker: every digit of a formatted value becomes a drum that rolls
 * to its digit; everything else ($, ₽, separators) stays still.
 */

export type TickerCell =
  | { kind: "digit"; digit: number }
  | { kind: "text"; text: string };

export function tickerCells(value: string): TickerCell[] {
  return [...value].map((ch) =>
    ch >= "0" && ch <= "9"
      ? { kind: "digit", digit: ch.charCodeAt(0) - 48 }
      : { kind: "text", text: ch },
  );
}
