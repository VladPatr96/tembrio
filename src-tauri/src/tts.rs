//! Text-to-speech: read the selected text aloud with an OpenRouter voice.
//!
//! The flow is `speak_selection` → copy the selection (clipboard.rs) →
//! `synthesize` (POST /audio/speech, always `pcm`) → `play` on the output
//! device. Every OpenRouter speech model returns raw 16-bit PCM and states the
//! sample rate in the Content-Type (`audio/pcm;rate=24000;channels=1`), so no
//! decoder and no per-model format table are needed.

use crate::settings::{get_settings, write_settings};
use log::{error, info};
use rodio::buffer::SamplesBuffer;
use rodio::Player;
use serde::Serialize;
use specta::Type;
use std::num::NonZero;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::AppHandle;

const SPEECH_URL: &str = "https://openrouter.ai/api/v1/audio/speech";
const MODELS_URL: &str = "https://openrouter.ai/api/v1/models?output_modalities=speech";
const SAMPLE_TEXT: &str = "Проверка голоса. Так Tembrio будет читать выделенный текст.";

/// The player of the phrase being read, kept so a second press can stop it.
static CURRENT: Mutex<Option<Arc<Player>>> = Mutex::new(None);

/// Decoded speech ready for playback.
pub struct Speech {
    pub samples: Vec<f32>,
    pub rate: u32,
    pub channels: u16,
}

/// Stops the phrase being read. Returns true if something was playing.
pub fn stop_speaking() -> bool {
    let player = CURRENT.lock().unwrap_or_else(|e| e.into_inner()).take();
    match player {
        Some(player) => {
            player.stop();
            info!("tts: stopped");
            true
        }
        None => false,
    }
}

/// Decides what to read: the selection, or something else when nothing was
/// selected. `clipboard` is what the clipboard held before the copy.
fn choose_text_to_speak(selection: Option<String>, clipboard: Option<String>) -> Option<String> {
    // Nothing selected — stay silent: reading the clipboard instead could say aloud
    // something copied long ago (a password, say). The clipboard gets its own hotkey later.
    let _ = clipboard;
    selection
}

/// Copies the selection, synthesizes it and plays it. Runs on its own thread:
/// the copy waits for the hotkey to be released and the request takes seconds.
pub fn speak_selection(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let (selection, clipboard) = match crate::clipboard::copy_selection(&app) {
            Ok(result) => result,
            Err(e) => {
                error!("tts: could not copy the selection: {e}");
                return;
            }
        };
        let Some(text) = choose_text_to_speak(selection, clipboard) else {
            info!("tts: nothing selected");
            return;
        };
        if let Err(e) = tauri::async_runtime::block_on(speak_text(&app, &text)) {
            error!("tts: {e}");
        }
    });
}

/// The OpenRouter key: the one saved for post-processing, else OPENROUTER_API_KEY.
fn openrouter_key(app: &AppHandle) -> Result<String, String> {
    get_settings(app)
        .post_process_api_keys
        .get("openrouter")
        .filter(|key| !key.is_empty())
        .cloned()
        .or_else(|| std::env::var("OPENROUTER_API_KEY").ok().filter(|k| !k.is_empty()))
        .ok_or_else(|| "OpenRouter key is not set".to_string())
}

/// Synthesizes `text` with the configured model and voice, then plays it to the end.
async fn speak_text(app: &AppHandle, text: &str) -> Result<(), String> {
    let api_key = openrouter_key(app)?;
    let settings = get_settings(app);
    info!(
        "tts: {} chars, model {}, voice {}",
        text.chars().count(),
        settings.tts_model,
        settings.tts_voice
    );
    let speech = synthesize(&api_key, &settings.tts_model, &settings.tts_voice, text).await?;
    let output_device = settings.selected_output_device.clone();
    tauri::async_runtime::spawn_blocking(move || play(speech, output_device))
        .await
        .map_err(|e| format!("playback thread failed: {e}"))?
}

/// A speech model as shown in the settings window.
#[derive(Serialize, Type, Clone, Debug)]
pub struct TtsModel {
    pub id: String,
    pub name: String,
    pub voices: Vec<String>,
    /// USD per 1000 characters; 0 for free models.
    pub price_per_1k_chars: f64,
}

/// OpenRouter speech models, cheapest first.
#[tauri::command]
#[specta::specta]
pub async fn fetch_tts_models() -> Result<Vec<TtsModel>, String> {
    let json: serde_json::Value = reqwest::Client::new()
        .get(MODELS_URL)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("bad response: {e}"))?;
    let mut models: Vec<TtsModel> = json["data"]
        .as_array()
        .ok_or("no model list in the response")?
        .iter()
        .filter_map(|m| {
            Some(TtsModel {
                id: m["id"].as_str()?.to_string(),
                name: m["name"].as_str().unwrap_or_default().to_string(),
                voices: m["supported_voices"]
                    .as_array()
                    .map(|v| v.iter().filter_map(|x| x.as_str().map(str::to_string)).collect())
                    .unwrap_or_default(),
                // `prompt` is the price of one input character.
                price_per_1k_chars: m["pricing"]["prompt"]
                    .as_str()
                    .and_then(|p| p.parse::<f64>().ok())
                    .unwrap_or(0.0)
                    * 1000.0,
            })
        })
        .collect();
    models.sort_by(|a, b| {
        a.price_per_1k_chars
            .total_cmp(&b.price_per_1k_chars)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(models)
}

/// Switches the speech model; `voice` is the voice to use with it (models have
/// different voice sets, so both change together).
#[tauri::command]
#[specta::specta]
pub fn change_tts_model_setting(app: AppHandle, model: String, voice: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.tts_model = model;
    settings.tts_voice = voice;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_tts_voice_setting(app: AppHandle, voice: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.tts_voice = voice;
    write_settings(&app, settings);
    Ok(())
}

/// Reads a sample phrase with the current model and voice; the error, if any,
/// goes back to the settings window.
#[tauri::command]
#[specta::specta]
pub async fn test_tts_voice(app: AppHandle) -> Result<(), String> {
    stop_speaking();
    speak_text(&app, SAMPLE_TEXT).await
}

#[tauri::command]
#[specta::specta]
pub fn stop_tts() {
    stop_speaking();
}

/// Reads `rate` and `channels` from `audio/pcm;rate=24000;channels=1`.
/// Missing parameters fall back to 24 kHz mono — what most models return.
pub fn parse_pcm_format(content_type: &str) -> (u32, u16) {
    let mut rate = 24_000;
    let mut channels = 1;
    for part in content_type.split(';').skip(1) {
        let Some((name, value)) = part.trim().split_once('=') else {
            continue;
        };
        match name.trim() {
            "rate" => rate = value.trim().parse().unwrap_or(rate),
            "channels" => channels = value.trim().parse().unwrap_or(channels),
            _ => {}
        }
    }
    (rate, channels)
}

/// Converts little-endian 16-bit PCM bytes to samples in -1.0..1.0.
pub fn pcm16_to_samples(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(2)
        .map(|pair| i16::from_le_bytes([pair[0], pair[1]]) as f32 / 32768.0)
        .collect()
}

pub async fn synthesize(
    api_key: &str,
    model: &str,
    voice: &str,
    text: &str,
) -> Result<Speech, String> {
    let mut body = serde_json::json!({ "model": model, "input": text, "response_format": "pcm" });
    // Most providers reject a request without a voice ("An explicit voice is required").
    if !voice.is_empty() {
        body["voice"] = serde_json::Value::String(voice.to_string());
    }
    let response = reqwest::Client::new()
        .post(SPEECH_URL)
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://github.com/VladPatr96/tembrio")
        .header("X-Title", "Tembrio")
        .timeout(Duration::from_secs(120))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("reading the response failed: {e}"))?;
    if !status.is_success() {
        let message = serde_json::from_slice::<serde_json::Value>(&bytes)
            .ok()
            .and_then(|json| json["error"]["message"].as_str().map(str::to_string))
            .unwrap_or_else(|| String::from_utf8_lossy(&bytes).into_owned());
        return Err(format!("OpenRouter {status}: {message}"));
    }
    if bytes.is_empty() {
        return Err("OpenRouter returned no audio".into());
    }
    let (rate, channels) = parse_pcm_format(&content_type);
    Ok(Speech {
        samples: pcm16_to_samples(&bytes),
        rate,
        channels,
    })
}

/// Plays speech to the end (or until `stop_speaking`) on the chosen output device.
pub fn play(speech: Speech, output_device: Option<String>) -> Result<(), String> {
    let rate = NonZero::new(speech.rate).ok_or("sample rate 0")?;
    let channels = NonZero::new(speech.channels).ok_or("0 channels")?;
    let sink = crate::audio_feedback::open_output_sink(output_device).map_err(|e| e.to_string())?;
    let player = Arc::new(Player::connect_new(sink.mixer()));
    player.append(SamplesBuffer::new(channels, rate, speech.samples));
    // A phrase started while another plays replaces it.
    if let Some(previous) = CURRENT
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .replace(player.clone())
    {
        previous.stop();
    }
    player.sleep_until_end();
    let mut current = CURRENT.lock().unwrap_or_else(|e| e.into_inner());
    if current.as_ref().is_some_and(|p| Arc::ptr_eq(p, &player)) {
        *current = None;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse_pcm_format, pcm16_to_samples};

    #[test]
    fn reads_rate_and_channels_from_content_type() {
        assert_eq!(parse_pcm_format("audio/pcm;rate=44100;channels=1"), (44_100, 1));
        assert_eq!(parse_pcm_format("audio/pcm; rate=24000; channels=2"), (24_000, 2));
        assert_eq!(parse_pcm_format("audio/pcm"), (24_000, 1));
        assert_eq!(parse_pcm_format("audio/pcm;rate=abc"), (24_000, 1));
    }

    /// Real request to OpenRouter: `OPENROUTER_API_KEY=… cargo test --lib -- --ignored live_speech`
    #[test]
    #[ignore]
    fn live_speech() {
        let key = std::env::var("OPENROUTER_API_KEY").expect("OPENROUTER_API_KEY");
        let speech = tauri::async_runtime::block_on(super::synthesize(
            &key,
            "google/gemini-3.8-flash-tts",
            "Achird",
            "Проверка голоса Tembrio.",
        ))
        .expect("speech");
        let seconds = speech.samples.len() as f32 / speech.rate as f32 / speech.channels as f32;
        println!("rate {} channels {} seconds {seconds:.2}", speech.rate, speech.channels);
        assert!(seconds > 0.5);
    }

    #[test]
    fn converts_pcm16_to_unit_range() {
        let samples = pcm16_to_samples(&[0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x01]);
        assert_eq!(samples.len(), 3);
        assert_eq!(samples[0], 0.0);
        assert!((samples[1] - 1.0).abs() < 0.001);
        assert_eq!(samples[2], -1.0);
    }
}
