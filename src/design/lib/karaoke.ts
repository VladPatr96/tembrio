/**
 * Karaoke line: the text slides left so the word being spoken stays near the
 * left third of the box, and never slides right of its start.
 */

export type WordState = "past" | "current" | "future";

export function wordState(index: number, current: number): WordState {
  if (index < current) return "past";
  if (index === current) return "current";
  return "future";
}

/** Horizontal shift (px, ≤ 0) for the line so `wordLeft` sits at 30%. */
export function karaokeShift(boxWidth: number, wordLeft: number): number {
  return Math.min(0, Math.round(boxWidth * 0.3 - wordLeft));
}
