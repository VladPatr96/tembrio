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
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::sound_state;

const SPEECH_URL: &str = "https://openrouter.ai/api/v1/audio/speech";
const MODELS_URL: &str = "https://openrouter.ai/api/v1/models?output_modalities=speech";
const SAMPLE_TEXT: &str = "Проверка голоса. Так Tembrio будет читать выделенный текст.";

/// The player of the phrase being read, kept so a second press can stop it.
static SESSION: Mutex<Session> = Mutex::new(Session {
    id: 0,
    active: false,
    player: None,
    speech: None,
});

/// One reading: from the request to OpenRouter to the end of playback.
/// Stopping bumps `id`, so a synthesis still in flight finds out on return
/// that nobody wants its audio any more.
struct Session {
    id: u64,
    active: bool,
    player: Option<Arc<Player>>,
    /// What the phrase is and how its time maps to words: set when playback
    /// starts, read by the progress ticker.
    speech: Option<SpeechPlan>,
}

/// Everything the progress ticker needs to keep the pill's karaoke honest.
struct SpeechPlan {
    words: Vec<String>,
    spans: Vec<(usize, usize)>,
    /// How long each word sounds (syllables), so the highlight keeps up with
    /// numbers and long words instead of counting characters.
    weights: Vec<f32>,
    rate: u32,
    channels: u16,
    total_seconds: f32,
    paused: Arc<std::sync::atomic::AtomicBool>,
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
        s.speech = None;
    }
}

/// Holds still (or resumes) the phrase being read. True when the state changed.
pub fn pause_speech(app: &AppHandle) -> bool {
    let s = session();
    let Some(player) = s.player.as_ref() else {
        return false;
    };
    let was_paused = player.is_paused();
    if was_paused {
        player.play();
    } else {
        player.pause();
    }
    let now_paused = !was_paused;
    if let Some(plan) = s.speech.as_ref() {
        plan.paused
            .store(now_paused, std::sync::atomic::Ordering::SeqCst);
    }
    let voice = crate::settings::get_settings(app).tts_voice;
    drop(s);
    sound_state::speaking(app, Some(voice), None, None, None, Some(now_paused));
    // Held reading counts as resting on the tray; resuming brings it back.
    crate::tray::set_tray_state(
        app,
        if now_paused {
            crate::tray::TrayIconState::Idle
        } else {
            crate::tray::TrayIconState::Speaking
        },
    );
    info!("tts: paused = {now_paused}");
    now_paused
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
    s.speech = None;
    if let Some(player) = s.player.take() {
        player.stop();
    }
    if was_active {
        info!("tts: stopped");
    }
    was_active
}

/// Reads what the clipboard holds. Empty clipboard — a caution, not an error.
/// Used by the tray panel («Прочитать скопированное») and its own hotkey.
pub fn speak_clipboard(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let text: Option<String> = app
            .clipboard()
            .read_text()
            .ok()
            .filter(|t| !t.trim().is_empty());
        let Some(text) = text else {
            info!("tts: clipboard has no text");
            show_message(&app, "nothingCopied", "");
            return;
        };
        let _ = tauri::async_runtime::block_on(speak_text(&app, &text));
    });
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
    sound_state::preparing(app, Some(get_settings(app).tts_voice.clone()));
    // While the voice is being prepared, reading counts as busy already.
    crate::tray::set_tray_state(app, crate::tray::TrayIconState::Speaking);
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
        let voice = settings.tts_voice.clone();
        let playback_app = app.clone();
        let phrase = text.to_string();
        tauri::async_runtime::spawn_blocking(move || {
            play(speech, &phrase, &voice, &playback_app, output_device, id)
        })
        .await
        .map_err(|e| SpeechError::Playback(e.to_string()))?
    }
    .await;
    end_session(id);
    sound_state::idle(app);

    match &result {
        Ok(()) => {
            if let Some(generation) = pill {
                overlay::hide_overlay_if_current(app, generation);
            }
        }
        Err(e) => {
            error!("tts: {e}");
            let key = e.overlay_key();
            sound_state::message(app, key, &e.to_string());
            if use_pill {
                overlay::show_overlay_message(app, key, &e.to_string());
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
    settings.tts_model = model.clone();
    settings.tts_voice = voice.clone();
    write_settings(&app, settings);
    // Every window shows the model and its voice (the settings screen and the
    // tray panel), so they all have to hear about the change; without this the
    // picker snapped back to the old voice.
    let _ = app.emit(
        "settings-changed",
        serde_json::json!({ "setting": "tts_model", "model": model, "voice": voice }),
    );
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_tts_voice_setting(app: AppHandle, voice: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.tts_voice = voice.clone();
    write_settings(&app, settings);
    // See `change_tts_model_setting`: the tray panel and the settings screen both
    // read the voice from settings, and a silent write left them showing the old
    // one.
    let _ = app.emit(
        "settings-changed",
        serde_json::json!({ "setting": "tts_voice", "voice": voice }),
    );
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

/// Holds still or resumes the phrase being read (pill button, hotkey).
#[tauri::command]
#[specta::specta]
pub fn pause_tts(app: AppHandle) {
    pause_speech(&app);
}

/// Reads the clipboard aloud: the tray panel button and its hotkey.
#[tauri::command]
#[specta::specta]
pub fn speak_clipboard_command(app: AppHandle) {
    speak_clipboard(&app);
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

/// How finely the voiced-time curve is sampled: 50 ms is finer than the
/// highlight can show and keeps the curve small (a minute of speech is 1200
/// numbers).
const VOICE_STEP_MS: f64 = 50.0;

/// Cumulative *voiced time* of the phrase, sampled every 50 ms and normalized to
/// 1.0 at the end. The karaoke highlight follows this instead of wall-clock time
/// so punctuation pauses do not push it ahead of the voice.
///
/// It counts sounding time, not loudness: every sample above a quietness
/// threshold counts the same, however loud it is. Loudness was the earlier
/// mistake — a stressed syllable is much louder than its neighbours but no
/// longer, so weighting by amplitude pulled the highlight ahead of the voice.
fn voice_curve(samples: &[f32], rate: u32, channels: u16) -> Vec<f32> {
    let frames_per_step =
        ((rate as f64 / 1000.0) * (channels as f64) * VOICE_STEP_MS).round() as usize;
    if samples.is_empty() || frames_per_step == 0 {
        return vec![1.0];
    }
    let peak = samples.iter().fold(0.0f32, |max, s| max.max(s.abs()));
    if peak <= f32::EPSILON {
        return vec![1.0];
    }
    // 4% of the loudest sample: room tone and the quiet tail of a word fall
    // below it, the body of every syllable is above.
    let threshold = peak * 0.04;
    let mut curve = Vec::with_capacity(samples.len() / frames_per_step + 1);
    let mut total = 0.0f64;
    for step in samples.chunks(frames_per_step) {
        let sounding = step.iter().filter(|s| s.abs() >= threshold).count() as f64;
        total += sounding;
        curve.push(total);
    }
    if total <= f64::EPSILON {
        return vec![1.0];
    }
    let last = curve.len() - 1;
    curve
        .into_iter()
        .enumerate()
        .map(|(i, cumulative)| {
            if i == last {
                1.0
            } else {
                (cumulative / total) as f32
            }
        })
        .collect()
}

/// Plays speech to the end (or until `stop_speaking`) on the chosen output device.
/// Plays `speech` for session `id`; returns at once if that session was stopped.
fn play(
    speech: Speech,
    text: &str,
    voice: &str,
    app: &AppHandle,
    output_device: Option<String>,
    id: u64,
) -> Result<(), SpeechError> {
    let playback = |e: &str| SpeechError::Playback(e.to_string());
    let rate = NonZero::new(speech.rate).ok_or_else(|| playback("sample rate 0"))?;
    let channels = NonZero::new(speech.channels).ok_or_else(|| playback("0 channels"))?;
    let total_seconds = speech.samples.len() as f32 / speech.rate as f32 / speech.channels as f32;
    let sink = crate::audio_feedback::open_output_sink(output_device)
        .map_err(|e| playback(&e.to_string()))?;
    let player = Arc::new(Player::connect_new(sink.mixer()));
    let paused = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let spans = sound_state::word_spans(text);
    let weights = sound_state::word_weights(text, &spans);
    let curve = std::sync::Arc::new(voice_curve(&speech.samples, speech.rate, speech.channels));
    let plan = SpeechPlan {
        words: sound_state::split_words(text),
        spans: spans.clone(),
        weights,
        rate: speech.rate,
        channels: speech.channels,
        total_seconds,
        paused: Arc::clone(&paused),
    };
    {
        let mut s = session();
        if s.id != id {
            return Ok(());
        }
        s.player = Some(player.clone());
        s.speech = Some(plan);
    }
    sound_state::speaking(
        app,
        Some(voice.to_string()),
        Some(sound_state::split_words(text)),
        Some(0),
        Some(0.0),
        Some(false),
    );
    player.append(SamplesBuffer::new(channels, rate, speech.samples));
    // The pill's karaoke: estimate the current word from the played share of
    // the phrase. OpenRouter gives no per-word timestamps, so characters do.
    let ticker = app.clone();
    let tick_curve = std::sync::Arc::clone(&curve);
    let tick_player = Arc::clone(&player);
    let tick_paused = Arc::clone(&paused);
    std::thread::spawn(move || {
        while tick_player.len() > 0 {
            std::thread::sleep(Duration::from_millis(150));
            if tick_paused.load(std::sync::atomic::Ordering::SeqCst) {
                continue;
            }
            let played_ms = tick_player.get_pos().as_secs_f64() * 1000.0;
            let step = (played_ms / VOICE_STEP_MS) as usize;
            // Share of the *sounding* phrase heard so far: pauses do not move it.
            let progress = tick_curve.get(step).copied().unwrap_or(1.0).clamp(0.0, 1.0);
            let weights = { session().speech.as_ref().map(|p| p.weights.clone()) };
            let Some(weights) = weights else {
                break;
            };
            let index = sound_state::word_index_at_share(progress, &weights);
            sound_state::speaking(&ticker, None, None, Some(index), Some(progress), None);
        }
    });
    player.sleep_until_end();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        begin_session, end_session, is_current, parse_pcm_format, pcm16_to_samples, stop_speaking,
        voice_curve, SpeechError,
    };

    /// The highlight follows voiced time, so a trailing silence does not leave
    /// it crawling through the last word.
    #[test]
    fn voice_curve_ignores_silence() {
        // 1 s of 8 kHz mono: 0.5 s tone, 0.5 s silence.
        let rate = 8000u32;
        let mut samples = vec![0.0f32; rate as usize];
        for s in samples.iter_mut().take(rate as usize / 2) {
            *s = 0.5;
        }
        let curve = voice_curve(&samples, rate, 1);
        // 20 steps of 50 ms; at step 9 (0.45..0.50 s) the tone is finished.
        assert!(curve[8] < 1.0, "still sounding at 0.40 s: {}", curve[8]);
        assert_eq!(curve[9], 1.0, "all the sound has been heard by 0.50 s");
        assert_eq!(
            *curve.last().unwrap(),
            1.0,
            "the last sample is the whole phrase"
        );
        // Pure silence has nothing to follow; the caller then shows the end.
        assert_eq!(voice_curve(&vec![0.0f32; 800], rate, 1), vec![1.0]);
        assert_eq!(voice_curve(&[], rate, 1), vec![1.0]);
    }

    /// A loud syllable is not a long one: loudness must not move the highlight.
    #[test]
    fn voice_curve_ignores_loudness() {
        let rate = 8000u32;
        // 0.2 s quiet tone, 0.2 s loud tone, 0.2 s quiet tone.
        let mut samples = Vec::new();
        samples.extend(std::iter::repeat_n(0.1f32, 1600));
        samples.extend(std::iter::repeat_n(0.9f32, 1600));
        samples.extend(std::iter::repeat_n(0.1f32, 1600));
        let curve = voice_curve(&samples, rate, 1);
        // 12 steps; by step 6 half the voiced time has passed, loud or not.
        assert!(
            (curve[5] - 0.5).abs() < 0.1,
            "halfway at 0.30 s: {}",
            curve[5]
        );
    }

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
