//! Text-to-speech: read the selected text aloud with an OpenRouter voice.
//!
//! The flow is `speak_selection` → copy the selection (clipboard.rs) →
//! `synthesize` (POST /audio/speech, always `pcm`) → `play` on the output
//! device. Every OpenRouter speech model returns raw 16-bit PCM and states the
//! sample rate in the Content-Type (`audio/pcm;rate=24000;channels=1`), so no
//! decoder and no per-model format table are needed.

use crate::settings::get_settings;
use log::{error, info, warn};
use rodio::buffer::SamplesBuffer;
use rodio::Player;
use std::num::NonZero;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::AppHandle;

const SPEECH_URL: &str = "https://openrouter.ai/api/v1/audio/speech";

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
        let settings = get_settings(&app);
        let api_key = settings
            .post_process_api_keys
            .get("openrouter")
            .filter(|key| !key.is_empty())
            .cloned()
            .or_else(|| std::env::var("OPENROUTER_API_KEY").ok());
        let Some(api_key) = api_key else {
            warn!("tts: no OpenRouter key (Post-processing → OpenRouter, or OPENROUTER_API_KEY)");
            return;
        };
        info!(
            "tts: {} chars, model {}, voice {}",
            text.chars().count(),
            settings.tts_model,
            settings.tts_voice
        );
        let result = tauri::async_runtime::block_on(synthesize(
            &api_key,
            &settings.tts_model,
            &settings.tts_voice,
            &text,
        ));
        match result {
            Ok(speech) => {
                if let Err(e) = play(speech, settings.selected_output_device.clone()) {
                    error!("tts: playback failed: {e}");
                }
            }
            Err(e) => error!("tts: {e}"),
        }
    });
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
