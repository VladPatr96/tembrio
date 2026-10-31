import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Icon,
  Kbd,
  Range,
  VoicePortrait,
  Wordmark,
  formatMoney,
} from "@/design";
import { commands, type AppSettings, type TtsModel } from "@/bindings";

/*
 * The glass panel at the tray icon. One page, two looks: the panel (left click)
 * and the short menu (right click) — Rust resizes the window and says which one
 * to draw (see src-tauri/src/tray_panel.rs).
 */

type Mode = "panel" | "menu";

/** The `sound-state` payload (src-tauri/src/sound_state.rs). */
interface SoundStateEvent {
  kind: "idle" | "preparing" | "speaking" | "message";
  paused?: boolean;
  voice?: string;
}

/** «Читает», «отдыхает», «пишет» — what the dot in the header says. */
function useSoundState() {
  const [state, setState] = useState<SoundStateEvent | null>(null);
  useEffect(() => {
    const unlisten = listen<SoundStateEvent>("sound-state", (event) =>
      setState(event.payload),
    );
    // Ask for a fresh state when the panel opens: it may have been hidden for a
    // long time and its last known state is stale.
    void commands
      .getAppSettings()
      .then(() => undefined)
      .catch(() => undefined);
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);
  return state;
}

function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void commands.getAppSettings().then((result) => {
        if (alive && result.status === "ok") setSettings(result.data);
      });
    read();
    const unlisten = listen("settings-changed", read);
    return () => {
      alive = false;
      void unlisten.then((off) => off());
    };
  }, []);
  return settings;
}

/** Voice names for the picker, from the speech catalog. */
function useVoices() {
  const [voices, setVoices] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void commands.fetchTtsModels().then((result) => {
      if (!alive || result.status !== "ok") return;
      const all = (result.data as TtsModel[]).flatMap((model) => model.voices);
      setVoices([...new Set(all)]);
    });
    return () => {
      alive = false;
      void unlisten?.();
    };
    function unlisten() {
      alive = false;
    }
  }, []);
  return voices;
}

/** A binding as keycaps, e.g. `Ctrl+Alt+S` → three keys. */
function Keys({ binding }: { binding?: string }) {
  if (!binding) return null;
  const keys = binding.split("+").map((part) => {
    const name = part.trim().toLowerCase();
    if (name === "ctrl" || name === "control") return "Ctrl";
    if (name === "alt" || name === "option") return "Alt";
    if (name === "shift") return "Shift";
    if (name === "space") return "Space";
    if (name === "super" || name === "meta" || name === "cmd") return "Win";
    return name.length === 1 ? name.toUpperCase() : name;
  });
  return (
    <>
      {keys.map((key, i) => (
        <Kbd key={`${key}-${i}`}>{key}</Kbd>
      ))}
    </>
  );
}

function bindingOf(
  settings: AppSettings | null,
  id: string,
): string | undefined {
  const entry = settings?.bindings?.[id as keyof AppSettings["bindings"]];
  return entry?.current_binding ?? undefined;
}

const close = () => void commands.hideTrayPanel();

/** `google/gemini-3.8-flash-tts` → «gemini-3.8-flash-tts», the part people read. */
function modelLabel(model?: string): string {
  if (!model) return "";
  const tail = model.split("/").pop() ?? model;
  return tail.replace(/-tts$/, "");
}

export function TrayPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("panel");
  const settings = useSettings();
  const sound = useSoundState();
  const voices = useVoices();

  useEffect(() => {
    const unlisten = listen<Mode>("tray-panel", (event) =>
      setMode(event.payload),
    );
    // Escape closes the panel, as with any popover.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    void getCurrentWindow()
      .isVisible()
      .then(() => undefined)
      .catch(() => undefined);
    return () => {
      window.removeEventListener("keydown", onKey);
      void unlisten.then((off) => off());
    };
  }, []);

  const voice = settings?.tts_voice ?? "";
  // Speed is per-reading and lives with the voices (stage 4); the panel shows
  // the setting's value and remembers a change for the current session.
  const [speed, setSpeed] = useState(1.1);
  const speaking = sound?.kind === "speaking";
  const paused = Boolean(sound?.paused);
  const stateLabel = speaking
    ? paused
      ? t("trayPanel.state.paused")
      : t("trayPanel.state.speaking")
    : t("trayPanel.state.idle");

  const setVoice = useCallback((next: string) => {
    void commands.changeTtsVoiceSetting(next);
  }, []);

  // Spent today is filled by the costs stage; until then the panel says «$0.00»
  // rather than inventing a number.
  const today = useMemo(() => formatMoney(0, "usd", 0), []);

  if (mode === "menu") {
    return (
      <div className="tp-root">
        <div className="tb-traymenu tp-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void commands.showMainWindowCommand();
            }}
          >
            {t("trayPanel.menu.open")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void commands.speakClipboardCommand();
            }}
          >
            {t("trayPanel.menu.clipboard")}
            <span>
              {bindingOf(settings, "speak_clipboard") ? (
                <Keys binding={bindingOf(settings, "speak_clipboard")} />
              ) : (
                t("trayPanel.shortNoKey")
              )}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void commands.pauseTts();
            }}
          >
            {t("trayPanel.menu.pause")}
            <span>
              <Keys binding={bindingOf(settings, "pause_speech")} />
            </span>
          </button>
          <hr />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void commands.showMainWindowCommand();
            }}
          >
            {t("trayPanel.menu.voice")}
            <b className="tp-menu-voice">{voice}</b>
            <span>›</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void commands.showMainWindowCommand();
            }}
          >
            {t("trayPanel.menu.settings")}
          </button>
          <hr />
          <button type="button" role="menuitem" onClick={() => close()}>
            {t("trayPanel.menu.quit")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tp-root">
      <div className="tb-traypop tp-panel">
        <div className="tb-tph">
          <span className="tp-logo">
            <Wordmark />
          </span>
          <span
            className="tb-state"
            data-sound={speaking ? "speaking" : undefined}
          >
            <i aria-hidden />
            {stateLabel}
          </span>
        </div>

        <div className="tb-tpv">
          <VoicePortrait
            voiceId={voice.toLowerCase()}
            bars={14}
            playing={speaking}
          />
          <div>
            <b>{voice || t("trayPanel.noVoice")}</b>
            <small title={settings?.tts_model ?? ""}>
              {modelLabel(settings?.tts_model)}
            </small>
          </div>
          <select
            className="tb-field"
            value={voice}
            aria-label={t("trayPanel.voice")}
            onChange={(event) => setVoice(event.target.value)}
          >
            {voices.length === 0 ? (
              <option value={voice}>{voice}</option>
            ) : null}
            {voices.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="tb-tps">
          <span>{t("trayPanel.speed")}</span>
          <Range
            value={speed}
            min={0.5}
            max={1.5}
            step={0.05}
            aria-label={t("trayPanel.speed")}
            onChange={setSpeed}
          />
          <b>{speed.toFixed(2)}×</b>
        </div>

        <div className="tb-tpa">
          <button
            type="button"
            onClick={() => {
              close();
              void commands.speakClipboardCommand();
            }}
          >
            <b>
              <Icon name="speaker" /> {t("trayPanel.readClipboard")}
            </b>
            {bindingOf(settings, "speak_selection") ? (
              <span className="tp-hint">
                <Keys binding={bindingOf(settings, "speak_selection")} />
              </span>
            ) : (
              t("trayPanel.shortNoKey")
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              void commands.showMainWindowCommand();
            }}
          >
            <b>
              <Icon name="microphone" /> {t("trayPanel.dictate")}
            </b>
            <span className="tp-hint">
              <Keys binding={bindingOf(settings, "transcribe")} />
            </span>
          </button>
        </div>

        <div className="tb-tpf">
          <Keys binding={bindingOf(settings, "speak_selection")} />
          <span className="tp-today">
            {t("trayPanel.today")} <b>{today}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
