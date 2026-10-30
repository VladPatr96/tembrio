import type { IconName } from "@/design";

/**
 * The seven sections of the Tembrio window, in the order of the «Резонанс»
 * prototype. Each one owns a screen; until a stage lands, the old Handy screen
 * sits in that tab so nothing becomes unreachable.
 */

export type TabId =
  | "voices"
  | "dictation"
  | "pronunciation"
  | "history"
  | "models"
  | "costs"
  | "general";

export type Tab = {
  id: TabId;
  labelKey: string;
  icon: IconName;
};

export const TABS: Tab[] = [
  { id: "voices", labelKey: "shell.tabs.voices", icon: "voices" },
  { id: "dictation", labelKey: "shell.tabs.dictation", icon: "dictation" },
  {
    id: "pronunciation",
    labelKey: "shell.tabs.pronunciation",
    icon: "pronunciation",
  },
  { id: "history", labelKey: "shell.tabs.history", icon: "history" },
  { id: "models", labelKey: "shell.tabs.models", icon: "local" },
  { id: "costs", labelKey: "shell.tabs.costs", icon: "price" },
  { id: "general", labelKey: "shell.tabs.general", icon: "settings" },
];
