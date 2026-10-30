import { useTranslation } from "react-i18next";
import { Icon, Kbd, SoundGradientDefs, Wordmark } from "@/design";
import { useSettings } from "@/hooks/useSettings";
import { formatKeyCombination } from "@/lib/utils/keyboard";
import { useOsType } from "@/hooks/useOsType";
import ModelSelector from "../model-selector";
import TranscriptionStatus from "../footer/TranscriptionStatus";
import {
  AboutSettings,
  AdvancedSettings,
  DebugSettings,
  GeneralSettings,
  HistorySettings,
  ModelsSettings,
  PostProcessingSettings,
  TtsSettings,
} from "../settings";
import { ThemeButton } from "./ThemeButton";
import { Soon } from "./Soon";
import { TABS, type TabId } from "./tabs";

/**
 * The window's frame: the logo and the seven tabs on top, the section in the
 * middle, the «now playing» strip at the bottom — the shape of the v5
 * prototype. Each tab still renders the inherited Handy screen until its own
 * stage replaces it with a Tembrio one.
 */

type ShellProps = {
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  /** The strip's status line links to the history tab. */
  onShowHistory: () => void;
  onPreviewOnboarding: () => void;
  onRunOnboarding: () => void;
  onRunModelMigration: () => void;
};

export function Shell({
  tab,
  onTabChange,
  onShowHistory,
  onPreviewOnboarding,
  onRunOnboarding,
  onRunModelMigration,
}: ShellProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const debugOn = settings?.debug_mode ?? false;

  return (
    <div className="tb-root tb-shell">
      <SoundGradientDefs />
      <header className="tb-toolbar">
        <div className="tb-logo">
          <Wordmark />
        </div>
        <nav className="tb-tabs" aria-label={t("shell.tabs.label")}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === tab ? "page" : undefined}
              className={item.id === tab ? "tb-on" : undefined}
              onClick={() => onTabChange(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
        <ThemeButton />
      </header>

      <main className="tb-views">
        {tab === "voices" && <TtsSettings />}
        {tab === "dictation" && <GeneralSettings />}
        {tab === "pronunciation" && (
          <Soon
            icon="pronunciation"
            titleKey="shell.soon.pronunciation.title"
            textKey="shell.soon.pronunciation.text"
          />
        )}
        {tab === "history" && <HistorySettings />}
        {tab === "models" && (
          <ModelsSettings onChangeLanguages={() => onTabChange("dictation")} />
        )}
        {tab === "costs" && (
          <Soon
            icon="price"
            titleKey="shell.soon.costs.title"
            textKey="shell.soon.costs.text"
          />
        )}
        {tab === "general" && (
          <div className="tb-view">
            <AboutSettings />
            <AdvancedSettings />
            {settings?.post_process_enabled ? <PostProcessingSettings /> : null}
            {debugOn ? (
              <DebugSettings
                onPreviewOnboarding={onPreviewOnboarding}
                onRunOnboarding={onRunOnboarding}
                onRunModelMigration={onRunModelMigration}
              />
            ) : null}
          </div>
        )}
      </main>

      <footer className="tb-strip">
        <span className="tb-st-ic">
          <Icon name="speak-selection" />
        </span>
        <div className="tb-st-text">
          <SpeakHint />
        </div>
        <div className="tb-st-right">
          <ModelSelector />
          <TranscriptionStatus onShowHistory={onShowHistory} />
        </div>
      </footer>
    </div>
  );
}

/** What the bottom strip says until a voice is actually playing (next stage). */
function SpeakHint() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const osType = useOsType();
  const binding = settings?.bindings?.speak_selection?.current_binding;
  if (!binding) return <>{t("shell.strip.ready")}</>;
  const keys = formatKeyCombination(binding, osType).split(" + ");
  return (
    <>
      {t("shell.strip.hint")}{" "}
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </>
  );
}
