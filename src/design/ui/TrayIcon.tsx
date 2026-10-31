import { cx } from "../lib/cx";

/** The five tray states, as the v5 prototype draws them. */
export type TrayState =
  | "idle"
  | "recording"
  | "speaking"
  | "transcribing"
  | "warn";

const DOT: Record<TrayState, string | null> = {
  idle: null,
  // Recording pulses in the app; on a still shelf the dot simply stays red.
  recording: "#FF6B6B",
  speaking: null,
  transcribing: "#9A93A8",
  warn: "#F2B25C",
};

type TrayIconProps = {
  state?: TrayState;
  /** Dark taskbar or light: the art is drawn in both colours. */
  tone?: "on-dark" | "on-light";
  className?: string;
};

/**
 * The tray icon: the Tembrio fork with a state dot, and the sound gradient while
 * a voice is heard. It mirrors `src-tauri/resources/tray_*.png` (drawn by
 * `dev/make-tray-icons.py`) — one shape, so the shelf, the documentation and the
 * real taskbar always agree.
 */
export function TrayIcon({
  state = "idle",
  tone = "on-light",
  className,
}: TrayIconProps) {
  const dot = DOT[state];
  const stroke =
    state === "speaking"
      ? "url(#tb-tray-sg)"
      : tone === "on-dark"
        ? "#F2EEE7"
        : "#1F1B2D";
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx("tb-trayicon", className)}
      data-state={state}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <defs>
        <linearGradient id="tb-tray-sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.5" stopColor="#C86BD9" />
          <stop offset="1" stopColor="#FF8A5C" />
        </linearGradient>
      </defs>
      <path
        d="M4 4h6v6a2 2 0 0 0 4 0V4h6M12 12v8"
        stroke={stroke}
        strokeWidth={2}
      />
      {dot ? <circle cx={19} cy={19.5} r={3.2} fill={dot} /> : null}
    </svg>
  );
}
