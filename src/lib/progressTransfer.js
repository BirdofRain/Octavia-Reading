/** Safe progress export/import for parents (no auth secrets). */

import { getCloudSyncStatus } from "./progressSync.js";

const SENSITIVE_KEY_RE = /password|token|secret|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|session|credential/i;

const EXPORT_ROOT_KEYS = [
  "childName",
  "version",
  "stars",
  "lifetimeStars",
  "correct",
  "attempts",
  "level",
  "xp",
  "levelTitle",
  "nextLevelXp",
  "currentLevelXp",
  "badges",
  "rewardClaims",
  "dailyLog",
  "totals",
  "settings",
  "updatedAt",
];

function stripSensitive(value, depth = 0) {
  if (depth > 12) return undefined;
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => stripSensitive(item, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) continue;
    out[key] = stripSensitive(val, depth + 1);
  }
  return out;
}

/** Build export object with only learning progress fields (no auth). */
export function buildProgressExportPayload(progress) {
  const safe = stripSensitive(progress && typeof progress === "object" ? progress : {});
  const payload = { exportedAt: new Date().toISOString() };

  for (const key of EXPORT_ROOT_KEYS) {
    if (safe[key] !== undefined) payload[key] = safe[key];
  }

  return payload;
}

export function formatProgressExportJson(progress) {
  return JSON.stringify(buildProgressExportPayload(progress), null, 2);
}

export function validateProgressImportShape(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Progress JSON must be a single object (not a list)." };
  }

  const hasSignal =
    "dailyLog" in raw ||
    "childName" in raw ||
    "version" in raw ||
    typeof raw.stars === "number" ||
    typeof raw.lifetimeStars === "number";

  if (!hasSignal) {
    return {
      ok: false,
      error: "This file does not look like Octavia Reading Quest progress (missing dailyLog, childName, version, or stars).",
    };
  }

  if (raw.dailyLog != null && (typeof raw.dailyLog !== "object" || Array.isArray(raw.dailyLog))) {
    return { ok: false, error: "dailyLog must be an object keyed by date (YYYY-MM-DD)." };
  }

  if (raw.totals != null && (typeof raw.totals !== "object" || Array.isArray(raw.totals))) {
    return { ok: false, error: "totals must be an object." };
  }

  return { ok: true, data: stripSensitive(raw) };
}

export function parseProgressImportText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Paste progress JSON first." };
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Could not parse JSON. Check for missing commas or extra text." };
  }

  return validateProgressImportShape(parsed);
}

/**
 * @param {{ configured?: boolean, authEmail?: string|null, syncStatus?: string }} cloud
 */
export function getProgressSaveModeLabel(cloud = {}) {
  const sync = getCloudSyncStatus(cloud);
  const idMap = { unconfigured: "local", offline: "local", saving: "synced", saved: "synced", error: "fallback" };
  return { id: idMap[sync.id] || "unknown", label: sync.label, detail: sync.detail };
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
