const BACKUP_PREFIX = "ltr_progress_backup_";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @returns {string} e.g. ltr_progress_backup_2026_06_02_14_30_45 */
export function buildBackupStorageKey(date = new Date()) {
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const s = pad2(date.getSeconds());
  return `${BACKUP_PREFIX}${y}_${mo}_${d}_${h}_${mi}_${s}`;
}

function parseBackupKey(key) {
  if (!key.startsWith(BACKUP_PREFIX)) return null;
  const parts = key.slice(BACKUP_PREFIX.length).split("_");
  if (parts.length !== 6) return null;
  const [y, mo, d, h, mi, s] = parts.map(Number);
  const createdAt = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { key, createdAt };
}

/** @param {object} progress */
export function createProgressBackup(progress) {
  const key = buildBackupStorageKey();
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    return { ok: true, key };
  } catch (e) {
    return { ok: false, error: e?.message || "Could not save backup" };
  }
}

/** @returns {Array<{ key: string, createdAt: Date, label: string }>} */
export function listProgressBackups() {
  const items = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      const parsed = parseBackupKey(key);
      if (!parsed) continue;
      items.push({
        key: parsed.key,
        createdAt: parsed.createdAt,
        label: parsed.createdAt.toLocaleString(),
      });
    }
  } catch {
    return [];
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

/** @param {string} key */
export function loadProgressBackup(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ok: false, error: "Backup not found" };
    const progress = JSON.parse(raw);
    if (!progress || typeof progress !== "object") return { ok: false, error: "Invalid backup data" };
    return { ok: true, progress };
  } catch (e) {
    return { ok: false, error: e?.message || "Could not read backup" };
  }
}

/** @param {object} progress */
export function previewProgressBackup(progress) {
  const badges = Array.isArray(progress?.badges) ? progress.badges : [];
  return {
    level: Number(progress?.level) || 1,
    lifetimeStars: Number(progress?.lifetimeStars) || 0,
    spendableStars: Number(progress?.stars) || 0,
    badgesCount: badges.length,
    correct: Number(progress?.correct) || 0,
    streak: Number(progress?.streakPreview) || null,
  };
}

/** @param {string} key @param {(dailyLog: object) => number} getStreak */
export function getBackupPreview(key, getStreak) {
  const loaded = loadProgressBackup(key);
  if (!loaded.ok) return loaded;
  const preview = previewProgressBackup(loaded.progress);
  if (typeof getStreak === "function") {
    preview.streak = getStreak(loaded.progress?.dailyLog || {});
  }
  return { ok: true, progress: loaded.progress, preview };
}
