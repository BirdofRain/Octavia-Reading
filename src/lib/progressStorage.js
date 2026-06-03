/** Canonical browser storage for Reading Quest progress. */

export const PROGRESS_STORAGE_KEY = "octavia-reading-quest-progress";
export const TEST_MODE_STORAGE_KEY = "octavia-test-mode";

export function readProgressFromLocalStorage() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {object} progress */
export function writeProgressToLocalStorage(progress) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch (e) {
    console.error("[progress-repair] localStorage write failed", e);
    return false;
  }
}
