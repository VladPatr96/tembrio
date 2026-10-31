//! One source of truth for «what is sounding right now».
//!
//! `sound-state` is a single event addressed to every window (the pill, the
//! main window's bottom strip, the tray popover in a later stage). Speech
//! states are published here today; dictation keeps its own dedicated events
//! (mic levels, live text) until the dictation stage and then joins this
//! channel too — the pill already merges both.

use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Emitter};

/// What the interface shows in «sound places» (the pill, the strip, the tray).
/// Fields are optional because not every state carries them; the frontend
/// reads what its current state needs.
#[derive(Serialize, Type, Clone, Debug, PartialEq)]
pub struct SoundStateEvent {
    /// "idle" | "preparing" | "speaking" | "message"
    pub kind: &'static str,
    /// Speech is holding still and can be continued.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paused: Option<bool>,
    /// Which voice is heard, as shown in the voices catalog.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    /// The words of the phrase, carried with the first "speaking" update only.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<String>>,
    /// Which word is heard right now, 0-based.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_index: Option<u32>,
    /// Played part of the whole phrase, 0..1.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<f32>,
    /// A short message: a translation key under `overlay.speech.errors` plus
    /// the technical detail for the tooltip.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_detail: Option<String>,
}

impl SoundStateEvent {
    fn bare(kind: &'static str) -> Self {
        Self {
            kind,
            paused: None,
            voice: None,
            words: None,
            word_index: None,
            progress: None,
            message_key: None,
            message_detail: None,
        }
    }
}

/// Categories a message icon can come in, so the pill colours it correctly.
#[derive(Serialize, Type, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageTone {
    Warn,
    Err,
}

impl MessageTone {
    pub fn from_key(key: &str) -> Self {
        match key {
            // A simple «can't do that now» is caution, not alarm.
            "nothingSelected" | "nothingCopied" | "rejected" | "network" | "pillBusy" => Self::Warn,
            _ => Self::Err,
        }
    }
}

pub const EVENT: &str = "sound-state";

/// Publishes a state to every window. Cheap enough for the ~10 Hz
/// speaking-progress ticks: one JSON event, no persistence.
pub fn publish(app: &AppHandle, state: SoundStateEvent) {
    let _ = app.emit(EVENT, state);
}

pub fn idle(app: &AppHandle) {
    publish(app, SoundStateEvent::bare("idle"));
    // «idle» is always a transition (reading ends), so the tray may rest.
    crate::tray::set_tray_state(app, crate::tray::TrayIconState::Idle);
}

/// «Preparing the voice» — the pill names the voice it is waiting for, as the
/// prototype does («Готовлю голос Achird…»).
pub fn preparing(app: &AppHandle, voice: Option<String>) {
    publish(
        app,
        SoundStateEvent {
            voice,
            ..SoundStateEvent::bare("preparing")
        },
    );
}

/// A periodic update while a voice is heard: which word, how far along, paused.
pub fn speaking(
    app: &AppHandle,
    voice: Option<String>,
    words: Option<Vec<String>>,
    word_index: Option<u32>,
    progress: Option<f32>,
    paused: Option<bool>,
) {
    publish(
        app,
        SoundStateEvent {
            kind: "speaking",
            paused,
            voice,
            words,
            word_index,
            progress,
            message_key: None,
            message_detail: None,
        },
    );
}

pub fn message(app: &AppHandle, key: &str, detail: &str) {
    // A message means nothing is sounding; the tray rests behind it.
    crate::tray::set_tray_state(app, crate::tray::TrayIconState::Idle);
    publish(
        app,
        SoundStateEvent {
            kind: "message",
            message_key: Some(key.to_string()),
            message_detail: Some(detail.to_string()),
            ..SoundStateEvent::bare("message")
        },
    );
}

/// Splits a phrase into word spans: a word plus the pause behind it (spaces,
/// punctuation). Speech time follows character count, so a word is «current»
/// while the spoken share of characters sits inside its span.
pub fn word_spans(text: &str) -> Vec<(usize, usize)> {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut spans = Vec::new();
    let mut word_start: Option<usize> = None;
    for (n, (i, c)) in chars.iter().enumerate() {
        // A separator inside a number («16.10», «1 500», «12:30») belongs to the
        // number: the karaoke line should highlight the date as one word, the
        // way it is read.
        let joins_number = matches!(*c, '.' | ',' | ':' | '/' | '-')
            && n > 0
            && chars[n - 1].1.is_ascii_digit()
            && chars
                .get(n + 1)
                .is_some_and(|(_, next)| next.is_ascii_digit());
        if c.is_alphanumeric() || (joins_number && word_start.is_some()) {
            if word_start.is_none() {
                word_start = Some(*i);
            }
        } else if let Some(start) = word_start.take() {
            spans.push((start, *i));
        }
    }
    if let Some(start) = word_start {
        spans.push((start, text.len()));
    }
    spans
}

/// Which word is heard at `progress` (0..1) of a phrase spanned by `spans`.
pub fn word_index_at(progress: f32, spans: &[(usize, usize)]) -> u32 {
    let Some(&(_, total)) = spans.last() else {
        return 0;
    };
    if total == 0 {
        return 0;
    }
    let pos = (progress.clamp(0.0, 1.0) * total as f32) as usize;
    for (i, (start, end)) in spans.iter().enumerate() {
        if pos < *start {
            // The gap before this word: draw its end at the previous word.
            return i.saturating_sub(1) as u32;
        }
        if pos < *end {
            return i as u32;
        }
    }
    (spans.len() - 1) as u32
}

/// How long a word is likely to sound, in syllables — the unit the karaoke
/// line needs, because sounding time follows syllables, not characters:
/// «16.10» is 5 characters but «шестнадцатого октября» is nine syllables, and
/// counting characters made the highlight drift behind the voice.
///
/// The rules are estimates, not linguistics: vowels count, and digits count as
/// the numeral they are read as (a lone «7» is «seven», a group «1500» is
/// «fifteen hundred» or «тысяча пятьсот»).
pub fn spoken_weight(word: &str) -> f32 {
    let mut vowels = 0.0f32;
    let mut digits = 0.0f32;
    let mut digit_run = 0u32;
    let mut other = 0.0f32;
    for c in word.chars() {
        if c.is_ascii_digit() {
            digit_run += 1;
            continue;
        }
        if digit_run > 0 {
            // A numeral is read as one or more words of its own.
            digits += 1.8 * digit_run as f32;
            digit_run = 0;
        }
        let lower = c.to_lowercase().next().unwrap_or(c);
        if matches!(
            lower,
            'а' | 'е' | 'ё' | 'и' | 'о' | 'у' | 'ы' | 'э' | 'ю' | 'я'
        ) {
            vowels += 1.0;
        } else if matches!(lower, 'a' | 'e' | 'i' | 'o' | 'u' | 'y') {
            vowels += 1.0;
        } else if c.is_alphanumeric() {
            other += 1.0;
        }
    }
    if digit_run > 0 {
        digits += 1.8 * digit_run as f32;
    }
    // A spoken word is at least one syllable; letters without vowels still take
    // a moment (an acronym like «API» is read letter by letter).
    let letters = (vowels + other * 0.12).max(if word.is_empty() { 0.0 } else { 1.0 });
    digits.max(letters)
}

/// Weights for every word of `spans`, used to place the karaoke highlight by
/// how long each word sounds rather than by how it is spelled.
pub fn word_weights(text: &str, spans: &[(usize, usize)]) -> Vec<f32> {
    spans
        .iter()
        .map(|(start, end)| spoken_weight(&text[*start..*end]))
        .collect()
}

/// Which word is heard after `share` (0..1) of the phrase's speaking time has
/// passed, where `weights[i]` is how long word `i` sounds.
pub fn word_index_at_share(share: f32, weights: &[f32]) -> u32 {
    let total: f32 = weights.iter().sum();
    if weights.is_empty() || total <= 0.0 {
        return 0;
    }
    let target = share.clamp(0.0, 1.0) * total;
    let mut passed = 0.0;
    for (i, weight) in weights.iter().enumerate() {
        passed += weight;
        if target < passed {
            return i as u32;
        }
    }
    (weights.len() - 1) as u32
}

/// The words alone, for the karaoke line.
pub fn split_words(text: &str) -> Vec<String> {
    word_spans(text)
        .iter()
        .map(|(start, end)| text[*start..*end].trim().to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        split_words, spoken_weight, word_index_at, word_index_at_share, word_spans, word_weights,
    };

    /// Spans are byte offsets, like everywhere in Rust string indexing; so is
    /// the total the progress is scaled by.
    #[test]
    fn spans_cover_words_and_their_pauses() {
        assert_eq!(word_spans("привет мир"), vec![(0, 12), (13, 19)]);
        assert_eq!(word_spans("хек, да"), vec![(0, 6), (8, 12)]);
    }

    #[test]
    fn no_words_at_all() {
        assert!(word_spans("  …!? ").is_empty());
        assert!(word_spans("—").is_empty());
    }

    /// "привет мир как дела": bytes 0..12 / 13..19 / 20..26 / 27..35.
    #[test]
    fn index_follows_the_spoken_part() {
        let spans = word_spans("привет мир как дела");
        assert_eq!(word_index_at(0.0, &spans), 0);
        assert_eq!(word_index_at(0.1, &spans), 0);
        assert_eq!(word_index_at(0.33, &spans), 0, "still inside «привет»");
        assert_eq!(word_index_at(0.4, &spans), 1, "into «мир»");
        assert_eq!(word_index_at(0.7, &spans), 2);
        assert_eq!(word_index_at(0.82, &spans), 3, "into «дела»");
        assert_eq!(word_index_at(1.0, &spans), 3, "the last word");
        // Impossible fractions never panic.
        assert_eq!(word_index_at(2.0, &spans), 3);
        assert_eq!(word_index_at(-0.5, &spans), 0);
    }

    #[test]
    fn empty_spans_stay_at_zero() {
        assert_eq!(word_index_at(0.5, &[]), 0);
    }

    /// The karaoke line shows the word with its punctuation, as the
    /// prototype does.
    /// Numbers sound much longer than they are spelled; that was the drift.
    #[test]
    fn numbers_weigh_more_than_their_characters() {
        assert!(spoken_weight("16.10") > 5.0, "a date is read out in words");
        assert!(spoken_weight("1500") > spoken_weight("1500") * 0.0);
        assert!(spoken_weight("1500") > 4.0);
        assert!(spoken_weight("и") < 2.0, "a short word stays short");
        assert_eq!(spoken_weight(""), 0.0);
    }

    #[test]
    fn shares_place_the_highlight_on_the_sounding_word() {
        // «шестнадцатого октября сумма» — the date takes most of the time.
        let text = "16.10 сумма";
        let spans = word_spans(text);
        let weights = word_weights(text, &spans);
        assert_eq!(spans.len(), 2);
        assert!(weights[0] > weights[1], "the date sounds longer");
        assert_eq!(word_index_at_share(0.0, &weights), 0);
        assert_eq!(word_index_at_share(0.5, &weights), 0, "still the date");
        assert_eq!(word_index_at_share(0.95, &weights), 1);
        assert_eq!(word_index_at_share(1.0, &weights), 1);
        assert_eq!(word_index_at_share(0.5, &[]), 0);
    }

    #[test]
    fn words_are_the_span_words() {
        assert_eq!(split_words("хек, да"), vec!["хек", "да"]);
        assert_eq!(split_words("привет мир"), vec!["привет", "мир"]);
    }
}
