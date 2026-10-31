import { useTranslation } from "react-i18next";
import { IconButton } from "@/design";
import { useSettings } from "@/hooks/useSettings";
import { applyTheme } from "@/lib/utils/theme";
import type { Theme } from "@/bindings";

/**
 * The theme shown right now: while the setting says «like the system» the
 * document carries no `data-theme`, so the OS decides — ask it.
 */
function effectiveTheme(): "light" | "dark" {
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "light" || pinned === "dark") return pinned;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * One button that flips light ⇄ dark, as the prototype's header control does.
 * It never lands on «like the system»: from that setting the first click picks
 * the opposite of what is on screen, so one click is always one visible change.
 * The three-way choice lives in «Общие» → Тема.
 */
export function ThemeButton() {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const theme: Theme = settings?.theme ?? "system";

  return (
    <IconButton
      icon="theme"
      label={t("shell.theme.cycle", { current: t(`theme.options.${theme}`) })}
      // Sits in the top bar, where a CSS tooltip would be clipped by the window.
      tooltip="native"
      onClick={() => {
        const next = effectiveTheme() === "dark" ? "light" : "dark";
        applyTheme(next);
        updateSetting("theme", next);
      }}
    />
  );
}
