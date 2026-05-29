/** Shared speech + timer helpers (Sound Pop and other games). */

import { buildLetterLessonLines } from "../data/phonics.js";

const pendingTimers = new Set();

export function cancelSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/** Drop pending timeouts only — does not interrupt in-flight speech. */
export function clearScheduledTimers() {
  pendingTimers.forEach((id) => window.clearTimeout(id));
  pendingTimers.clear();
}

export function cancelScheduledTimer(id) {
  if (id == null) return;
  window.clearTimeout(id);
  pendingTimers.delete(id);
}

/** Cancel speech and clear all scheduled audio callbacks. */
export function clearScheduledAudio() {
  clearScheduledTimers();
  cancelSpeech();
}

/**
 * Schedule a callback after delayMs. Returns timer id.
 * Caller should guard with a round token so stale challenges do not speak.
 */
export function scheduleAudio(callback, delayMs) {
  const id = window.setTimeout(() => {
    pendingTimers.delete(id);
    callback();
  }, delayMs);
  pendingTimers.add(id);
  return id;
}

/** Pause after a phrase finishes before auto-advancing to the next sound / round. */
export const TTS_AFTER_PHRASE_GAP_MS = 500;

/** Max wait when `speechSynthesis` never fires end (offline / quirks). */
export const TTS_FALLBACK_TOTAL_MS = 5500;

export function speakText(text, rate = 0.72, onEnd) {
  if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
    if (typeof onEnd === "function") window.queueMicrotask(onEnd);
    return;
  }
  cancelSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  if (typeof onEnd === "function") {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }
  window.speechSynthesis.speak(utterance);
}

/** Speak lines one at a time with a short gap between each phrase. */
export function speakTextSequence(lines, rate = 0.68, onEnd) {
  const arr = (lines || []).filter(Boolean);
  if (arr.length === 0) {
    if (typeof onEnd === "function") window.queueMicrotask(onEnd);
    return;
  }
  let i = 0;
  const next = () => {
    if (i >= arr.length) {
      if (typeof onEnd === "function") onEnd();
      return;
    }
    const line = arr[i];
    i += 1;
    speakText(line, rate, () => {
      if (i >= arr.length) {
        if (typeof onEnd === "function") onEnd();
        return;
      }
      scheduleAudio(next, TTS_AFTER_PHRASE_GAP_MS);
    });
  };
  next();
}

export function speakLetterSound(letterObj, enabled = true) {
  if (!enabled || !letterObj?.say) return;
  speakText(letterObj.say, 0.58);
}

/**
 * Full repeat-after-me script: name, uppercase, lowercase, phoneme.
 * @param {{ onEnd?: () => void, enabled?: boolean }} [options]
 */
export function speakLetterLesson(letterObj, options = {}) {
  const { onEnd, enabled = true } = options;
  if (!enabled || !letterObj) {
    if (typeof onEnd === "function") window.queueMicrotask(onEnd);
    return;
  }
  speakTextSequence(buildLetterLessonLines(letterObj), 0.68, onEnd);
}

/** Sound Pop: auto-play target letter once the challenge is on screen. */
export const SOUND_POP_AUTO_PLAY_MS = 420;

/** Letter Echo: auto-play lesson after letter renders. */
export const LETTER_ECHO_AUTO_PLAY_MS = 500;

/** @deprecated Advances are gated on TTS end + TTS_AFTER_PHRASE_GAP_MS; kept for reference. */
export const SOUND_POP_ADVANCE_MS = 850;
