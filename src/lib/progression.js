/** Player level / XP derived from lifetime progress (not spendable stars). */

export const LEVEL_TITLES = [
  "Letter Listener",
  "Sound Scout",
  "Word Builder",
  "Sentence Starter",
  "Reading Ranger",
  "Math Explorer",
  "Bird Book Buddy",
  "Story Sprinter",
  "Phonics Pathfinder",
  "Learning Champion",
];

/** Minimum total XP required to reach each level (1–10). */
const LEVEL_XP_THRESHOLDS = [0, 10, 25, 45, 70, 100, 135, 175, 220, 270];

const XP_PER_LEVEL_AFTER_10 = 60;

/** XP needed to reach `level` (level 1 = 0). */
export function xpForLevel(level) {
  const lv = Math.max(1, Math.floor(level));
  if (lv <= 10) return LEVEL_XP_THRESHOLDS[lv - 1] ?? 0;
  return LEVEL_XP_THRESHOLDS[9] + (lv - 10) * XP_PER_LEVEL_AFTER_10;
}

export function levelFromXp(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let level = 1;
  while (safeXp >= xpForLevel(level + 1)) {
    level += 1;
    if (level > 500) break;
  }
  return level;
}

export function levelTitleForLevel(level) {
  if (level <= LEVEL_TITLES.length) return LEVEL_TITLES[level - 1];
  return LEVEL_TITLES[LEVEL_TITLES.length - 1];
}

/**
 * XP from lifetimeStars + correct (uses higher of the two so old saves stay fair).
 * Spending stars does not reduce XP.
 */
export function computeXp(progress) {
  const lifetime = Math.max(0, Number(progress?.lifetimeStars) || 0);
  const correct = Math.max(0, Number(progress?.correct) || 0);
  const stored = Math.max(0, Number(progress?.xp) || 0);
  const derived = Math.max(lifetime, correct);
  return Math.max(stored, derived);
}

function computeUnlockedModes(level) {
  const modes = ["sounds", "home"];
  if (level >= 2) modes.push("build", "kidRewards");
  if (level >= 3) modes.push("read", "readingMaze");
  if (level >= 4) modes.push("miniGames");
  if (level >= 5) modes.push("math");
  return modes;
}

function skillRankFromCount(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n >= 30) return 4;
  if (n >= 15) return 3;
  if (n >= 5) return 2;
  return 1;
}

function computeSkillRanks(totals = {}) {
  const sounds = totals.soundsCorrect || 0;
  const reading = (totals.wordsBuilt || 0) + (totals.sentencesRead || 0);
  const math = (totals.countingCorrect || 0) + (totals.mathCorrect || 0);
  return {
    phonicsRank: skillRankFromCount(sounds),
    readingRank: skillRankFromCount(reading),
    mathRank: skillRankFromCount(math),
  };
}

/** Recompute and attach progression fields (safe to call after every progress change). */
export function syncProgression(progress) {
  if (!progress || typeof progress !== "object") return progress;

  const xp = computeXp(progress);
  const level = levelFromXp(xp);
  const levelStart = xpForLevel(level);
  const nextStart = xpForLevel(level + 1);
  const span = Math.max(1, nextStart - levelStart);

  return {
    ...progress,
    xp,
    level,
    levelTitle: levelTitleForLevel(level),
    nextLevelXp: nextStart,
    currentLevelXp: xp - levelStart,
    unlockedModes: computeUnlockedModes(level),
    skillRanks: computeSkillRanks(progress.totals),
    progression: {
      levelXpSpan: span,
      progressPct: Math.min(100, Math.round(((xp - levelStart) / span) * 100)),
    },
  };
}

export function defaultProgressionFields() {
  return syncProgression({
    lifetimeStars: 0,
    correct: 0,
    xp: 0,
    totals: {},
  });
}
