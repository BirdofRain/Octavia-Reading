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

/** True when progress looks like a fresh wipe (no earned lifetime progress). */
export function isBlankProgress(progress) {
  if (!progress || typeof progress !== "object") return true;
  const lifetime = Number(progress.lifetimeStars) || 0;
  const correct = Number(progress.correct) || 0;
  const badges = Array.isArray(progress.badges) ? progress.badges.length : 0;
  return lifetime === 0 && correct === 0 && badges === 0;
}

/** True when progress has earned stars, badges, or correct answers. */
export function hasMeaningfulProgress(progress) {
  if (!progress || typeof progress !== "object") return false;
  const lifetime = Number(progress.lifetimeStars) || 0;
  const correct = Number(progress.correct) || 0;
  const badges = Array.isArray(progress.badges) ? progress.badges.length : 0;
  return lifetime > 0 || correct > 0 || badges > 0;
}

/**
 * True when saving `incoming` would erase higher cloud progress.
 * @param {object|null|undefined} incoming
 * @param {object|null|undefined} existing
 */
export function wouldCauseProgressLoss(incoming, existing) {
  if (!existing || !hasMeaningfulProgress(existing)) return false;
  if (!incoming) return true;

  const inLifetime = Number(incoming.lifetimeStars) || 0;
  const exLifetime = Number(existing.lifetimeStars) || 0;
  const inBadges = new Set(Array.isArray(incoming.badges) ? incoming.badges : []);
  const exBadges = Array.isArray(existing.badges) ? existing.badges : [];

  if (isBlankProgress(incoming) && hasMeaningfulProgress(existing)) return true;
  if (inLifetime < exLifetime) return true;
  if (inLifetime === 0 && exBadges.length > 0 && inBadges.size === 0) return true;
  if (exBadges.some((id) => !inBadges.has(id)) && inLifetime === 0 && inBadges.size === 0) return true;

  return false;
}

function mergeSpendableStars(primary, secondary) {
  const p = Number(primary?.stars) || 0;
  const s = Number(secondary?.stars) || 0;
  if (isBlankProgress(primary) && s > 0) return s;
  if (isBlankProgress(secondary) && p > 0) return p;
  return Math.max(p, s);
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
    letterEchoCompleted: Math.max(Number(a.letterEchoCompleted) || 0, Number(b.letterEchoCompleted) || 0),
    wordsBuilt: Math.max(Number(a.wordsBuilt) || 0, Number(b.wordsBuilt) || 0),
    helpedWordsBuilt: Math.max(Number(a.helpedWordsBuilt) || 0, Number(b.helpedWordsBuilt) || 0),
    mazeCompleted: Math.max(Number(a.mazeCompleted) || 0, Number(b.mazeCompleted) || 0),
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

  const primaryLevel = Number(primary.level) || 0;
  const secondaryLevel = Number(secondary.level) || 0;

  return {
    ...secondary,
    ...primary,
    stars: mergeSpendableStars(primary, secondary),
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
      celebrationFrequency: primary.settings?.celebrationFrequency ?? secondary.settings?.celebrationFrequency ?? "calm",
      phonicsAudioEnabled:
        primary.settings?.phonicsAudioEnabled !== false && secondary.settings?.phonicsAudioEnabled !== false,
    },
    totals: {
      ...(secondary.totals || {}),
      ...(primary.totals || {}),
      soundsCorrect: Math.max(Number(primary.totals?.soundsCorrect) || 0, Number(secondary.totals?.soundsCorrect) || 0),
      letterEchoCompleted: Math.max(
        Number(primary.totals?.letterEchoCompleted) || 0,
        Number(secondary.totals?.letterEchoCompleted) || 0
      ),
      wordsBuilt: Math.max(Number(primary.totals?.wordsBuilt) || 0, Number(secondary.totals?.wordsBuilt) || 0),
      helpedWordsBuilt: Math.max(Number(primary.totals?.helpedWordsBuilt) || 0, Number(secondary.totals?.helpedWordsBuilt) || 0),
      mazeCompleted: Math.max(Number(primary.totals?.mazeCompleted) || 0, Number(secondary.totals?.mazeCompleted) || 0),
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
    level: Math.max(primaryLevel, secondaryLevel),
    updatedAt: getProgressUpdatedAt(primary) || getProgressUpdatedAt(secondary),
  };
}

/**
 * Pick the newer snapshot by `updatedAt`, then union in data from the older copy.
 * @param {object|null|undefined} localProgress
 * @param {object|null|undefined} cloudProgress
 * @param {string|undefined} serverUpdatedAt optional row `updated_at` from Supabase
 * @returns {{ progress: object, conflictResolved: boolean }}
 */
export function reconcileProgressWithMeta(localProgress, cloudProgress, serverUpdatedAt) {
  if (!cloudProgress) {
    return { progress: syncProgression(touchProgressUpdatedAt(localProgress)), conflictResolved: false };
  }
  if (!localProgress) {
    return { progress: syncProgression(touchProgressUpdatedAt(cloudProgress)), conflictResolved: false };
  }

  const localMs = parseProgressUpdatedAt(getProgressUpdatedAt(localProgress));
  const cloudMs = Math.max(
    parseProgressUpdatedAt(getProgressUpdatedAt(cloudProgress)),
    parseProgressUpdatedAt(serverUpdatedAt)
  );

  const conflictDetected =
    wouldCauseProgressLoss(localProgress, cloudProgress) ||
    (isBlankProgress(localProgress) && hasMeaningfulProgress(cloudProgress));

  if (conflictDetected) {
    console.warn(
      "[progress] Possible progress conflict — keeping highest lifetime progress (local blank or lower than cloud)."
    );
  }

  let primary;
  let secondary;
  if (cloudMs > localMs) {
    primary = cloudProgress;
    secondary = localProgress;
  } else if (localMs > cloudMs) {
    primary = localProgress;
    secondary = cloudProgress;
  } else {
    primary = localProgress;
    secondary = cloudProgress;
  }

  let merged = mergeProgressUnion(primary, secondary);

  if (wouldCauseProgressLoss(merged, cloudProgress) && hasMeaningfulProgress(cloudProgress)) {
    merged = mergeProgressUnion(cloudProgress, localProgress);
  }

  const newestMs = Math.max(localMs, cloudMs);
  const stamped =
    newestMs > 0
      ? { ...merged, updatedAt: new Date(newestMs).toISOString() }
      : touchProgressUpdatedAt(merged);

  return {
    progress: syncProgression(stamped),
    conflictResolved: conflictDetected || wouldCauseProgressLoss(localProgress, cloudProgress),
  };
}

/**
 * @param {object|null|undefined} localProgress
 * @param {object|null|undefined} cloudProgress
 * @param {string|undefined} serverUpdatedAt
 */
export function reconcileProgress(localProgress, cloudProgress, serverUpdatedAt) {
  return reconcileProgressWithMeta(localProgress, cloudProgress, serverUpdatedAt).progress;
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
      id: "offline",
      label: "Cloud unavailable — using this device",
      detail: "Progress is saved on this device.",
    };
  }
  if (!signedIn) {
    return {
      id: "offline",
      label: "Cloud unavailable — using this device",
      detail: "Sign in to the family account to sync progress across devices.",
    };
  }
  if (status === "syncing") {
    return { id: "saving", label: "Saving…", detail: "Uploading progress to the cloud." };
  }
  if (status === "conflict") {
    return {
      id: "conflict",
      label: "Possible progress conflict — restored highest progress",
      detail: "We kept the highest stars and badges from this device and the cloud.",
    };
  }
  if (status === "error") {
    return {
      id: "error",
      label: "Cloud unavailable — using this device",
      detail: "Could not reach the cloud. Your latest changes are still on this device.",
    };
  }
  if (status === "saved" || status === "signed_in") {
    return { id: "saved", label: "Synced", detail: "Progress is saved on this device and your family account." };
  }
  return {
    id: "saved",
    label: "Synced",
    detail: "Signed in. Changes save here first, then sync to the cloud automatically.",
  };
}
