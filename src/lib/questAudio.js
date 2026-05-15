/** Shared speech + timer helpers (Sound Pop and other games). */

const pendingTimers = new Set();

export function cancelSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/** Cancel speech and clear all scheduled audio callbacks. */
export function clearScheduledAudio() {
  pendingTimers.forEach((id) => window.clearTimeout(id));
  pendingTimers.clear();
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

export function speakText(text, rate = 0.72) {
  if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  cancelSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

export function speakLetterSound(letterObj) {
  if (!letterObj?.say) return;
  speakText(letterObj.say, 0.58);
}

/** Sound Pop: auto-play target letter once the challenge is on screen. */
export const SOUND_POP_AUTO_PLAY_MS = 320;

/** Sound Pop: pause after a correct tap before loading the next challenge. */
export const SOUND_POP_ADVANCE_MS = 850;
