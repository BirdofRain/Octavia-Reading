/**
 * Level-based unlock rules for games and bonus modes.
 * Player level comes from progression (XP = max(lifetimeStars, correct)).
 */

import { computeXp, levelFromXp, xpForLevel, levelTitleForLevel } from "./progression.js";
import { resolveDifficultyBand } from "./difficulty.js";

/** @typedef {"core"|"unlockable"|"bonus"} GameCategory */

/**
 * @typedef {object} UnlockableGame
 * @property {string} id
 * @property {string} mode - App route mode key
 * @property {string} title
 * @property {string} emoji
 * @property {string} blurb
 * @property {number} unlockLevel
 * @property {GameCategory} category
 * @property {boolean} [comingSoon]
 */

export const UNLOCKABLE_GAMES = [
  {
    id: "sounds",
    mode: "sounds",
    title: "Sound Pop",
    emoji: "🔊",
    blurb: "Hear a sound. Tap the matching letter.",
    unlockLevel: 1,
    category: "core",
  },
  {
    id: "build",
    mode: "build",
    title: "Build a Word",
    emoji: "🧱",
    blurb: "Tap letters in order and blend them together.",
    unlockLevel: 2,
    category: "core",
  },
  {
    id: "read",
    mode: "read",
    title: "Read It!",
    emoji: "📖",
    blurb: "Read a short sentence with one helper button.",
    unlockLevel: 3,
    category: "core",
  },
  {
    id: "readingMaze",
    mode: "readingMaze",
    title: "Reading Maze",
    emoji: "🧭",
    blurb: "Answer reading clues to walk through the maze.",
    unlockLevel: 3,
    category: "unlockable",
  },
  {
    id: "miniGames",
    mode: "miniGames",
    title: "Star Games",
    emoji: "🎮",
    blurb: "Spend stars on tiny bonus games.",
    unlockLevel: 4,
    category: "bonus",
  },
  {
    id: "math",
    mode: "math",
    title: "Counting & Math",
    emoji: "🔢",
    blurb: "Count objects and solve tiny math stories.",
    unlockLevel: 5,
    category: "bonus",
  },
];

/** Future slot — not implemented; keeps unlock table extensible. */
export const FUTURE_UNLOCKABLES = [
  {
    id: "readingSnake",
    mode: null,
    title: "Reading Snake",
    emoji: "🐍",
    blurb: "Coming in a future update.",
    unlockLevel: 6,
    category: "unlockable",
    comingSoon: true,
  },
];

export function getPlayerLevel(progress) {
  const stored = Number(progress?.level);
  if (Number.isFinite(stored) && stored >= 1) return Math.floor(stored);
  return Math.max(1, levelFromXp(computeXp(progress || {})));
}

export function getProgressSnapshot(progress) {
  const xp = computeXp(progress || {});
  const level = levelFromXp(xp);
  return {
    xp,
    level,
    levelTitle: levelTitleForLevel(level),
    stars: Number(progress?.stars) || 0,
    lifetimeStars: Number(progress?.lifetimeStars) || 0,
    correct: Number(progress?.correct) || 0,
    nextLevelXp: xpForLevel(level + 1),
    currentLevelXp: xp - xpForLevel(level),
  };
}

/**
 * @param {string} gameId
 * @param {object} progress
 */
export function isGameUnlocked(gameId, progress) {
  const game = UNLOCKABLE_GAMES.find((g) => g.id === gameId);
  if (!game) return false;
  if (game.comingSoon) return false;
  return getPlayerLevel(progress) >= game.unlockLevel;
}

/**
 * @param {string} mode
 * @param {object} progress
 */
export function isModeUnlocked(mode, progress) {
  if (mode === "home" || mode === "teacher" || mode === "admin") return true;
  if (mode === "kidRewards") return getPlayerLevel(progress) >= 2;
  const game = UNLOCKABLE_GAMES.find((g) => g.mode === mode);
  if (!game) return false;
  return isGameUnlocked(game.id, progress);
}

/**
 * @param {string} gameId
 * @param {object} progress
 */
export function getGameUnlockState(gameId, progress) {
  const game = UNLOCKABLE_GAMES.find((g) => g.id === gameId) || FUTURE_UNLOCKABLES.find((g) => g.id === gameId);
  if (!game) {
    return { unlocked: false, requirementLabel: "Unknown game", game: null };
  }
  const level = getPlayerLevel(progress);
  const unlocked = !game.comingSoon && level >= game.unlockLevel;
  return {
    game,
    unlocked,
    playerLevel: level,
    requirementLabel: game.comingSoon ? "Coming soon" : `Unlocks at Level ${game.unlockLevel}`,
  };
}

export function listCoreGames() {
  return UNLOCKABLE_GAMES.filter((g) => g.category === "core");
}

export function listUnlockableGames() {
  return [...UNLOCKABLE_GAMES.filter((g) => g.category === "unlockable"), ...FUTURE_UNLOCKABLES];
}

export function listBonusGames() {
  return UNLOCKABLE_GAMES.filter((g) => g.category === "bonus");
}

/** Modes allowed at this level (for progress.unlockedModes). */
export function computeUnlockedModeIds(level) {
  const lv = Math.max(1, Math.floor(level));
  return UNLOCKABLE_GAMES.filter((g) => !g.comingSoon && lv >= g.unlockLevel).map((g) => g.mode);
}

/**
 * Reading / math difficulty band for the current player (re-export pattern).
 * @param {object} progress
 * @param {object} sessionStats
 * @param {"reading"|"math"|"phonics"} domain
 */
export function selectDifficultyBand(progress, sessionStats = {}, domain = "reading") {
  return resolveDifficultyBand(progress, sessionStats, domain);
}

/** True when player level unlocks harder CVC / sentences / 10–20 math tiers. */
export function isAdvancedContentLevel(progress) {
  return getPlayerLevel(progress) >= 5;
}
