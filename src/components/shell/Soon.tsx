import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "@/design";

/**
 * A tab that has its place in the shell but no screen yet. It says what will
 * live here and when, so a missing section never looks like a bug.
 */
export function Soon({
  icon,
  titleKey,
  textKey,
}: {
  icon: IconName;
  titleKey: string;
  textKey: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="tb-view">
      <div className="tb-soon">
        <span className="tb-soon-ic">
          <Icon name={icon} />
        </span>
        <h2>{t(titleKey)}</h2>
        <p>{t(textKey)}</p>
        <p className="tb-soon-when">{t("shell.soon.when")}</p>
      </div>
    </div>
  );
}
