import { useTranslation } from "react-i18next";
import { IconButton } from "@/design";
import { useSettings } from "@/hooks/useSettings";
import { applyTheme } from "@/lib/utils/theme";
import type { Theme } from "@/bindings";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/**
 * One button that walks light → dark → like the system, as the prototype's
 * small theme control does. The choice is stored in settings and mirrored to
 * localStorage by `applyTheme`, so the next launch starts in the right theme.
 */
export function ThemeButton() {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const theme: Theme = settings?.theme ?? "system";

  return (
    <IconButton
      icon="theme"
      label={t("shell.theme.cycle", { current: t(`theme.options.${theme}`) })}
      onClick={() => {
        const next = NEXT[theme];
        applyTheme(next);
        updateSetting("theme", next);
      }}
    />
  );
}
