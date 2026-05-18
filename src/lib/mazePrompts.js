import { wordsForReadingDifficulty, sentencesForReadingDifficulty } from "../data/reading.js";
import { isAdvancedContentLevel } from "./unlocks.js";

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function pickRandom(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * @param {object} progress
 * @param {object} sessionStats
 * @param {number} stepIndex
 */
export function buildMazePrompt(progress, sessionStats, stepIndex) {
  const wordPool = wordsForReadingDifficulty(progress, sessionStats);
  if (!wordPool.length) {
    return {
      type: "word",
      prompt: "Tap the word:",
      correct: "cat",
      choices: ["cat", "cap", "cot"],
      speakHint: "cat",
    };
  }

  const useSentence = isAdvancedContentLevel(progress) && stepIndex > 0 && stepIndex % 3 === 0;
  const sentencePool = sentencesForReadingDifficulty(progress, sessionStats);

  if (useSentence && sentencePool.length > 0) {
    const card = pickRandom(sentencePool);
    const focus = (card.focusWords && card.focusWords[0]) || card.text.split(/\s+/).find((w) => w.length > 2) || "the";
    const key = focus.replace(/[^a-z]/gi, "").toLowerCase();
    const match = wordPool.find((w) => w.word === key) || pickRandom(wordPool);
    const distractors = shuffle(wordPool.filter((w) => w.word !== match.word)).slice(0, 3);
    const choices = shuffle([match.word, ...distractors.map((w) => w.word)]).slice(0, 4);
    return {
      type: "sentence",
      prompt: `From this sentence, find the word: "${card.text}"`,
      correct: match.word,
      choices,
      speakHint: match.word,
      sentenceText: card.text,
    };
  }

  const target = pickRandom(wordPool);
  const distractors = shuffle(wordPool.filter((w) => w.word !== target.word)).slice(0, 3);
  const choices = shuffle([target.word, ...distractors.map((w) => w.word)]).slice(0, 4);
  return {
    type: "word",
    prompt: "Which word matches?",
    correct: target.word,
    choices,
    speakHint: target.word,
    emoji: target.emoji,
  };
}
