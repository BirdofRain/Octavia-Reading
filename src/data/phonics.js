import { resolveDifficultyBand, filterByDifficultyBand } from "../lib/difficulty.js";

/**
 * Letter sounds: short vowels, simple consonants.
 * `say` is TTS-friendly (no IPA symbols).
 */
export const LETTERS = [
  { letter: "m", sound: "m", say: "mmm", clue: "like moon", emoji: "🌙", level: 1 },
  { letter: "s", sound: "s", say: "sss", clue: "like sun", emoji: "☀️", level: 1 },
  { letter: "a", sound: "short a", say: "ah", clue: "like apple", emoji: "🍎", level: 1 },
  { letter: "t", sound: "t", say: "tuh", clue: "like turtle", emoji: "🐢", level: 1 },
  { letter: "p", sound: "p", say: "puh", clue: "like puppy", emoji: "🐶", level: 1 },
  { letter: "i", sound: "short i", say: "ih", clue: "like igloo", emoji: "🧊", level: 1 },
  { letter: "n", sound: "n", say: "nnn", clue: "like nest", emoji: "🪺", level: 1 },
  { letter: "c", sound: "k", say: "kuh", clue: "like cat", emoji: "🐱", level: 2 },
  { letter: "o", sound: "short o", say: "aw", clue: "like octopus", emoji: "🐙", level: 2 },
  { letter: "d", sound: "d", say: "duh", clue: "like duck", emoji: "🦆", level: 2 },
  { letter: "f", sound: "f", say: "fff", clue: "like fish", emoji: "🐟", level: 2 },
  { letter: "r", sound: "r", say: "rrr", clue: "like rabbit", emoji: "🐰", level: 2 },
  { letter: "h", sound: "h", say: "huh", clue: "like hat", emoji: "🎩", level: 2 },
  { letter: "b", sound: "b", say: "buh", clue: "like ball", emoji: "⚽", level: 2 },
  { letter: "l", sound: "l", say: "lll", clue: "like lion", emoji: "🦁", level: 3 },
  { letter: "g", sound: "g", say: "guh", clue: "like goat", emoji: "🐐", level: 3 },
  { letter: "e", sound: "short e", say: "eh", clue: "like egg", emoji: "🥚", level: 3 },
  { letter: "u", sound: "short u", say: "uh", clue: "like umbrella", emoji: "☂️", level: 3 },
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

export function lettersForReadingDifficulty(progress, sessionStats = {}) {
  const band = resolveDifficultyBand(progress, sessionStats, "phonics");
  return filterByDifficultyBand(LETTERS, band);
}
