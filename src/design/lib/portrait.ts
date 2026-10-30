/**
 * A voice "portrait": a small waveform that is the same every time for the
 * same voice id, so people learn to recognise a voice by its shape. Ported
 * from the v5 prototype.
 */

export type PortraitBar = {
  /** Bar height, 0.12..1 of the portrait height. */
  height: number;
  /** Negative animation delay in seconds, so playing bars move out of step. */
  delay: number;
  /** Where this bar sits along the gradient, 0..100 (%). */
  gradientAt: number;
};

/** FNV-1a: a stable 32-bit hash of the voice id. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (const ch of id) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded random generator, enough for shapes. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function portraitBars(id: string, count = 28): PortraitBar[] {
  const random = seededRandom(hashId(id));
  const slow = 1 + random() * 2.5;
  const fast = 3 + random() * 5;
  const phase = random() * 6;
  const bars: PortraitBar[] = [];
  for (let i = 0; i < count; i++) {
    const x = i / count;
    // fade in and out at the edges, like a spoken phrase
    const envelope = Math.pow(Math.sin(Math.PI * (x + 0.5 / count)), 0.55);
    const wave =
      (0.55 + 0.45 * Math.sin(x * slow * 2 * Math.PI + phase)) *
      (0.65 + 0.35 * Math.sin(x * fast * 2 * Math.PI)) *
      envelope;
    const height = Math.max(0.12, Math.min(1, wave * 0.9 + random() * 0.25));
    bars.push({
      height: Math.round(height * 100) / 100,
      delay: -Math.round(random() * 100) / 100,
      gradientAt: count > 1 ? Math.round((i / (count - 1)) * 1000) / 10 : 0,
    });
  }
  return bars;
}
