/**
 * Player-level difficulty bands, gentle adaptive tuning, and session de-duplication.
 */

import { applyTeacherDifficultyToBand } from "./teacherMode.js";

const MAX_CONTENT_TIER = 6;
const MAX_RECENT_ITEMS = 12;
const ADAPT_MIN_ATTEMPTS = 4;

export function clampContentTier(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.min(MAX_CONTENT_TIER, Math.max(1, Math.round(x)));
}

/**
 * @param {{ level?: number, settings?: { activeReadingLevel?: number, activeMathLevel?: number } }} progress
 * @param {{ correctRate?: number|null, attempts?: number }} sessionStats
 * @param {"reading"|"math"|"phonics"} domain
 */
export function resolveDifficultyBand(progress, sessionStats = {}, domain = "reading") {
  const playerLevel = Math.max(1, Number(progress?.level) || 1);
  const parentKey = domain === "math" ? "activeMathLevel" : "activeReadingLevel";
  const parentCap = clampContentTier(progress?.settings?.[parentKey] ?? 1);

  let minTier = 1;
  let maxTier = domain === "phonics" ? Math.min(4, parentCap) : Math.min(4, parentCap);

  if (playerLevel >= 8) {
    minTier = domain === "phonics" ? 3 : 3;
    maxTier = 6;
  } else if (playerLevel >= 5) {
    minTier = domain === "phonics" ? 2 : 2;
    maxTier = 5;
  }

  if (playerLevel >= 5) {
    maxTier = Math.max(maxTier, playerLevel >= 8 ? 6 : 5);
  } else {
    maxTier = Math.min(maxTier, parentCap);
  }

  const attempts = Number(sessionStats.attempts) || 0;
  const rate = sessionStats.correctRate;

  if (attempts >= ADAPT_MIN_ATTEMPTS && rate != null && Number.isFinite(rate)) {
    if (rate >= 0.8) {
      minTier = clampContentTier(minTier + 1);
      maxTier = clampContentTier(maxTier + 1);
    } else if (rate < 0.6) {
      minTier = clampContentTier(minTier - 1);
      maxTier = clampContentTier(Math.max(minTier, maxTier - 1));
    }
  }

  if (playerLevel < 5) {
    maxTier = Math.min(maxTier, parentCap);
  }

  const maxCount =
    domain === "math"
      ? playerLevel >= 8
        ? 20
        : playerLevel >= 5
          ? 15
          : 10
      : 10;

  const band = { minTier, maxTier, maxCount, playerLevel, parentCap };
  return applyTeacherDifficultyToBand(band, progress?.settings?.teacherDifficulty);
}

export function filterByDifficultyBand(items, band, getLevel = (item) => item.level) {
  const minTier = clampContentTier(band.minTier);
  const maxTier = clampContentTier(band.maxTier);
  const filtered = (items || []).filter((item) => {
    const lv = clampContentTier(getLevel(item));
    return lv >= minTier && lv <= maxTier;
  });
  if (filtered.length > 0) return filtered;
  return (items || []).filter((item) => clampContentTier(getLevel(item)) <= Math.max(1, maxTier));
}

export function filterCountingByBand(items, band) {
  const { minTier, maxTier, maxCount } = band;
  const filtered = (items || []).filter((item) => {
    const lv = clampContentTier(item.level);
    const count = Number(item.count) || 0;
    return lv >= minTier && lv <= maxTier && count <= maxCount;
  });
  if (filtered.length > 0) return filtered;
  return (items || []).filter((item) => (Number(item.count) || 0) <= maxCount);
}

/** Per-game session: track accuracy and avoid repeating items. */
export function createGameSession() {
  const recentKeys = [];

  let attempts = 0;
  let correct = 0;

  return {
    recordAttempt(wasCorrect) {
      attempts += 1;
      if (wasCorrect) correct += 1;
    },
    getStats() {
      return {
        attempts,
        correct,
        correctRate: attempts > 0 ? correct / attempts : 0,
      };
    },
    pickFromPool(pool, getKey) {
      if (!Array.isArray(pool) || pool.length === 0) return null;
      const fresh = pool.filter((item) => !recentKeys.includes(getKey(item)));
      const source = fresh.length > 0 ? fresh : pool;
      const choice = source[Math.floor(Math.random() * source.length)];
      const key = getKey(choice);
      recentKeys.unshift(key);
      while (recentKeys.length > MAX_RECENT_ITEMS) recentKeys.pop();
      return choice;
    },
    reset() {
      attempts = 0;
      correct = 0;
      recentKeys.length = 0;
    },
  };
}

function mathEquationResult(fact) {
  if (fact.missing === "a" || fact.missing === "b") {
    if (fact.op === "+") return fact.a + fact.b;
    if (fact.op === "-") return fact.a - fact.b;
  }
  return fact.answer;
}

export function formatMathEquation(fact) {
  if (!fact) return "?";
  const result = mathEquationResult(fact);
  if (fact.missing === "a") {
    return `__ ${fact.op} ${fact.b} = ${result}`;
  }
  if (fact.missing === "b") {
    return `${fact.a} ${fact.op} __ = ${result}`;
  }
  return `${fact.a} ${fact.op} ${fact.b} = ?`;
}
