import React, { useEffect, useState } from "react";
import {
  TEACHER_FOCUS_OPTIONS,
  TEACHER_DIFFICULTY_OPTIONS,
  CELEBRATION_FREQUENCY_OPTIONS,
  getTeacherRecommendation,
  normalizeTeacherFocus,
  normalizeTeacherDifficulty,
  normalizeCelebrationFrequency,
} from "./lib/teacherMode.js";
import { ProgressTransferPanel } from "./ProgressTransferPanel.jsx";
import { getCloudSyncStatus } from "./lib/progressSync.js";
import { ParentProgressTools } from "./ParentProgressTools.jsx";

export function TeacherMode({
  progress,
  setProgress,
  setMode,
  todayKey,
  normalizeDayEntry,
  cloud,
  onImportProgress,
  onApplyProgress,
  onResetDeviceOnly,
  onResetEverywhere,
  getStreak,
  adminPin,
  adminPinWords,
}) {
  const today = normalizeDayEntry(progress.dailyLog[todayKey]);
  const recommendation = getTeacherRecommendation(today, progress);
  const [note, setNote] = useState(today.notes || "");
  const [noteSaved, setNoteSaved] = useState(false);
  const focus = normalizeTeacherFocus(progress.settings?.teacherFocus);
  const difficulty = normalizeTeacherDifficulty(progress.settings?.teacherDifficulty);
  const celebrationFrequency = normalizeCelebrationFrequency(progress.settings?.celebrationFrequency);
  const correctRate = today.attempts > 0 ? Math.round((today.correct / today.attempts) * 100) : null;

  useEffect(() => {
    setNote(today.notes || "");
  }, [today.notes]);

  const patchSettings = (patch) => {
    setProgress((old) => ({
      ...old,
      settings: { ...(old.settings || {}), ...patch },
    }));
  };

  const saveNote = () => {
    setProgress((old) => ({
      ...old,
      dailyLog: {
        ...old.dailyLog,
        [todayKey]: {
          ...normalizeDayEntry(old.dailyLog[todayKey]),
          notes: note,
          lastPlayedAt: new Date().toISOString(),
        },
      },
    }));
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 2000);
  };

  const summary = [
    { emoji: "⭐", label: "Stars earned today", value: today.stars },
    { emoji: "🎯", label: "Attempts today", value: today.attempts },
    { emoji: "✅", label: "Correct today", value: today.correct },
    { emoji: "🔊", label: "Sounds correct", value: today.soundsCorrect },
    { emoji: "🧱", label: "Words built", value: today.wordsBuilt },
    ...(today.helpedWordsBuilt > 0 ? [{ emoji: "🤝", label: "Words with help", value: today.helpedWordsBuilt }] : []),
    { emoji: "📖", label: "Sentences read", value: today.sentencesRead },
    { emoji: "🔢", label: "Math correct", value: today.mathCorrect },
  ];

  const toneStyles = {
    action: "bg-violet-100",
    support: "bg-amber-100",
    stretch: "bg-orange-100",
    celebrate: "bg-yellow-100",
    focus: "bg-teal-100",
    mixed: "bg-sky-100",
  };

  const sync = getCloudSyncStatus(cloud);
  const syncStyles = {
    saved: "bg-emerald-100 text-emerald-950",
    saving: "bg-sky-100 text-sky-950",
    offline: "bg-slate-200 text-slate-900",
    unconfigured: "bg-slate-200 text-slate-900",
    error: "bg-amber-100 text-amber-950",
    conflict: "bg-violet-100 text-violet-950",
  };

  return (
    <div className="rq-page mx-auto max-w-3xl px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-teal-50 p-6 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <p className="text-sm font-black uppercase tracking-wide text-teal-900">For Summer</p>
        <h1 className="mt-1 text-4xl font-black">Parent &amp; Teacher Mode</h1>
        <p className="mt-2 text-lg font-semibold text-slate-700">A calm view of today&apos;s practice and what to try next with Octavia.</p>
        {correctRate != null && <p className="mt-2 text-sm font-bold text-slate-600">Success rate today: {correctRate}%</p>}
      </div>

      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Today&apos;s summary</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {summary.map((row) => (
            <div key={row.label} className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-3xl">{row.emoji}</span>
              <div className="text-left">
                <p className="text-2xl font-black tabular-nums">{row.value}</p>
                <p className="text-sm font-bold text-slate-600">{row.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={`mt-6 rounded-[2rem] border-2 border-slate-900 p-5 shadow-[0_6px_0_rgba(15,23,42,1)] ${toneStyles[recommendation.tone] || "bg-white"}`}>
        <h2 className="text-2xl font-black">Recommended next</h2>
        <p className="mt-3 text-4xl">{recommendation.emoji}</p>
        <p className="mt-2 text-xl font-black">{recommendation.title}</p>
        <p className="mt-2 text-lg font-semibold text-slate-800">{recommendation.message}</p>
        {recommendation.mode !== "home" && (
          <button
            type="button"
            onClick={() => setMode(recommendation.mode)}
            className="rq-button mt-5 w-full rounded-2xl border-2 border-slate-900 bg-white px-6 py-4 text-xl font-black shadow-[0_5px_0_rgba(15,23,42,1)] sm:w-auto"
          >
            Start activity
          </button>
        )}
      </section>

      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Teacher controls</h2>
        <p className="mt-1 font-semibold text-slate-600">Saved with progress. Games use Focus and Difficulty below.</p>

        <p className="mt-5 font-black text-slate-800">Focus today</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TEACHER_FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => patchSettings({ teacherFocus: opt.id })}
              className={`rq-button rounded-2xl border-2 border-slate-900 p-4 text-left shadow-[0_4px_0_rgba(15,23,42,1)] ${focus === opt.id ? "bg-teal-200" : "bg-white"}`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="mt-1 block text-lg font-black">{opt.label}</span>
              <span className="mt-1 block text-sm font-semibold text-slate-600">{opt.blurb}</span>
            </button>
          ))}
        </div>

        <p className="mt-6 font-black text-slate-800">Difficulty</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TEACHER_DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => patchSettings({ teacherDifficulty: opt.id })}
              className={`rq-button rounded-2xl border-2 border-slate-900 p-4 text-left shadow-[0_4px_0_rgba(15,23,42,1)] ${difficulty === opt.id ? "bg-emerald-200" : "bg-white"}`}
            >
              <span className="block text-lg font-black">{opt.label}</span>
              <span className="mt-1 block text-sm font-semibold text-slate-600">{opt.blurb}</span>
            </button>
          ))}
        </div>

        <p className="mt-6 font-black text-slate-800">Celebration frequency</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">How often the app speaks praise after correct answers.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {CELEBRATION_FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => patchSettings({ celebrationFrequency: opt.id })}
              className={`rq-button rounded-2xl border-2 border-slate-900 p-4 text-left shadow-[0_4px_0_rgba(15,23,42,1)] ${celebrationFrequency === opt.id ? "bg-amber-200" : "bg-white"}`}
            >
              <span className="block text-lg font-black">{opt.label}</span>
              <span className="mt-1 block text-sm font-semibold text-slate-600">{opt.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Cloud sync</h2>
        <p className="mt-1 font-semibold text-slate-600">
          Progress saves on this device first, then syncs to your family account when signed in.
        </p>
        <div
          className={`mt-4 inline-flex flex-col rounded-2xl border-2 border-slate-900 px-4 py-2 ${syncStyles[sync.id] || syncStyles.offline}`}
        >
          <span className="text-xs font-black uppercase tracking-wide">Status</span>
          <span className="text-lg font-black">{sync.label}</span>
          <span className="text-sm font-semibold">{sync.detail}</span>
          {cloud.authEmail && (
            <span className="mt-1 text-xs font-bold opacity-80">Signed in as {cloud.authEmail}</span>
          )}
        </div>
      </section>

      <ProgressTransferPanel progress={progress} cloud={cloud} onImportProgress={onImportProgress} />

      <ParentProgressTools
        progress={progress}
        onApplyProgress={onApplyProgress}
        onResetDeviceOnly={onResetDeviceOnly}
        onResetEverywhere={onResetEverywhere}
        getStreak={getStreak}
        pinGate
        adminPin={adminPin}
        adminPinWords={adminPinWords}
        allowCloudResetUnlock={false}
      />

      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-amber-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Daily note</h2>
        <p className="mt-1 font-semibold text-slate-600">Saved to today&apos;s log for your records.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Example: Great focus on -at words. Try Read It after lunch."
          className="mt-4 w-full rounded-2xl border-2 border-slate-900 px-4 py-3 text-lg font-semibold shadow-inner"
        />
        <button
          type="button"
          onClick={saveNote}
          className="rq-button mt-3 w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 text-lg font-black shadow-[0_4px_0_rgba(15,23,42,1)] sm:w-auto"
        >
          {noteSaved ? "Saved!" : "Save note"}
        </button>
      </section>

      <section className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-slate-50 p-5 shadow-[0_4px_0_rgba(15,23,42,1)]">
        <h2 className="text-xl font-black">Quick launch</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { mode: "letterEcho", label: "Letter Echo", emoji: "🗣️" },
            { mode: "sounds", label: "Sound Pop", emoji: "🔊" },
            { mode: "build", label: "Build a Word", emoji: "🧱" },
            { mode: "read", label: "Read It", emoji: "📖" },
            { mode: "math", label: "Counting & Math", emoji: "🔢" },
          ].map((g) => (
            <button
              key={g.mode}
              type="button"
              onClick={() => setMode(g.mode)}
              className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 text-left font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
            >
              <span className="text-3xl">{g.emoji}</span>
              <span className="mt-1 block text-lg">{g.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMode("home")}
          className="rq-button mt-4 w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
        >
          Back to Octavia&apos;s home
        </button>
      </section>
    </div>
  );
}
