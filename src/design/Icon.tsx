import type { ReactElement, SVGProps } from "react";

/*
 * Tembrio icons: the v3 set plus the extras drawn for the v5 prototype, all on
 * a 24px grid with a 2px stroke. Paths carry no stroke colour of their own:
 * they inherit `var(--tb-icon-stroke, currentColor)` from the root, so a
 * sounding icon can switch to the gradient (`url(#tb-sg)`, see
 * SoundGradientDefs) by setting one variable.
 */
const ICONS = {
  "add-voice": (
    <path
      d="M5 5v6a7 7 0 0 0 10 6M10 20v1M18 12v8m-4-4h8"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  autostart: (
    <path
      d="M5 17V7h10M11 4l4 3-4 3M8 20h11V10"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  cloud: (
    <>
      <path
        d="M6 18h11a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 11.5 3.5 3.5 0 0 0 6 18Z"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M10 15c1-1 2-1 3 0" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  copy: (
    <path
      d="M9 7h9v11H9zM6 15H5V5h9v1"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
  dictation: (
    <path
      d="M7 7v5a5 5 0 0 0 10 0V7M12 17v3M7 20h10"
      strokeWidth={2}
      strokeLinecap="round"
    />
  ),
  download: (
    <path
      d="M12 4v10m-4-4 4 4 4-4M5 18h14"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  filter: (
    <path d="M4 6h16M7 12h10m-7 6h4" strokeWidth={2} strokeLinecap="round" />
  ),
  history: (
    <path
      d="M5 7v5a7 7 0 1 0 3-5.7M12 8v5l3 2"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  key: (
    <path
      d="M8 14a4 4 0 1 1 3-3l8-8m-3 3 2 2m-4 0 2 2"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  keyboard: (
    <path
      d="M4 7h16v10H4zM7 10h.01m3 0h.01m3 0h.01m3 0h.01M8 14h8"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  license: (
    <>
      <path d="M7 4h8l3 3v13H7z" strokeWidth={2} strokeLinejoin="round" />
      <path d="M10 13c1-2 3-2 4 0" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  local: (
    <>
      <path
        d="M5 6h14v12H5zM9 10h6v4H9z"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M7 18v1m10-1v1" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  microphone: (
    <path
      d="M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5Zm-3 6a6 6 0 0 0 12 0m-6 6v3m-3 0h6"
      strokeWidth={2}
      strokeLinecap="round"
    />
  ),
  play: (
    <>
      <path d="m9 6 9 6-9 6V6Z" strokeWidth={2} strokeLinejoin="round" />
      <path d="M5 9v6" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  price: (
    <>
      <path d="M5 5h8l6 6-8 8-6-6V5Z" strokeWidth={2} strokeLinejoin="round" />
      <path d="M9 9h.01" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  pronunciation: (
    <>
      <path
        d="M5 6h10a4 4 0 0 1 4 4v6H9l-4 3V6Z"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M9 11c1-2 3-2 4 0s3 2 4 0"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  ),
  refresh: (
    <path
      d="M18 9a6.5 6.5 0 1 0 1 6M18 5v4h-4"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  settings: (
    <>
      <path
        d="M4 7h16M4 17h16M8 4v6m8 4v6"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path
        d="M6 10a3 3 0 0 0 4 0M14 14a3 3 0 0 0 4 0"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  ),
  "speak-selection": (
    <path
      d="M4 6h10M4 10h8M4 14h10M17 9v6m-3-3h6"
      strokeWidth={2}
      strokeLinecap="round"
    />
  ),
  speaker: (
    <path
      d="M5 10h4l5-4v12l-5-4H5zM17 10c2 1 2 3 0 4"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  speed: (
    <path
      d="M5 16a7 7 0 1 1 14 0M12 12l4-3M8 19h8"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  theme: (
    <path
      d="M12 4a8 8 0 1 0 8 8c-5 1-9-3-8-8Z"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  ),
  "tray-idle": (
    <path
      d="M4 4h6v6a2 2 0 0 0 4 0V4h6M12 12v8"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "tray-recording": (
    <path
      d="M5 12h2l2-4 3 8 3-8 2 4h2"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "tray-speaking": (
    <path
      d="M5 10h4l4-3v10l-4-3H5zM16 9c3 2 3 4 0 6"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "tray-transcribing": (
    <path
      d="M6 12a6 6 0 1 1 2 4.5M6 17v-4h4"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "tray-warning": (
    <>
      <path
        d="M4 4h6v6a2 2 0 0 0 4 0V4h6M12 12v8"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path d="M18 16v3m0 2h.01" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  voices: (
    <path
      d="M5 5v7a7 7 0 0 0 14 0V5M12 19v3"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  pause: (
    <path
      d="M8 5v14M16 5v14"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  stop: (
    <rect
      x={6.5}
      y={6.5}
      width={11}
      height={11}
      rx={2.5}
      fill="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  trash: (
    <path
      d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  search: (
    <path
      d="M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  star: (
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "star-filled": (
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
      fill="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  check: (
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  x: (
    <path
      d="M6 6l12 12M18 6L6 18"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  eye: (
    <path
      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  alert: (
    <path
      d="M12 3.5l9.5 17h-19zM12 10v4.5M12 17.5h.01"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  plus: (
    <path
      d="M12 5v14M5 12h14"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  info: (
    <path
      d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v6M12 7.5h.01"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  fork: (
    <path
      d="M6 3v6a6 6 0 0 0 12 0V3M12 15v6"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  sparkle: (
    <path
      d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  wifi: (
    <path
      d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  /** Accessible name; without it the icon is decorative. */
  title?: string;
};

export function Icon({ name, title, className, style, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className ? `tb-i ${className}` : "tb-i"}
      style={{ stroke: "var(--tb-icon-stroke, currentColor)", ...style }}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name]}
    </svg>
  );
}

/** The sound gradient referenced as `url(#tb-sg)`; render once per window. */
export function SoundGradientDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="tb-sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--tb-s1)" />
          <stop offset=".55" stopColor="var(--tb-s2)" />
          <stop offset="1" stopColor="var(--tb-s3)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
