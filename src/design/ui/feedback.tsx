import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../lib/cx";

export type Tone = "info" | "ok" | "warn" | "err";

const TONE_ICON: Record<Tone, IconName> = {
  info: "info",
  ok: "check",
  warn: "alert",
  err: "alert",
};

type AlertProps = {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  /** A button on the right, e.g. «Добавить ключ». */
  action?: ReactNode;
  className?: string;
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: AlertProps) {
  return (
    <div
      className={cx("tb-alert", `tb-${tone}`, className)}
      role={tone === "err" ? "alert" : "status"}
    >
      <Icon name={TONE_ICON[tone]} />
      <div>
        {title ? <b>{title}</b> : null}
        {children}
      </div>
      {action ? <div className="tb-alert-a">{action}</div> : null}
    </div>
  );
}

type BadgeProps = {
  tone?: "ok" | "warn" | "err" | "neutral" | "ink";
  children: ReactNode;
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return <span className={cx("tb-badge", `tb-${tone}`)}>{children}</span>;
}

export function Tag({
  icon,
  children,
}: {
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className="tb-tag">
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  on?: boolean;
  icon?: IconName;
};

/** Filter chip: ink when on. */
export function Chip({
  on = false,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      className={cx("tb-chip", on && "tb-on", className)}
      aria-pressed={on}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="tb-chips">{children}</div>;
}

type ProgressProps = {
  /** 0..1 */
  value: number;
  label: string;
  className?: string;
};

export function Progress({ value, label, className }: ProgressProps) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={cx("tb-progress", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return <span className="tb-spinner" role="status" aria-label={label} />;
}

type EmptyProps = {
  icon: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
};

/** Empty list or empty search: what is missing and what to do. */
export function Empty({ icon, title, children, action }: EmptyProps) {
  return (
    <div className="tb-empty">
      <Icon name={icon} />
      <b>{title}</b>
      {children ? <div>{children}</div> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}
