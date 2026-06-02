import { syncProgression, xpForLevel } from "./progression.js";
import { touchProgressUpdatedAt } from "./progressSync.js";

/**
 * Honor explicit level/xp fields from parent JSON import or repair.
 * Level is normally derived from XP — this maps a target level to lifetimeStars/correct.
 */
export function honorParentProgressFields(raw) {
  if (!raw || typeof raw !== "object") return raw;

  const next = { ...raw };
  const lifetime = Math.max(0, Number(raw.lifetimeStars) || 0);
  const correct = Math.max(0, Number(raw.correct) || 0);
  const xp = Math.max(0, Number(raw.xp) || 0);
  const level = Math.max(0, Number(raw.level) || 0);

  let targetXp = Math.max(lifetime, correct, xp);
  if (level > 1) {
    targetXp = Math.max(targetXp, xpForLevel(level));
  }

  if (targetXp > 0) {
    next.lifetimeStars = Math.max(lifetime, targetXp);
    next.correct = Math.max(correct, targetXp);
  }

  return next;
}

/**
 * Apply parent repair fields. Player level is derived from lifetimeStars/correct (XP), not stored directly.
 * @param {object} progress
 * @param {{ lifetimeStars?: number, stars?: number, correct?: number, targetLevel?: number, badgeIds?: string[] }} fields
 */
export function applyProgressRepair(progress, fields = {}) {
  if (!progress || typeof progress !== "object") return progress;

  const next = { ...progress };

  if (fields.lifetimeStars != null && fields.lifetimeStars !== "") {
    next.lifetimeStars = Math.max(0, Number(fields.lifetimeStars) || 0);
  }
  if (fields.stars != null && fields.stars !== "") {
    next.stars = Math.max(0, Number(fields.stars) || 0);
  }
  if (fields.correct != null && fields.correct !== "") {
    next.correct = Math.max(0, Number(fields.correct) || 0);
  }
  if (fields.targetLevel != null && fields.targetLevel !== "") {
    const lv = Math.max(1, Math.floor(Number(fields.targetLevel) || 1));
    const targetXp = xpForLevel(lv);
    next.lifetimeStars = Math.max(Number(next.lifetimeStars) || 0, targetXp);
    next.correct = Math.max(Number(next.correct) || 0, targetXp);
  }
  if (Array.isArray(fields.badgeIds)) {
    next.badges = Array.from(new Set(fields.badgeIds.filter(Boolean)));
  }

  return syncProgression(touchProgressUpdatedAt(next));
}
