import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, RefreshCcw, Square } from "lucide-react";
import { commands, type TtsModel } from "@/bindings";
import { Dropdown, SettingContainer, SettingsGroup } from "@/components/ui";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { ApiKeyField } from "../PostProcessingSettingsApi/ApiKeyField";
import { ShortcutInput } from "../ShortcutInput";
import { OutputDeviceSelector } from "../OutputDeviceSelector";
import { useSettings } from "../../../hooks/useSettings";

const formatPrice = (model: TtsModel, free: string) =>
  model.price_per_1k_chars > 0
    ? `$${model.price_per_1k_chars.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} / 1k`
    : free;

export const TtsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, refreshSettings } = useSettings();
  const [models, setModels] = useState<TtsModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const currentModel = getSetting("tts_model") ?? "";
  const currentVoice = getSetting("tts_voice") ?? "";
  const apiKey = getSetting("post_process_api_keys")?.["openrouter"] ?? "";

  const loadModels = useCallback(async () => {
    setLoading(true);
    const result = await commands.fetchTtsModels();
    if (result.status === "ok") {
      setModels(result.data);
      setError(null);
    } else {
      setError(t("settings.tts.errors.models", { message: result.error }));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const model = useMemo(
    () => models.find((m) => m.id === currentModel),
    [models, currentModel],
  );

  const modelOptions = useMemo(() => {
    const options = models.map((m) => ({
      value: m.id,
      label: `${m.name} — ${formatPrice(m, t("settings.tts.free"))}`,
    }));
    // The saved model stays selectable even before the list loads.
    if (currentModel && !models.some((m) => m.id === currentModel)) {
      options.unshift({ value: currentModel, label: currentModel });
    }
    return options;
  }, [models, currentModel, t]);

  const voiceOptions = useMemo(() => {
    const voices = model?.voices ?? [];
    const list = voices.length ? voices : currentVoice ? [currentVoice] : [];
    return list.map((v) => ({ value: v, label: v }));
  }, [model, currentVoice]);

  const selectModel = async (id: string) => {
    const next = models.find((m) => m.id === id);
    // Keep the voice if the new model has it, else take the model's first voice.
    const voices = next?.voices ?? [];
    const voice = voices.includes(currentVoice)
      ? currentVoice
      : (voices[0] ?? "");
    await commands.changeTtsModelSetting(id, voice);
    await refreshSettings();
  };

  const selectVoice = async (voice: string) => {
    await commands.changeTtsVoiceSetting(voice);
    await refreshSettings();
  };

  const saveKey = async (value: string) => {
    if (value === apiKey) return;
    await commands.changePostProcessApiKeySetting("openrouter", value.trim());
    await refreshSettings();
  };

  const testVoice = async () => {
    if (testing) {
      await commands.stopTts();
      return;
    }
    setTesting(true);
    setError(null);
    const result = await commands.testTtsVoice();
    if (result.status === "error") {
      setError(t("settings.tts.errors.test", { message: result.error }));
    }
    setTesting(false);
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup
        title={t("settings.tts.title")}
        description={t("settings.tts.description")}
      >
        <ShortcutInput shortcutId="speak_selection" grouped={true} />
        <SettingContainer
          title={t("settings.tts.model.title")}
          description={t("settings.tts.model.description")}
          descriptionMode="tooltip"
          grouped={true}
        >
          <div className="flex items-center space-x-1">
            <Dropdown
              options={modelOptions}
              selectedValue={currentModel || null}
              onSelect={selectModel}
              placeholder={
                loading
                  ? t("settings.tts.loading")
                  : t("settings.tts.model.placeholder")
              }
              disabled={loading && models.length === 0}
              className="min-w-[320px]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={loadModels}
              disabled={loading}
              title={t("settings.tts.refresh")}
            >
              <RefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </SettingContainer>
        <SettingContainer
          title={t("settings.tts.voice.title")}
          description={t("settings.tts.voice.description")}
          descriptionMode="tooltip"
          grouped={true}
        >
          <Dropdown
            options={voiceOptions}
            selectedValue={currentVoice || null}
            onSelect={selectVoice}
            placeholder={t("settings.tts.voice.placeholder")}
            disabled={voiceOptions.length === 0}
            className="min-w-[200px]"
          />
        </SettingContainer>
        <OutputDeviceSelector descriptionMode="tooltip" grouped={true} />
        <SettingContainer
          title={t("settings.tts.test.title")}
          description={t("settings.tts.test.description")}
          descriptionMode="tooltip"
          grouped={true}
        >
          <Button
            variant="primary"
            size="md"
            onClick={testVoice}
            disabled={!currentModel}
          >
            <span className="flex items-center gap-2">
              {testing ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {testing
                ? t("settings.tts.test.stop")
                : t("settings.tts.test.button")}
            </span>
          </Button>
        </SettingContainer>
      </SettingsGroup>

      {error && <Alert variant="error">{error}</Alert>}

      <SettingsGroup title={t("settings.tts.key.title")}>
        <SettingContainer
          title="OpenRouter"
          description={t("settings.tts.key.description")}
          descriptionMode="inline"
          grouped={true}
        >
          <ApiKeyField
            value={apiKey}
            onBlur={saveKey}
            disabled={false}
            placeholder={t("settings.tts.key.placeholder")}
          />
        </SettingContainer>
      </SettingsGroup>
    </div>
  );
};
