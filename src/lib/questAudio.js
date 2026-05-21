/** Shared speech + timer helpers (Sound Pop and other games). */

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

export function speakLetterSound(letterObj) {
  if (!letterObj?.say) return;
  speakText(letterObj.say, 0.58);
}

/** Sound Pop: auto-play target letter once the challenge is on screen. */
export const SOUND_POP_AUTO_PLAY_MS = 420;

/** @deprecated Advances are gated on TTS end + TTS_AFTER_PHRASE_GAP_MS; kept for reference. */
export const SOUND_POP_ADVANCE_MS = 850;
