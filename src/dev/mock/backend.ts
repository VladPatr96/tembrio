import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import type { AppSettings, ModelInfo } from "@/bindings";
import defaultSettings from "./default-settings.json";

/*
 * A stand-in for the Rust side so the UI runs in a plain browser:
 * `bun run dev:mock` for looking at screens without a build, and the
 * Playwright scenarios. Commands answer from in-memory fixtures; events are
 * delivered with the real `listen` because `shouldMockEvents` is on.
 *
 * Tests drive it through `window.__TEMBRIO_MOCK__` (see MockControl).
 */

// Typed against the bindings: when AppSettings gains a field, tsc flags this
// line — regenerate the JSON with
// `cargo test --lib write_mock_default_settings -- --ignored`.
const DEFAULTS: AppSettings = defaultSettings as AppSettings;

const MODELS: ModelInfo[] = [
  {
    id: "parakeet-tdt-0.6b-v3",
    name: "Parakeet V3",
    description: "Fast and accurate",
    filename: "parakeet-tdt-0.6b-v3-int8",
    source: "Local",
    size_mb: 478,
    is_downloaded: true,
    is_downloading: false,
    partial_size: 0,
    accuracy_score: 0.85,
    speed_score: 0.85,
    supports_translation: false,
    is_recommended: true,
    supported_languages: ["en", "ru"],
    supports_language_selection: false,
    is_custom: false,
    supports_streaming: false,
    supports_language_detection: true,
  },
];

export type MockScenario = "returning" | "new";

export type MockCall = { cmd: string; args: unknown };

export type MockControl = {
  /** Deliver a backend event to every `listen` in the page. */
  emit: (event: string, payload?: unknown) => Promise<void>;
  /** Commands the UI has called, oldest first. */
  calls: MockCall[];
  settings: () => AppSettings;
  patchSettings: (patch: Partial<AppSettings>) => void;
};

declare global {
  interface Window {
    __TEMBRIO_MOCK__?: MockControl;
  }
}

/** Commands that only change state on the Rust side answer with nothing. */
const FIRE_AND_FORGET =
  /^(change_|set_|update_|initialize_|show_|hide_|start_|stop_|cancel_|delete_|reset_|suspend_|resume_|add_|remove_|open_|play_|test_|register_|unregister_)/;

export function installMockBackend(scenario: MockScenario = "returning") {
  let settings: AppSettings = {
    ...DEFAULTS,
    onboarding_completed: scenario === "returning",
  };
  const calls: MockCall[] = [];

  window.__TAURI_OS_PLUGIN_INTERNALS__ = {
    platform: "windows",
    os_type: "windows",
    family: "windows",
    version: "10.0.26100",
    arch: "x86_64",
    eol: "\r\n",
    exe_extension: "exe",
  };
  mockWindows("main");

  const answers: Record<string, () => unknown> = {
    get_app_settings: () => settings,
    get_default_settings: () => DEFAULTS,
    get_available_models: () => MODELS,
    get_current_model: () => MODELS[0].id,
    get_retired_models: () => [],
    has_any_models_available: () => true,
    get_available_microphones: () => [
      { index: "default", name: "Default", is_default: true },
    ],
    get_available_output_devices: () => [
      { index: "default", name: "Default", is_default: true },
    ],
    get_windows_microphone_permission_status: () => ({
      supported: true,
      overall_access: "allowed",
      device_access: "allowed",
      app_access: "allowed",
      desktop_app_access: "allowed",
    }),
    "plugin:app|version": () => "0.0.0-mock",
    "plugin:app|name": () => "Tembrio",
    "plugin:autostart|is_enabled": () => false,
    "plugin:updater|check": () => null,
  };

  mockIPC(
    (cmd, args) => {
      calls.push({ cmd, args });
      const answer = answers[cmd];
      if (answer) return answer();
      if (FIRE_AND_FORGET.test(cmd) || cmd.startsWith("plugin:")) return null;
      console.warn(`[mock] no answer for "${cmd}"`, args);
      return null;
    },
    { shouldMockEvents: true },
  );

  window.__TEMBRIO_MOCK__ = {
    emit: (event, payload) => emit(event, payload),
    calls,
    settings: () => settings,
    patchSettings: (patch) => {
      settings = { ...settings, ...patch };
    },
  };
}
