import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
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

/**
 * Voices of the speech catalog, grouped by model.
 *
 * A voice belongs to a model: «meredith» exists on one OpenAI model and means
 * nothing to Google's. Flattening every voice into one list — which the panel
 * did at first — offered names the current model answers with a 400, so picking
 * one looked like the picker was broken.
 */
function useVoiceGroups() {
  const [groups, setGroups] = useState<TtsModel[]>([]);
  useEffect(() => {
    let alive = true;
    void commands.fetchTtsModels().then((result) => {
      if (!alive || result.status !== "ok") return;
      setGroups(result.data as TtsModel[]);
    });
    return () => {
      alive = false;
    };
  }, []);
  return groups;
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

/*
 * Hide the panel only *after* the command has been sent: a hidden WebView2 may
 * suspend its page, and an invoke that has not left the page yet dies with it —
 * which looked like «the panel closes and nothing happens».
 */
const run = (command: () => Promise<unknown>) => {
  void command();
  void commands.hideTrayPanel();
};
const close = () => void commands.hideTrayPanel();

/** `google/gemini-3.8-flash-tts` → «gemini-3.8-flash-tts», the part people read. */
function modelLabel(model?: string): string {
  if (!model) return "";
  const tail = model.split("/").pop() ?? model;
  // `gemini-3.8-flash-tts` → `gemini-3.8-flash`; `heygen-voice-1-turbo:free` →
  // `heygen-voice-1-turbo` — the «:free» tag is a price, not a name.
  return tail.replace(/-tts$/, "").replace(/:free$/, "");
}

export function TrayPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("panel");
  const settings = useSettings();
  const sound = useSoundState();
  const groups = useVoiceGroups();

  useEffect(() => {
    const unlisten = listen<Mode>("tray-panel", (event) =>
      setMode(event.payload),
    );
    // Escape closes the panel, as with any popover.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
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
  // The dot's colour comes from this one attribute: kit.css paints it grey while
  // idle, the sound gradient while reading and coral while the mic is open.
  const dot = speaking
    ? "speaking"
    : sound?.kind === "preparing"
      ? "preparing"
      : sound?.kind === "message"
        ? "message"
        : "idle";
  const stateLabel = speaking
    ? paused
      ? t("trayPanel.state.paused")
      : t("trayPanel.state.speaking")
    : sound?.kind === "preparing"
      ? t("trayPanel.state.preparing")
      : t("trayPanel.state.idle");

  // A pick is a model *and* a voice: choosing «meredith» means switching to the
  // model that has her, or the request fails on the current one.
  const picked = `${settings?.tts_model ?? ""}::${voice}`;
  const known = groups.some((group) => group.id === settings?.tts_model);
  const setPicked = useCallback(
    (next: string) => {
      const [model, name] = next.split("::");
      if (!model || !name) return;
      if (model === settings?.tts_model) {
        void commands.changeTtsVoiceSetting(name);
        return;
      }
      void commands.changeTtsModelSetting(model, name);
    },
    [settings?.tts_model],
  );

  // Spent today is filled by the costs stage; until then the panel says «$0.00»
  // rather than inventing a number.
  const today = useMemo(() => formatMoney(0, "usd", 0), []);

  // The window follows the sheet, not the other way round: the page is the only
  // one who knows the real size (system text scaling, longer translations, a
  // wrapping voice name). Measured after paint, once per change.
  const sheet = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      // 6 px margin on each side, as .tp-root pads.
      void commands.resizeTrayPanel(
        Math.ceil(rect.width) + 12,
        Math.ceil(rect.height) + 12,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode, voice, speaking, paused]);

  if (mode === "menu") {
    return (
      <div className="tp-root">
        <div className="tb-traymenu tp-menu" role="menu" ref={sheet}>
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
            onClick={() => run(() => commands.speakClipboardCommand())}
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
            onClick={() => run(() => commands.pauseTts())}
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
    <div className="tp-root" data-sound={dot}>
      <div className="tb-traypop tp-panel" ref={sheet}>
        <div className="tb-tph">
          <span className="tp-logo">
            <Wordmark />
          </span>
          <span className="tb-state">
            <i aria-hidden />
            {stateLabel}
          </span>
          <button
            type="button"
            className="tp-hide"
            onClick={close}
            aria-label={t("trayPanel.hide")}
            title={t("trayPanel.hide")}
          >
            <Icon name="x" />
          </button>
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
            value={picked}
            aria-label={t("trayPanel.voice")}
            onChange={(event) => setPicked(event.target.value)}
          >
            {/* The stored voice may be missing from the catalog (an old model, a
                key without that model). Keep it visible so the picker shows the
                truth instead of silently picking someone else. */}
            {known ? null : <option value={picked}>{voice}</option>}
            {groups.map((group) => (
              <optgroup key={group.id} label={modelLabel(group.id)}>
                {group.voices.map((name) => (
                  <option key={name} value={`${group.id}::${name}`}>
                    {name}
                  </option>
                ))}
              </optgroup>
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
            onClick={() => run(() => commands.speakClipboardCommand())}
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
            onClick={() => run(() => commands.startDictationCommand())}
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
