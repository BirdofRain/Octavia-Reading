import { syncProgression } from "./progression.js";
import { touchProgressUpdatedAt } from "./progressSync.js";

/**
 * Apply parent repair fields. Player level is derived from lifetimeStars/correct (XP), not stored directly.
 * @param {object} progress
 * @param {{ lifetimeStars?: number, stars?: number, correct?: number, badgeIds?: string[] }} fields
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
  if (Array.isArray(fields.badgeIds)) {
    next.badges = Array.from(new Set(fields.badgeIds.filter(Boolean)));
  }

  return syncProgression(touchProgressUpdatedAt(next));
}
