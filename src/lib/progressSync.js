import { mergeRewardClaims } from "./rewardClaims.js";
import { syncProgression } from "./progression.js";

/** @param {string|undefined} iso */
export function parseProgressUpdatedAt(iso) {
  const ms = Date.parse(iso || "");
  return Number.isFinite(ms) ? ms : 0;
}

/** Best-effort timestamp when legacy saves lack `updatedAt`. */
export function inferProgressUpdatedAt(progress) {
  if (progress?.updatedAt) return progress.updatedAt;
  let max = 0;
  for (const day of Object.values(progress?.dailyLog || {})) {
    const t = parseProgressUpdatedAt(day?.lastPlayedAt);
    if (t > max) max = t;
  }
  return max ? new Date(max).toISOString() : "";
}

export function getProgressUpdatedAt(progress) {
  return progress?.updatedAt || inferProgressUpdatedAt(progress) || "";
}

export function touchProgressUpdatedAt(progress, at = new Date()) {
  if (!progress || typeof progress !== "object") return progress;
  return { ...progress, updatedAt: at.toISOString() };
}

function mergeDayEntries(a, b) {
  if (!a) return b ? { ...b } : undefined;
  if (!b) return { ...a };

  const aAt = parseProgressUpdatedAt(a.lastPlayedAt);
  const bAt = parseProgressUpdatedAt(b.lastPlayedAt);
  const newer = bAt >= aAt ? b : a;
  const older = bAt >= aAt ? a : b;

  return {
    ...older,
    ...newer,
    stars: Math.max(Number(a.stars) || 0, Number(b.stars) || 0),
    correct: Math.max(Number(a.correct) || 0, Number(b.correct) || 0),
    attempts: Math.max(Number(a.attempts) || 0, Number(b.attempts) || 0),
    soundsCorrect: Math.max(Number(a.soundsCorrect) || 0, Number(b.soundsCorrect) || 0),
    wordsBuilt: Math.max(Number(a.wordsBuilt) || 0, Number(b.wordsBuilt) || 0),
    sentencesRead: Math.max(Number(a.sentencesRead) || 0, Number(b.sentencesRead) || 0),
    countingCorrect: Math.max(Number(a.countingCorrect) || 0, Number(b.countingCorrect) || 0),
    mathCorrect: Math.max(Number(a.mathCorrect) || 0, Number(b.mathCorrect) || 0),
    parentMinutes: Math.max(Number(a.parentMinutes) || 0, Number(b.parentMinutes) || 0),
    opened: Math.max(Number(a.opened) || 0, Number(b.opened) || 0),
    notes: newer.notes || older.notes || "",
    lastPlayedAt: newer.lastPlayedAt || older.lastPlayedAt,
  };
}

/**
 * Merge `secondary` into `primary` (primary wins settings/scalars except explicit max fields).
 * Used after picking the newer document as primary.
 */
export function mergeProgressUnion(primary, secondary) {
  if (!secondary) return primary ? { ...primary } : primary;
  if (!primary) return { ...secondary };

  const primaryFamilies = Array.isArray(primary.totals?.wordFamiliesUsed) ? primary.totals.wordFamiliesUsed : [];
  const secondaryFamilies = Array.isArray(secondary.totals?.wordFamiliesUsed) ? secondary.totals.wordFamiliesUsed : [];
  const mergedFamilies = Array.from(new Set([...primaryFamilies, ...secondaryFamilies])).slice(0, 40);

  const dailyKeys = new Set([
    ...Object.keys(primary.dailyLog || {}),
    ...Object.keys(secondary.dailyLog || {}),
  ]);
  const dailyLog = {};
  for (const key of dailyKeys) {
    dailyLog[key] = mergeDayEntries(primary.dailyLog?.[key], secondary.dailyLog?.[key]);
  }

  return {
    ...secondary,
    ...primary,
    stars: Math.max(Number(primary.stars) || 0, Number(secondary.stars) || 0),
    lifetimeStars: Math.max(Number(primary.lifetimeStars) || 0, Number(secondary.lifetimeStars) || 0),
    correct: Math.max(Number(primary.correct) || 0, Number(secondary.correct) || 0),
    attempts: Math.max(Number(primary.attempts) || 0, Number(secondary.attempts) || 0),
    badges: Array.from(new Set([...(primary.badges || []), ...(secondary.badges || [])])),
    rewardClaims: mergeRewardClaims(primary.rewardClaims, secondary.rewardClaims),
    settings: {
      activeReadingLevel: Math.max(
        Number(primary.settings?.activeReadingLevel) || 1,
        Number(secondary.settings?.activeReadingLevel) || 1
      ),
      activeMathLevel: Math.max(
        Number(primary.settings?.activeMathLevel) || 1,
        Number(secondary.settings?.activeMathLevel) || 1
      ),
      readingTheme:
        primary.settings?.readingTheme === "bird" || secondary.settings?.readingTheme === "bird" ? "bird" : "default",
      teacherFocus: primary.settings?.teacherFocus ?? secondary.settings?.teacherFocus ?? "mixed",
      teacherDifficulty: primary.settings?.teacherDifficulty ?? secondary.settings?.teacherDifficulty ?? "auto",
    },
    totals: {
      ...(secondary.totals || {}),
      ...(primary.totals || {}),
      soundsCorrect: Math.max(Number(primary.totals?.soundsCorrect) || 0, Number(secondary.totals?.soundsCorrect) || 0),
      wordsBuilt: Math.max(Number(primary.totals?.wordsBuilt) || 0, Number(secondary.totals?.wordsBuilt) || 0),
      sentencesRead: Math.max(Number(primary.totals?.sentencesRead) || 0, Number(secondary.totals?.sentencesRead) || 0),
      countingCorrect: Math.max(Number(primary.totals?.countingCorrect) || 0, Number(secondary.totals?.countingCorrect) || 0),
      mathCorrect: Math.max(Number(primary.totals?.mathCorrect) || 0, Number(secondary.totals?.mathCorrect) || 0),
      parentMinutes: Math.max(Number(primary.totals?.parentMinutes) || 0, Number(secondary.totals?.parentMinutes) || 0),
      readingWinsAtLevel2Plus: Math.max(
        Number(primary.totals?.readingWinsAtLevel2Plus) || 0,
        Number(secondary.totals?.readingWinsAtLevel2Plus) || 0
      ),
      wordFamiliesUsed: mergedFamilies,
    },
    dailyLog,
    updatedAt: getProgressUpdatedAt(primary) || getProgressUpdatedAt(secondary),
  };
}

/**
 * Pick the newer snapshot by `updatedAt`, then union in data from the older copy.
 * @param {object|null|undefined} localProgress
 * @param {object|null|undefined} cloudProgress
 * @param {string|undefined} serverUpdatedAt optional row `updated_at` from Supabase
 */
export function reconcileProgress(localProgress, cloudProgress, serverUpdatedAt) {
  if (!cloudProgress) return syncProgression(touchProgressUpdatedAt(localProgress));
  if (!localProgress) return syncProgression(touchProgressUpdatedAt(cloudProgress));

  const localMs = parseProgressUpdatedAt(getProgressUpdatedAt(localProgress));
  const cloudMs = Math.max(
    parseProgressUpdatedAt(getProgressUpdatedAt(cloudProgress)),
    parseProgressUpdatedAt(serverUpdatedAt)
  );

  let merged;
  if (cloudMs > localMs) {
    merged = mergeProgressUnion(cloudProgress, localProgress);
  } else if (localMs > cloudMs) {
    merged = mergeProgressUnion(localProgress, cloudProgress);
  } else {
    merged = mergeProgressUnion(localProgress, cloudProgress);
  }

  const newestMs = Math.max(localMs, cloudMs);
  const stamped =
    newestMs > 0
      ? { ...merged, updatedAt: new Date(newestMs).toISOString() }
      : touchProgressUpdatedAt(merged);

  return syncProgression(stamped);
}

/**
 * @param {{ configured?: boolean, authEmail?: string|null, syncStatus?: string }} cloud
 */
export function getCloudSyncStatus(cloud = {}) {
  const configured = Boolean(cloud.configured);
  const signedIn = Boolean(cloud.authEmail);
  const status = String(cloud.syncStatus || "");

  if (!configured) {
    return {
      id: "unconfigured",
      label: "Offline / local only",
      detail: "Cloud is not configured on this device (missing Supabase env).",
    };
  }
  if (!signedIn) {
    return {
      id: "offline",
      label: "Offline / local only",
      detail: "Progress is stored in this browser until you sign in to the family account.",
    };
  }
  if (status === "syncing") {
    return { id: "saving", label: "Saving", detail: "Uploading progress to the cloud…" };
  }
  if (status === "error") {
    return {
      id: "error",
      label: "Sync error",
      detail: "Could not reach the cloud. Your latest changes are still on this device.",
    };
  }
  if (status === "saved") {
    return { id: "saved", label: "Saved", detail: "Progress is saved to this device and your family account." };
  }
  return {
    id: "saved",
    label: "Saved",
    detail: "Signed in. Changes save here first, then sync to the cloud automatically.",
  };
}
