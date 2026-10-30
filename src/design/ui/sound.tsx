import { useLayoutEffect, useMemo, useRef } from "react";
import { cx } from "../lib/cx";
import { karaokeShift, wordState } from "../lib/karaoke";
import { portraitBars } from "../lib/portrait";
import { tickerCells } from "../lib/ticker";

type VoicePortraitProps = {
  voiceId: string;
  bars?: number;
  /** Coloured and moving only while this voice is heard. */
  playing?: boolean;
  className?: string;
};

export function VoicePortrait({
  voiceId,
  bars = 28,
  playing = false,
  className,
}: VoicePortraitProps) {
  const shape = useMemo(() => portraitBars(voiceId, bars), [voiceId, bars]);
  return (
    <div
      className={cx("tb-portrait", playing && "tb-playing", className)}
      aria-hidden
    >
      {shape.map((bar, i) => (
        <i
          key={i}
          style={{
            ["--h" as string]: bar.height,
            ["--d" as string]: `${bar.delay}s`,
            ["--bw" as string]: `${bars * 100}%`,
            ["--bx" as string]: `${bar.gradientAt}%`,
          }}
        />
      ))}
    </div>
  );
}

type KaraokeProps = {
  words: string[];
  /** Index of the word being spoken; -1 before the first one. */
  current: number;
  className?: string;
};

/** One line of text; the spoken word wears the sound gradient. */
export function Karaoke({ words, current, className }: KaraokeProps) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const word = line.current?.children[Math.max(0, current)] as
      | HTMLElement
      | undefined;
    if (!box.current || !line.current || !word) return;
    const shift = karaokeShift(box.current.clientWidth, word.offsetLeft);
    line.current.style.transform = `translateX(${shift}px)`;
  }, [current, words]);

  return (
    <div ref={box} className={cx("tb-kara", className)}>
      <span ref={line} className="tb-kt">
        {words.map((word, i) => {
          const state = wordState(i, current);
          return (
            <span
              key={i}
              className={cx(
                "tb-w",
                state === "past" && "tb-past",
                state === "current" && "tb-cur",
              )}
            >
              {word}{" "}
            </span>
          );
        })}
      </span>
    </div>
  );
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** A formatted value whose digits roll like drums when it changes. */
export function Ticker({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={cx("tb-ticker", className)} aria-label={value} role="img">
      {tickerCells(value).map((cell, i) =>
        cell.kind === "digit" ? (
          <span key={i} className="tb-dg" aria-hidden>
            <span style={{ transform: `translateY(${-1.15 * cell.digit}em)` }}>
              {DIGITS.map((d) => (
                <b key={d}>{d}</b>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden>
            {cell.text}
          </span>
        ),
      )}
    </span>
  );
}

type LevelMeterProps = {
  /** Recent microphone levels, 0..1, oldest first. */
  levels: number[];
  live?: boolean;
  className?: string;
};

export function LevelMeter({
  levels,
  live = false,
  className,
}: LevelMeterProps) {
  return (
    <div className={cx("tb-level", live && "tb-live", className)} aria-hidden>
      {levels.map((level, i) => (
        <i key={i} style={{ height: `${Math.round(20 + level * 80)}%` }} />
      ))}
    </div>
  );
}
