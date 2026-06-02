import React, { useMemo, useState } from "react";
import { BADGE_CATALOG } from "./data/badges.js";
import {
  createProgressBackup,
  getBackupPreview,
  listProgressBackups,
} from "./lib/progressBackup.js";
import { applyProgressRepair } from "./lib/progressRepair.js";

export function ParentProgressTools({
  progress,
  onApplyProgress,
  onResetDeviceOnly,
  onResetEverywhere,
  getStreak,
  pinGate = false,
  adminPin,
  adminPinWords,
  allowCloudResetUnlock = false,
}) {
  const [pin, setPin] = useState("");
  const [pinUnlocked, setPinUnlocked] = useState(!pinGate);
  const [resetConfirm, setResetConfirm] = useState("");
  const [cloudResetUnlocked, setCloudResetUnlocked] = useState(false);
  const [backupMessage, setBackupMessage] = useState(null);
  const [restoreKey, setRestoreKey] = useState("");
  const [restorePreview, setRestorePreview] = useState(null);
  const [repairLifetime, setRepairLifetime] = useState(String(progress.lifetimeStars ?? ""));
  const [repairSpendable, setRepairSpendable] = useState(String(progress.stars ?? ""));
  const [repairCorrect, setRepairCorrect] = useState(String(progress.correct ?? ""));
  const [repairBadges, setRepairBadges] = useState(new Set(progress.badges || []));
  const [repairSaved, setRepairSaved] = useState(false);

  const backups = useMemo(() => listProgressBackups(), [backupMessage, progress.updatedAt]);

  if (pinGate && !pinUnlocked) {
    return (
      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-violet-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Progress recovery</h2>
        <p className="mt-2 font-semibold text-slate-600">Enter the parent PIN to access backup, repair, and reset tools.</p>
        {adminPinWords && (
          <p className="mt-2 text-sm font-semibold text-slate-600">
            PIN clue: <strong>{adminPinWords}</strong>
          </p>
        )}
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          type="password"
          placeholder="Enter PIN"
          className="mt-4 w-full rounded-2xl border-2 border-slate-900 px-4 py-3 text-center text-xl font-black"
        />
        <button
          type="button"
          onClick={() => setPinUnlocked(pin === adminPin)}
          className="rq-button mt-3 w-full rounded-2xl border-2 border-slate-900 bg-emerald-200 px-5 py-3 text-lg font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
        >
          Unlock recovery tools
        </button>
      </section>
    );
  }

  const flash = (msg) => {
    setBackupMessage(msg);
    window.setTimeout(() => setBackupMessage(null), 4000);
  };

  const handlePreviewBackup = (key) => {
    setRestoreKey(key);
    const result = getBackupPreview(key, getStreak);
    if (result.ok) {
      setRestorePreview(result.preview);
    } else {
      setRestorePreview(null);
      flash(result.error || "Could not read backup");
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreKey) return;
    const result = getBackupPreview(restoreKey, getStreak);
    if (!result.ok) {
      flash(result.error || "Could not restore backup");
      return;
    }
    await onApplyProgress(result.progress, { restore: true });
    flash("Backup restored and synced.");
  };

  const handleRepairSave = async () => {
    const repaired = applyProgressRepair(progress, {
      lifetimeStars: repairLifetime,
      stars: repairSpendable,
      correct: repairCorrect,
      badgeIds: Array.from(repairBadges),
    });
    await onApplyProgress(repaired, { repair: true });
    setRepairSaved(true);
    window.setTimeout(() => setRepairSaved(false), 2000);
  };

  const toggleBadge = (id) => {
    setRepairBadges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResetDevice = async () => {
    if (resetConfirm !== "RESET") {
      flash('Type RESET in the box to confirm.');
      return;
    }
    const backup = createProgressBackup(progress);
    if (!backup.ok) {
      flash(backup.error || "Could not create backup");
      return;
    }
    await onResetDeviceOnly();
    flash(`Backup created (${backup.key.replace("ltr_progress_backup_", "").replace(/_/g, "-")}). Device reset complete.`);
    setResetConfirm("");
  };

  const handleResetEverywhere = async () => {
    if (resetConfirm !== "RESET") {
      flash('Type RESET in the box to confirm.');
      return;
    }
    if (!cloudResetUnlocked) {
      flash("Enable “Reset cloud progress too” in Admin first.");
      return;
    }
    const backup = createProgressBackup(progress);
    if (!backup.ok) {
      flash(backup.error || "Could not create backup");
      return;
    }
    await onResetEverywhere();
    flash(`Backup created. Cloud and device progress reset.`);
    setResetConfirm("");
  };

  return (
    <>
      {backupMessage && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-700 bg-emerald-100 px-4 py-3 font-bold text-emerald-950">
          {backupMessage}
        </div>
      )}

      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Restore progress backup</h2>
        <p className="mt-1 font-semibold text-slate-600">Backups are saved on this device before any reset.</p>
        {backups.length === 0 ? (
          <p className="mt-4 font-semibold text-slate-500">No backups yet.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {backups.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => handlePreviewBackup(b.key)}
                className={`rq-button rounded-2xl border-2 border-slate-900 px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)] ${
                  restoreKey === b.key ? "bg-sky-200" : "bg-slate-50"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
        {restorePreview && (
          <div className="mt-4 rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 text-sm font-semibold">
            <p>Level: <strong>{restorePreview.level}</strong></p>
            <p>Lifetime stars: <strong>{restorePreview.lifetimeStars}</strong></p>
            <p>Spendable stars: <strong>{restorePreview.spendableStars}</strong></p>
            <p>Badges: <strong>{restorePreview.badgesCount}</strong></p>
            <p>Correct count: <strong>{restorePreview.correct}</strong></p>
            <p>Streak: <strong>{restorePreview.streak ?? "—"}</strong></p>
            <button
              type="button"
              onClick={handleRestoreBackup}
              className="rq-button mt-3 rounded-2xl border-2 border-slate-900 bg-emerald-200 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
            >
              Restore this backup
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-amber-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Repair progress</h2>
        <p className="mt-1 font-semibold text-slate-600">
          Fix stars, XP, or badges manually. Player level is calculated from lifetime stars and correct count — set those to adjust level.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-black">Lifetime stars</span>
            <input
              type="number"
              min="0"
              value={repairLifetime}
              onChange={(e) => setRepairLifetime(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-900 px-3 py-2 font-bold"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black">Spendable stars</span>
            <input
              type="number"
              min="0"
              value={repairSpendable}
              onChange={(e) => setRepairSpendable(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-900 px-3 py-2 font-bold"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black">Correct / XP count</span>
            <input
              type="number"
              min="0"
              value={repairCorrect}
              onChange={(e) => setRepairCorrect(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-slate-900 px-3 py-2 font-bold"
            />
          </label>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Current level: <strong>{progress.level || 1}</strong> ({progress.levelTitle || "—"}) — derived from XP, not stored directly.
        </p>
        <p className="mt-4 font-black text-slate-800">Badges</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {BADGE_CATALOG.map((badge) => (
            <label
              key={badge.id}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 border-slate-900 px-3 py-2 ${
                repairBadges.has(badge.id) ? "bg-yellow-100" : "bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={repairBadges.has(badge.id)}
                onChange={() => toggleBadge(badge.id)}
                className="h-5 w-5"
              />
              <span>{badge.emoji} {badge.name}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRepairSave}
          className="rq-button mt-4 rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
        >
          {repairSaved ? "Saved & syncing!" : "Save repair & sync to cloud"}
        </button>
      </section>

      <section className="mt-6 rounded-[2rem] border-2 border-rose-300 bg-rose-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Reset progress</h2>
        <p className="mt-1 font-semibold text-slate-700">
          A timestamped backup is created automatically before any reset. Cloud progress is not affected unless you explicitly reset everywhere.
        </p>
        <label className="mt-4 block">
          <span className="text-sm font-black">Type RESET to confirm</span>
          <input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="RESET"
            className="mt-1 w-full rounded-xl border-2 border-slate-900 px-3 py-2 font-black uppercase"
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleResetDevice}
            disabled={resetConfirm !== "RESET"}
            className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)] disabled:opacity-45"
          >
            Reset this device only
            <span className="block text-sm font-bold text-slate-600">Clears this browser. Cloud progress stays safe.</span>
          </button>
          {allowCloudResetUnlock && (
            <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
              <label className="flex items-start gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={cloudResetUnlocked}
                  onChange={(e) => setCloudResetUnlocked(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
                <span>Unlock “Reset cloud progress too”</span>
              </label>
              <button
                type="button"
                onClick={handleResetEverywhere}
                disabled={resetConfirm !== "RESET" || !cloudResetUnlocked}
                className="rq-button mt-3 w-full rounded-2xl border-2 border-slate-900 bg-rose-300 px-4 py-3 font-black shadow-[0_3px_0_rgba(15,23,42,1)] disabled:opacity-45"
              >
                Reset cloud progress too
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
