//! Text-to-speech: read the selected text aloud with an OpenRouter voice.
//!
//! The flow is `speak_selection` → copy the selection (clipboard.rs) →
//! `synthesize` (POST /audio/speech, always `pcm`) → `play` on the output
//! device. Every OpenRouter speech model returns raw 16-bit PCM and states the
//! sample rate in the Content-Type (`audio/pcm;rate=24000;channels=1`), so no
//! decoder and no per-model format table are needed.

use crate::managers::audio::AudioRecordingManager;
use crate::overlay;
use crate::settings::{get_settings, write_settings};
use log::{error, info};
use rodio::buffer::SamplesBuffer;
use rodio::Player;
use serde::Serialize;
use specta::Type;
use std::fmt;
use std::num::NonZero;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;
use tauri::{AppHandle, Manager};

const SPEECH_URL: &str = "https://openrouter.ai/api/v1/audio/speech";
const MODELS_URL: &str = "https://openrouter.ai/api/v1/models?output_modalities=speech";
const SAMPLE_TEXT: &str = "Проверка голоса. Так Tembrio будет читать выделенный текст.";

/// The player of the phrase being read, kept so a second press can stop it.
static SESSION: Mutex<Session> = Mutex::new(Session {
    id: 0,
    active: false,
    player: None,
});

/// One reading: from the request to OpenRouter to the end of playback.
/// Stopping bumps `id`, so a synthesis still in flight finds out on return
/// that nobody wants its audio any more.
struct Session {
    id: u64,
    active: bool,
    player: Option<Arc<Player>>,
}

fn session() -> MutexGuard<'static, Session> {
    SESSION.lock().unwrap_or_else(|e| e.into_inner())
}

/// Starts a new reading; one already going is cut off.
fn begin_session() -> u64 {
    let mut s = session();
    if let Some(previous) = s.player.take() {
        previous.stop();
    }
    s.id += 1;
    s.active = true;
    s.id
}

fn is_current(id: u64) -> bool {
    session().id == id
}

fn end_session(id: u64) {
    let mut s = session();
    if s.id == id {
        s.active = false;
        s.player = None;
    }
}

/// Why a reading failed. `overlay_key` is what the pill shows; `Display` is for the log.
#[derive(Debug)]
pub enum SpeechError {
    NoKey,
    Network(String),
    Http { status: u16, message: String },
    NoAudio,
    Playback(String),
}

impl SpeechError {
    /// Key of the short message under `overlay.speech.errors` in the translations.
    pub fn overlay_key(&self) -> &'static str {
        match self {
            SpeechError::NoKey => "noKey",
            SpeechError::Network(_) => "network",
            SpeechError::Http { status: 401, .. } => "badKey",
            SpeechError::Http { status: 402, .. } => "noCredits",
            SpeechError::Http { .. } | SpeechError::NoAudio => "rejected",
            SpeechError::Playback(_) => "playback",
        }
    }
}

impl fmt::Display for SpeechError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SpeechError::NoKey => write!(f, "OpenRouter key is not set"),
            SpeechError::Network(e) => write!(f, "request failed: {e}"),
            SpeechError::Http { status, message } => write!(f, "OpenRouter {status}: {message}"),
            SpeechError::NoAudio => write!(f, "OpenRouter returned no audio"),
            SpeechError::Playback(e) => write!(f, "playback failed: {e}"),
        }
    }
}

/// Decoded speech ready for playback.
pub struct Speech {
    pub samples: Vec<f32>,
    pub rate: u32,
    pub channels: u16,
}

/// Stops the phrase being read. Returns true if something was playing.
pub fn stop_speaking() -> bool {
    let mut s = session();
    let was_active = s.active;
    s.active = false;
    s.id += 1;
    if let Some(player) = s.player.take() {
        player.stop();
    }
    if was_active {
        info!("tts: stopped");
    }
    was_active
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
                show_message(&app, "copyFailed", &e.to_string());
                return;
            }
        };
        let Some(text) = choose_text_to_speak(selection, clipboard) else {
            info!("tts: nothing selected");
            show_message(&app, "nothingSelected", "");
            return;
        };
        // speak_text has already logged and shown the error.
        let _ = tauri::async_runtime::block_on(speak_text(&app, &text));
    });
}

/// The pill belongs to dictation while it records; speech then stays out of it.
fn pill_is_free(app: &AppHandle) -> bool {
    !app.state::<Arc<AudioRecordingManager>>().is_recording()
}

fn show_message(app: &AppHandle, key: &str, detail: &str) {
    if pill_is_free(app) {
        overlay::show_overlay_message(app, key, detail);
    }
}

/// The OpenRouter key: the one saved for post-processing, else OPENROUTER_API_KEY.
fn openrouter_key(app: &AppHandle) -> Result<String, SpeechError> {
    get_settings(app)
        .post_process_api_keys
        .get("openrouter")
        .filter(|key| !key.is_empty())
        .cloned()
        .or_else(|| {
            std::env::var("OPENROUTER_API_KEY")
                .ok()
                .filter(|k| !k.is_empty())
        })
        .ok_or(SpeechError::NoKey)
}

/// Synthesizes `text` with the configured model and voice, then plays it to the end.
/// The pill shows "preparing", then "speaking", then hides; a failure replaces it
/// with a short message. Stopping midway is not an error.
async fn speak_text(app: &AppHandle, text: &str) -> Result<(), SpeechError> {
    let id = begin_session();
    let use_pill = pill_is_free(app);
    // Generation of the pill we showed: we hide it only if nobody has shown another since.
    let mut pill = use_pill.then(|| overlay::show_speech_overlay(app, "speech-prep"));

    let result = async {
        let api_key = openrouter_key(app)?;
        let settings = get_settings(app);
        info!(
            "tts: {} chars, model {}, voice {}",
            text.chars().count(),
            settings.tts_model,
            settings.tts_voice
        );
        let speech = synthesize(&api_key, &settings.tts_model, &settings.tts_voice, text).await?;
        if !is_current(id) {
            return Ok(()); // stopped while OpenRouter was preparing the audio
        }
        if use_pill {
            pill = Some(overlay::show_speech_overlay(app, "speaking"));
        }
        let output_device = settings.selected_output_device.clone();
        tauri::async_runtime::spawn_blocking(move || play(speech, output_device, id))
            .await
            .map_err(|e| SpeechError::Playback(e.to_string()))?
    }
    .await;
    end_session(id);

    match &result {
        Ok(()) => {
            if let Some(generation) = pill {
                overlay::hide_overlay_if_current(app, generation);
            }
        }
        Err(e) => {
            error!("tts: {e}");
            if use_pill {
                overlay::show_overlay_message(app, e.overlay_key(), &e.to_string());
            }
        }
    }
    result
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
                    .map(|v| {
                        v.iter()
                            .filter_map(|x| x.as_str().map(str::to_string))
                            .collect()
                    })
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
pub fn change_tts_model_setting(
    app: AppHandle,
    model: String,
    voice: String,
) -> Result<(), String> {
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
    speak_text(&app, SAMPLE_TEXT)
        .await
        .map_err(|e| e.to_string())
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
) -> Result<Speech, SpeechError> {
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
        .map_err(|e| SpeechError::Network(e.to_string()))?;
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
        .map_err(|e| SpeechError::Network(e.to_string()))?;
    if !status.is_success() {
        let message = serde_json::from_slice::<serde_json::Value>(&bytes)
            .ok()
            .and_then(|json| json["error"]["message"].as_str().map(str::to_string))
            .unwrap_or_else(|| String::from_utf8_lossy(&bytes).into_owned());
        return Err(SpeechError::Http {
            status: status.as_u16(),
            message,
        });
    }
    if bytes.is_empty() {
        return Err(SpeechError::NoAudio);
    }
    let (rate, channels) = parse_pcm_format(&content_type);
    Ok(Speech {
        samples: pcm16_to_samples(&bytes),
        rate,
        channels,
    })
}

/// Plays speech to the end (or until `stop_speaking`) on the chosen output device.
/// Plays `speech` for session `id`; returns at once if that session was stopped.
fn play(speech: Speech, output_device: Option<String>, id: u64) -> Result<(), SpeechError> {
    let playback = |e: &str| SpeechError::Playback(e.to_string());
    let rate = NonZero::new(speech.rate).ok_or_else(|| playback("sample rate 0"))?;
    let channels = NonZero::new(speech.channels).ok_or_else(|| playback("0 channels"))?;
    let sink = crate::audio_feedback::open_output_sink(output_device)
        .map_err(|e| playback(&e.to_string()))?;
    let player = Arc::new(Player::connect_new(sink.mixer()));
    {
        let mut s = session();
        if s.id != id {
            return Ok(());
        }
        s.player = Some(player.clone());
    }
    player.append(SamplesBuffer::new(channels, rate, speech.samples));
    player.sleep_until_end();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        begin_session, end_session, is_current, parse_pcm_format, pcm16_to_samples, stop_speaking,
        SpeechError,
    };

    #[test]
    fn errors_map_to_short_pill_messages() {
        let http = |status| SpeechError::Http {
            status,
            message: String::new(),
        };
        assert_eq!(SpeechError::NoKey.overlay_key(), "noKey");
        assert_eq!(http(401).overlay_key(), "badKey");
        assert_eq!(http(402).overlay_key(), "noCredits");
        assert_eq!(http(400).overlay_key(), "rejected");
        assert_eq!(SpeechError::NoAudio.overlay_key(), "rejected");
        assert_eq!(SpeechError::Network("x".into()).overlay_key(), "network");
    }

    #[test]
    fn stop_cancels_a_reading_still_being_prepared() {
        let id = begin_session();
        assert!(is_current(id));
        assert!(stop_speaking(), "a reading was going on");
        assert!(!is_current(id), "its audio must not be played");
        assert!(!stop_speaking(), "nothing left to stop");
        end_session(id); // the late finish of a stopped reading changes nothing
        let next = begin_session();
        assert!(is_current(next));
        end_session(next);
        assert!(!stop_speaking());
    }

    #[test]
    fn reads_rate_and_channels_from_content_type() {
        assert_eq!(
            parse_pcm_format("audio/pcm;rate=44100;channels=1"),
            (44_100, 1)
        );
        assert_eq!(
            parse_pcm_format("audio/pcm; rate=24000; channels=2"),
            (24_000, 2)
        );
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
        println!(
            "rate {} channels {} seconds {seconds:.2}",
            speech.rate, speech.channels
        );
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
