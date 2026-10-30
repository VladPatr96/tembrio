import type { ReactNode } from "react";
import { cx } from "../lib/cx";

type SettingsGroupProps = {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** A white card of setting rows with a small caps title. */
export function SettingsGroup({
  title,
  children,
  className,
}: SettingsGroupProps) {
  return (
    <section className={cx("tb-group", className)}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  );
}

type SettingRowProps = {
  title: ReactNode;
  hint?: ReactNode;
  /** The control on the right: a switch, a select, a button. */
  children?: ReactNode;
};

export function SettingRow({ title, hint, children }: SettingRowProps) {
  return (
    <div className="tb-srow">
      <div className="tb-sl">
        <b>{title}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
      {children ? <div className="tb-sc">{children}</div> : null}
    </div>
  );
}

export function Columns({ children }: { children: ReactNode }) {
  return <div className="tb-cols">{children}</div>;
}
