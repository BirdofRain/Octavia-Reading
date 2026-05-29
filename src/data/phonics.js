import { resolveDifficultyBand, filterByDifficultyBand } from "../lib/difficulty.js";

/**
 * Letter sounds: short vowels, simple consonants.
 * `name` is TTS-friendly letter name; `say` is the phoneme cue (no IPA).
 */
export const LETTERS = [
  { letter: "m", name: "em", sound: "m", say: "mmm", clue: "like moon", emoji: "🌙", level: 1 },
  { letter: "s", name: "ess", sound: "s", say: "sss", clue: "like sun", emoji: "☀️", level: 1 },
  { letter: "a", name: "ay", sound: "short a", say: "ah", clue: "like apple", emoji: "🍎", level: 1 },
  { letter: "t", name: "tee", sound: "t", say: "tuh", clue: "like turtle", emoji: "🐢", level: 1 },
  { letter: "p", name: "pee", sound: "p", say: "puh", clue: "like puppy", emoji: "🐶", level: 1 },
  { letter: "i", name: "eye", sound: "short i", say: "ih", clue: "like igloo", emoji: "🧊", level: 1 },
  { letter: "n", name: "en", sound: "n", say: "nnn", clue: "like nest", emoji: "🪺", level: 1 },
  { letter: "c", name: "see", sound: "k", say: "kuh", clue: "like cat", emoji: "🐱", level: 2 },
  { letter: "o", name: "oh", sound: "short o", say: "aw", clue: "like octopus", emoji: "🐙", level: 2 },
  { letter: "d", name: "dee", sound: "d", say: "duh", clue: "like duck", emoji: "🦆", level: 2 },
  { letter: "f", name: "eff", sound: "f", say: "fff", clue: "like fish", emoji: "🐟", level: 2 },
  { letter: "r", name: "ar", sound: "r", say: "rrr", clue: "like rabbit", emoji: "🐰", level: 2 },
  { letter: "h", name: "aych", sound: "h", say: "huh", clue: "like hat", emoji: "🎩", level: 2 },
  { letter: "b", name: "bee", sound: "b", say: "buh", clue: "like ball", emoji: "⚽", level: 2 },
  { letter: "j", name: "jay", sound: "j", say: "juh", clue: "like jam", emoji: "🍓", level: 2 },
  { letter: "k", name: "kay", sound: "k", say: "kuh", clue: "like kite", emoji: "🪁", level: 2 },
  { letter: "v", name: "vee", sound: "v", say: "vvv", clue: "like van", emoji: "🚐", level: 2 },
  { letter: "w", name: "dublyoo", sound: "w", say: "wuh", clue: "like water", emoji: "💧", level: 2 },
  { letter: "l", name: "ell", sound: "l", say: "lll", clue: "like lion", emoji: "🦁", level: 3 },
  { letter: "g", name: "jee", sound: "g", say: "guh", clue: "like goat", emoji: "🐐", level: 3 },
  { letter: "e", name: "ee", sound: "short e", say: "eh", clue: "like egg", emoji: "🥚", level: 3 },
  { letter: "u", name: "you", sound: "short u", say: "uh", clue: "like umbrella", emoji: "☂️", level: 3 },
  { letter: "q", name: "cue", sound: "k", say: "kwuh", clue: "like queen", emoji: "👑", level: 3 },
  { letter: "x", name: "ex", sound: "ks", say: "ks", clue: "like box", emoji: "📦", level: 3 },
  { letter: "y", name: "why", sound: "y", say: "yuh", clue: "like yo-yo", emoji: "🪀", level: 3 },
  { letter: "z", name: "zee", sound: "z", say: "zzz", clue: "like zebra", emoji: "🦓", level: 3 },
];

export const WORD_FAMILIES = [
  { id: "at", label: "-at", vowel: "a", level: 1, words: ["cat", "mat", "sat", "pat", "bat", "fat", "rat", "hat"] },
  { id: "ap", label: "-ap", vowel: "a", level: 1, words: ["cap", "map", "nap", "tap", "lap"] },
  { id: "an", label: "-an", vowel: "a", level: 2, words: ["can", "man", "pan", "ran", "fan"] },
  { id: "in", label: "-in", vowel: "i", level: 2, words: ["pin", "tin", "win", "fin"] },
  { id: "it", label: "-it", vowel: "i", level: 2, words: ["sit", "bit", "fit", "hit"] },
  { id: "og", label: "-og", vowel: "o", level: 2, words: ["dog", "log", "fog"] },
  { id: "op", label: "-op", vowel: "o", level: 3, words: ["hop", "mop", "top", "pop"] },
  { id: "ug", label: "-ug", vowel: "u", level: 3, words: ["bug", "rug", "mug", "hug"] },
  { id: "ed", label: "-ed", vowel: "e", level: 3, words: ["bed", "red", "fed"] },
  { id: "en", label: "-en", vowel: "e", level: 3, words: ["hen", "pen", "men"] },
];

export function letterUpper(letterObj) {
  return String(letterObj?.letter || "").toUpperCase();
}

export function letterLower(letterObj) {
  return String(letterObj?.letter || "");
}

export function buildLetterLessonLines(letterObj) {
  if (!letterObj) return [];
  const U = letterUpper(letterObj);
  const L = letterLower(letterObj);
  return [
    `The letter ${letterObj.name}.`,
    `Uppercase ${U}.`,
    `Lowercase ${L}.`,
    `${U} says ${letterObj.say}.`,
  ];
}

export function shuffleLetters(letters) {
  const arr = [...(letters || [])];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Stable per-round mixed case for a letter choice button. */
export function letterChoiceDisplay(letterChar, seed = letterChar) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2 === 0 ? letterChar.toUpperCase() : letterChar.toLowerCase();
}

/** Case of a letter as it appears in a word string (defaults to lowercase). */
export function letterCaseInWord(letterChar, word) {
  const w = String(word || "");
  for (let i = 0; i < w.length; i += 1) {
    if (w[i].toLowerCase() === letterChar.toLowerCase()) return w[i];
  }
  return letterChar.toLowerCase();
}

export function lettersForReadingDifficulty(progress, sessionStats = {}) {
  const band = resolveDifficultyBand(progress, sessionStats, "phonics");
  return filterByDifficultyBand(LETTERS, band);
}
