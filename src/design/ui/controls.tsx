import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../lib/cx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "md" | "sm";
  icon?: IconName;
  /** «Listen» buttons get the sound ring while their voice plays. */
  playing?: boolean;
};

/** Buttons are ink at rest; only a playing «Listen» button shows sound. */
export function Button({
  variant = "default",
  size = "md",
  icon,
  playing,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "tb-btn",
        variant !== "default" && `tb-${variant}`,
        size === "sm" && "tb-sm",
        playing !== undefined && "tb-listen",
        playing && "tb-playing",
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  /** Required: an icon-only button needs a spoken name. */
  label: string;
};

export function IconButton({
  icon,
  label,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx("tb-icon-btn tb-tip", className)}
      aria-label={label}
      data-tip={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

type PlayButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  playing: boolean;
  label: string;
};

/** Round play/stop button; filled with the sound gradient while playing. */
export function PlayButton({
  playing,
  label,
  className,
  type = "button",
  ...rest
}: PlayButtonProps) {
  return (
    <button
      type={type}
      className={cx("tb-play", playing && "tb-on", className)}
      aria-label={label}
      aria-pressed={playing}
      {...rest}
    >
      <Icon name={playing ? "stop" : "play"} />
    </button>
  );
}

type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role"
> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function Switch({
  checked,
  onChange,
  label,
  className,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      className={cx("tb-sw", className)}
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      {...rest}
    />
  );
}

type SegmentedProps<T extends string> = {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cx("tb-seg", className)}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={cx(option.value === value && "tb-on")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  children: ReactNode;
};

export function Checkbox({ children, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx("tb-chk", className)}>
      <input type="checkbox" {...rest} />
      {children}
    </label>
  );
}

type RangeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "min" | "max"
> & {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

/** Slider; the filled part of the track is drawn from the --p variable. */
export function Range({
  value,
  min,
  max,
  onChange,
  className,
  style,
  ...rest
}: RangeProps) {
  const filled = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className={cx("tb-range", className)}
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ ["--p" as string]: `${filled}%`, ...style }}
      {...rest}
    />
  );
}

export function Field({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("tb-field", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("tb-field", className)} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("tb-field", className)} {...rest} />;
}

export function SearchField({
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cx("tb-search", className)}>
      <Icon name="search" />
      <input type="search" className="tb-field" {...rest} />
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="tb-kbd">{children}</kbd>;
}

type HotkeyProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  keys: string[];
  capturing?: boolean;
  /** Shown instead of the keys while capturing, e.g. «Нажмите сочетание…». */
  capturingText?: string;
};

/** Looks of a hotkey field; the capture logic stays in the settings code. */
export function Hotkey({
  keys,
  capturing = false,
  capturingText,
  className,
  type = "button",
  ...rest
}: HotkeyProps) {
  return (
    <button
      type={type}
      className={cx("tb-hotkey", capturing && "tb-capturing", className)}
      {...rest}
    >
      {capturing
        ? capturingText
        : keys.map((key) => <Kbd key={key}>{key}</Kbd>)}
    </button>
  );
}
