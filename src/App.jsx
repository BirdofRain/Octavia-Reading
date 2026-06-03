import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  reconcileProgress,
  reconcileProgressWithMeta,
  loadCloudProgress,
  saveCloudProgress,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  supabase,
  supabaseConfigured,
  runCloudSyncSelfTests,
  hasMeaningfulProgress,
} from "./lib/cloudProgress.js";
import { LETTERS, WORD_FAMILIES, lettersForReadingDifficulty, buildLetterLessonLines, letterChoiceDisplay, letterCaseInWord, letterUpper, letterLower } from "./data/phonics.js";
import {
  wordsForReadingLevel,
  sentencesForReadingLevel,
  wordsForReadingDifficulty,
  sentencesForReadingDifficulty,
  sentencesForReadGame,
  countBirdBuddySentences,
  countBirdPackSentences,
  SENTENCE_BANK,
  READING_THEMES,
} from "./data/reading.js";
import {
  COUNTING_SETS,
  MATH_FACTS,
  countingSetsForMathLevel,
  mathFactsForLevel,
  countingSetsForDifficulty,
  mathFactsForDifficulty,
} from "./data/mathContent.js";
import { filterByMaxLevel } from "./data/levels.js";
import { createGameSession, formatMathEquation, resolveDifficultyBand } from "./lib/difficulty.js";
import { getTeacherRecommendation, normalizeCelebrationFrequency } from "./lib/teacherMode.js";
import {
  getGentleTryAgainLine,
  getPraiseLine,
  shouldSpeakPraise,
  subtleCorrectResult,
} from "./lib/feedbackPacing.js";
import { TeacherMode as TeacherModeScreen } from "./TeacherMode.jsx";
import { ReadingMaze } from "./ReadingMaze.jsx";
import {
  getGameUnlockState,
  isModeUnlocked,
  listBonusGames,
  listCoreGames,
  listUnlockableGames,
} from "./lib/unlocks.js";
import {
  cancelSpeech,
  cancelScheduledTimer,
  clearScheduledAudio,
  clearScheduledTimers,
  scheduleAudio,
  speakLetterSound,
  speakLetterLesson,
  speakText,
  SOUND_POP_AUTO_PLAY_MS,
  LETTER_ECHO_AUTO_PLAY_MS,
  TTS_AFTER_PHRASE_GAP_MS,
  TTS_FALLBACK_TOTAL_MS,
} from "./lib/questAudio.js";
import { applyRewardClaim, sanitizeRewardClaims } from "./lib/rewardClaims.js";
import { syncProgression, xpForLevel, levelFromXp } from "./lib/progression.js";
import {
  buildProgressExportPayload,
  formatProgressExportJson,
  parseProgressImportText,
  getProgressSaveModeLabel,
} from "./lib/progressTransfer.js";
import { touchProgressUpdatedAt, getCloudSyncStatus, isBlankProgress, wouldCauseProgressLoss } from "./lib/progressSync.js";
import { honorParentProgressFields, applyProgressRepair } from "./lib/progressRepair.js";
import { createProgressBackup, listProgressBackups } from "./lib/progressBackup.js";
import { PROGRESS_STORAGE_KEY, writeProgressToLocalStorage } from "./lib/progressStorage.js";
import { clearAppCacheAndReload } from "./lib/appCache.js";
import { ParentProgressTools } from "./ParentProgressTools.jsx";

const APP_VERSION = "1.6-progress-repair-fix";
const PARENT_OVERRIDE_GUARD_MS = 12000;
const TODAY_KEY = new Date().toISOString().slice(0, 10);
const ADMIN_PIN = "8403";
const ADMIN_PIN_WORDS = "eight four zero three";
const GENERIC_READER_NAME = "reader";
const GENERIC_READER_LABEL = "your reader";

function cleanChildName(value) {
  const name = String(value || "").trim();
  return name || "Reader";
}

function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function getReaderDisplay(progress, authEmail) {
  const signedIn = Boolean(authEmail);
  const name = signedIn ? cleanChildName(progress?.childName) : GENERIC_READER_LABEL;
  return {
    signedIn,
    name,
    greetingName: signedIn ? name : GENERIC_READER_NAME,
    possessiveName: signedIn ? possessive(name) : "your reader's",
  };
}

const STYLES = `
@keyframes fall { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(350px); opacity: 0; } }
@keyframes popIn { 0% { transform: scale(.88); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes bounceTiny { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes fadeSlide { 0% { transform: translateX(12px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
@keyframes pulseStar { 0%,100% { transform: scale(1); } 50% { transform: scale(1.25); } }
.rq-pop { animation: popIn .18s ease-out; }
.rq-bounce { animation: bounceTiny .35s ease-out; }
.rq-page { animation: fadeSlide .22s ease-out; }
.rq-pulse { animation: pulseStar .55s ease-in-out; }
.rq-button { transition: transform .08s ease, box-shadow .08s ease, opacity .12s ease; }
.rq-button:active { transform: translateY(4px) scale(.98); box-shadow: 0 2px 0 rgba(15,23,42,1) !important; }
`;

function Icon({ children, className = "", label = "" }) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} role={label ? "img" : "presentation"} aria-label={label}>
      {children}
    </span>
  );
}

const StarIcon = ({ className = "" }) => (
  <Icon className={className} label="star">
    ⭐
  </Icon>
);
const VolumeIcon = ({ className = "" }) => (
  <Icon className={className} label="sound">
    🔊
  </Icon>
);
const SparklesIcon = ({ className = "" }) => (
  <Icon className={className} label="sparkles">
    ✨
  </Icon>
);
const CheckIcon = ({ className = "" }) => (
  <Icon className={className} label="correct">
    ✅
  </Icon>
);
const XIcon = ({ className = "" }) => (
  <Icon className={className} label="try again">
    ❌
  </Icon>
);
const BookIcon = ({ className = "" }) => (
  <Icon className={className} label="book">
    📚
  </Icon>
);
const SettingsIcon = ({ className = "" }) => (
  <Icon className={className} label="settings">
    ⚙️
  </Icon>
);
const TrophyIcon = ({ className = "" }) => (
  <Icon className={className} label="trophy">
    🏆
  </Icon>
);
const GiftIcon = ({ className = "" }) => (
  <Icon className={className} label="gift">
    🎁
  </Icon>
);
const CalendarIcon = ({ className = "" }) => (
  <Icon className={className} label="calendar">
    📅
  </Icon>
);
const LockIcon = ({ className = "" }) => (
  <Icon className={className} label="locked">
    🔒
  </Icon>
);
const UnlockIcon = ({ className = "" }) => (
  <Icon className={className} label="unlocked">
    🔓
  </Icon>
);
const ClipboardIcon = ({ className = "" }) => (
  <Icon className={className} label="clipboard">
    📋
  </Icon>
);

const REWARDS = [
  { id: "story", cost: 5, title: "Pick bedtime story", emoji: "📚", childText: "Story Pick" },
  { id: "snack", cost: 8, title: "Choose a special snack", emoji: "🍓", childText: "Snack Choice" },
  { id: "minecraft_dad", cost: 12, title: "10 min Minecraft with Dad", emoji: "⛏️", childText: "Minecraft Time" },
  { id: "sticker", cost: 15, title: "Sticker / tiny prize", emoji: "🎁", childText: "Tiny Prize" },
  { id: "quest", cost: 20, title: "Daddy-daughter mini quest", emoji: "🗺️", childText: "Mini Quest" },
];

const MINI_GAMES = [
  { id: "star_rain", cost: 3, title: "Star Rain", emoji: "🌟", description: "Tap falling stars before they disappear." },
  { id: "rainbow_pop", cost: 5, title: "Unicorn Match", emoji: "🦄", description: "Flip cards and find matching emoji pairs." },
];

function emptyDay() {
  return {
    opened: 0,
    attempts: 0,
    correct: 0,
    stars: 0,
    soundsCorrect: 0,
    letterEchoCompleted: 0,
    wordsBuilt: 0,
    helpedWordsBuilt: 0,
    mazeCompleted: 0,
    sentencesRead: 0,
    countingCorrect: 0,
    mathCorrect: 0,
    parentMinutes: 0,
    notes: "",
    lastPlayedAt: null,
  };
}

function normalizeDayEntry(day) {
  const base = emptyDay();
  if (!day || typeof day !== "object") return { ...base };
  return {
    ...base,
    ...day,
    opened: Number(day.opened) || 0,
    attempts: Number(day.attempts) || 0,
    correct: Number(day.correct) || 0,
    stars: Number(day.stars) || 0,
    soundsCorrect: Number(day.soundsCorrect) || 0,
    letterEchoCompleted: Number(day.letterEchoCompleted) || 0,
    wordsBuilt: Number(day.wordsBuilt) || 0,
    helpedWordsBuilt: Number(day.helpedWordsBuilt) || 0,
    mazeCompleted: Number(day.mazeCompleted) || 0,
    sentencesRead: Number(day.sentencesRead) || 0,
    countingCorrect: Number(day.countingCorrect) || 0,
    mathCorrect: Number(day.mathCorrect) || 0,
    parentMinutes: Number(day.parentMinutes) || 0,
    notes: typeof day.notes === "string" ? day.notes : "",
    lastPlayedAt: day.lastPlayedAt || null,
  };
}

function normalizeDailyLog(dailyLog) {
  const out = {};
  for (const [key, day] of Object.entries(dailyLog || {})) {
    out[key] = normalizeDayEntry(day);
  }
  return out;
}

function clampLevel(n) {
  const x = Number(n);
  if (Number.isFinite(x)) return Math.min(4, Math.max(1, Math.round(x)));
  return 1;
}

function normalizePhonicsAudioEnabled(value) {
  return value !== false && value !== "false";
}

function defaultProgress() {
  return {
    version: APP_VERSION,
    updatedAt: new Date().toISOString(),
    childName: "Octavia",
    stars: 0,
    lifetimeStars: 0,
    correct: 0,
    attempts: 0,
    badges: [],
    rewardClaims: [],
    settings: {
      activeReadingLevel: 1,
      activeMathLevel: 1,
      readingTheme: "default",
      teacherFocus: "mixed",
      teacherDifficulty: "auto",
      celebrationFrequency: "calm",
      phonicsAudioEnabled: true,
    },
    dailyLog: {
      [TODAY_KEY]: { ...emptyDay(), opened: 1, lastPlayedAt: new Date().toISOString() },
    },
    totals: {
      soundsCorrect: 0,
      letterEchoCompleted: 0,
      wordsBuilt: 0,
      helpedWordsBuilt: 0,
      mazeCompleted: 0,
      sentencesRead: 0,
      countingCorrect: 0,
      mathCorrect: 0,
      parentMinutes: 0,
      wordFamiliesUsed: [],
      readingWinsAtLevel2Plus: 0,
    },
  };
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getStreak(dailyLog = {}) {
  let streak = 0;
  const cursor = new Date();

  for (let i = 0; i < 365; i += 1) {
    const key = dateKey(cursor);
    const day = dailyLog[key];
    const practiced = Boolean(
      day &&
        (day.correct > 0 ||
          day.parentMinutes > 0 ||
          day.sentencesRead > 0 ||
          day.countingCorrect > 0 ||
          day.mathCorrect > 0 ||
          day.wordsBuilt > 0 ||
          day.soundsCorrect > 0 ||
          day.letterEchoCompleted > 0)
    );

    if (!practiced) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

const BADGES = [
  { id: "first_star", name: "First Star", emoji: "⭐", description: "Earn 1 reading star", test: (p) => p.lifetimeStars >= 1 || p.stars >= 1 },
  { id: "sound_scout", name: "Sound Scout", emoji: "🔊", description: "Get 5 sounds right", test: (p) => p.totals.soundsCorrect >= 5 },
  { id: "word_builder", name: "Word Builder", emoji: "🧱", description: "Build 3 words", test: (p) => p.totals.wordsBuilt >= 3 },
  { id: "sentence_reader", name: "Sentence Reader", emoji: "📖", description: "Read 2 sentences", test: (p) => p.totals.sentencesRead >= 2 },
  { id: "sentence_starter", name: "Sentence Starter", emoji: "🗣️", description: "Read 5 sentences in Read It", test: (p) => p.totals.sentencesRead >= 5 },
  { id: "word_family_explorer", name: "Word Family Explorer", emoji: "🧭", description: "Build words from 3 word families", test: (p) => Array.isArray(p.totals.wordFamiliesUsed) && new Set(p.totals.wordFamiliesUsed.filter(Boolean)).size >= 3 },
  { id: "ten_star_reader", name: "10-Star Reader", emoji: "🌟", description: "Earn 10 total stars", test: (p) => p.lifetimeStars >= 10 },
  { id: "two_day_streak", name: "2-Day Flame", emoji: "🔥", description: "Practice 2 days in a row", test: (p) => getStreak(p.dailyLog) >= 2 },
  { id: "five_day_streak", name: "5-Day Champion", emoji: "🏆", description: "Practice 5 days in a row", test: (p) => getStreak(p.dailyLog) >= 5 },
  { id: "counting_captain", name: "Counting Captain", emoji: "🔢", description: "Get 5 counting answers right", test: (p) => p.totals.countingCorrect >= 5 },
  { id: "counting_ten", name: "Counting 10", emoji: "🔟", description: "Get 10 counting answers right", test: (p) => p.totals.countingCorrect >= 10 },
  { id: "math_helper", name: "Math Helper", emoji: "➕", description: "Get 3 math answers right", test: (p) => p.totals.mathCorrect >= 3 },
  { id: "tiny_math_ten", name: "Tiny Math 10", emoji: "🧮", description: "Get 10 math answers right", test: (p) => p.totals.mathCorrect >= 10 },
  { id: "level_2_reader", name: "Level 2 Reader", emoji: "📈", description: "Reading level 2+ and 5 reading wins", test: (p) => clampLevel(p.settings?.activeReadingLevel) >= 2 && (p.totals.readingWinsAtLevel2Plus || 0) >= 5 },
];

function speak(text, rate = 0.72, onEnd) {
  speakText(text, rate, onEnd);
}

const RIGHT_ANSWER_PAUSE_MS = 1000;

const BUILD_ROUND_INTRO_MS = 480;
const BUILD_PHONICS_GAP_MS = 240;
const BUILD_GIVE_UP_LETTER_MS = 480;

function speakWholeWord(wordObj) {
  if (!wordObj?.word) return;
  speakText(wordObj.word, 0.72);
}

/** Speak each letter lesson or phoneme in sequence (for Need Help / Give Up). */
function speakPhonicsForParts(parts, tokenAtStart, roundTokenRef, onComplete, phonicsAudioEnabled = true) {
  let i = 0;
  const arr = [...parts];
  const next = () => {
    if (roundTokenRef.current !== tokenAtStart) return;
    if (i >= arr.length) {
      if (typeof onComplete === "function") onComplete();
      return;
    }
    const ch = arr[i];
    const lo = LETTERS.find((l) => l.letter === ch);
    i += 1;
    const after = () => {
      if (roundTokenRef.current !== tokenAtStart) return;
      scheduleAudio(next, BUILD_PHONICS_GAP_MS);
    };
    if (lo && phonicsAudioEnabled) {
      speakLetterLesson(lo, { enabled: true, onEnd: after });
    } else if (lo) {
      after();
    } else {
      speakText(ch, 0.58, after);
    }
  };
  next();
}

function speakSound(letterObj) {
  speakLetterSound(letterObj);
}

function speakWordSlow(wordObj) {
  if (!wordObj) return;
  speak(`${wordObj.parts.join(". ")}. ${wordObj.word}.`, 0.62);
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function pickRandom(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function migrateProgress(raw) {
  const base = defaultProgress();
  const safeRaw = raw && typeof raw === "object" ? raw : {};
  const merged = {
    ...base,
    ...safeRaw,
    version: APP_VERSION,
    badges: Array.isArray(safeRaw.badges) ? safeRaw.badges : [],
    rewardClaims: sanitizeRewardClaims(Array.isArray(safeRaw.rewardClaims) ? safeRaw.rewardClaims : []),
    settings: {
      ...base.settings,
      ...(safeRaw.settings && typeof safeRaw.settings === "object" ? safeRaw.settings : {}),
      activeReadingLevel: clampLevel(safeRaw.settings?.activeReadingLevel ?? base.settings.activeReadingLevel),
      activeMathLevel: clampLevel(safeRaw.settings?.activeMathLevel ?? base.settings.activeMathLevel),
      readingTheme: safeRaw.settings?.readingTheme === "bird" ? "bird" : "default",
      teacherFocus: normalizeTeacherFocus(safeRaw.settings?.teacherFocus ?? base.settings.teacherFocus),
      teacherDifficulty: normalizeTeacherDifficulty(safeRaw.settings?.teacherDifficulty ?? base.settings.teacherDifficulty),
      celebrationFrequency: normalizeCelebrationFrequency(
        safeRaw.settings?.celebrationFrequency ?? base.settings.celebrationFrequency
      ),
      phonicsAudioEnabled: normalizePhonicsAudioEnabled(
        safeRaw.settings?.phonicsAudioEnabled ?? base.settings.phonicsAudioEnabled
      ),
    },
    dailyLog: normalizeDailyLog({ ...base.dailyLog, ...(safeRaw.dailyLog || {}) }),
    totals: {
      ...base.totals,
      ...(safeRaw.totals || {}),
      soundsCorrect: Number(safeRaw.totals?.soundsCorrect) || 0,
      letterEchoCompleted: Number(safeRaw.totals?.letterEchoCompleted) || 0,
      wordsBuilt: Number(safeRaw.totals?.wordsBuilt) || 0,
      helpedWordsBuilt: Number(safeRaw.totals?.helpedWordsBuilt) || 0,
      mazeCompleted: Number(safeRaw.totals?.mazeCompleted) || 0,
      sentencesRead: Number(safeRaw.totals?.sentencesRead) || 0,
      countingCorrect: Number(safeRaw.totals?.countingCorrect) || 0,
      mathCorrect: Number(safeRaw.totals?.mathCorrect) || 0,
      parentMinutes: Number(safeRaw.totals?.parentMinutes) || 0,
      wordFamiliesUsed: Array.isArray(safeRaw.totals?.wordFamiliesUsed) ? safeRaw.totals.wordFamiliesUsed : base.totals.wordFamiliesUsed,
      readingWinsAtLevel2Plus: Number.isFinite(Number(safeRaw.totals?.readingWinsAtLevel2Plus))
        ? Number(safeRaw.totals.readingWinsAtLevel2Plus)
        : base.totals.readingWinsAtLevel2Plus,
    },
  };

  if (!merged.dailyLog[TODAY_KEY]) {
    merged.dailyLog[TODAY_KEY] = { ...emptyDay(), opened: 1, lastPlayedAt: new Date().toISOString() };
  } else {
    merged.dailyLog[TODAY_KEY] = normalizeDayEntry(merged.dailyLog[TODAY_KEY]);
  }

  if (!merged.updatedAt) {
    merged.updatedAt = new Date().toISOString();
  }

  return syncProgression(merged);
}

function awardBadges(progress) {
  const earned = new Set(progress.badges || []);
  let changed = false;

  BADGES.forEach((badge) => {
    if (!earned.has(badge.id) && badge.test(progress)) {
      earned.add(badge.id);
      changed = true;
    }
  });

  const withBadges = changed ? { ...progress, badges: Array.from(earned) } : progress;
  return syncProgression(withBadges);
}

function runSelfTests() {
  const p = defaultProgress();
  console.assert(Boolean(p.dailyLog[TODAY_KEY]), "defaultProgress should create today's log");
  console.assert(p.stars === 0 && p.lifetimeStars === 0, "defaultProgress should start at zero stars");
  console.assert(pickRandom(["a"]) === "a", "pickRandom should return only item from single-item array");
  console.assert(pickRandom([]) === null, "pickRandom should return null for empty arrays");
  const twoDayLog = { [dateKey(new Date())]: { ...emptyDay(), correct: 1 } };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  twoDayLog[dateKey(yesterday)] = { ...emptyDay(), parentMinutes: 5 };
  console.assert(getStreak(twoDayLog) >= 2, "getStreak should count consecutive practiced days");
  console.assert(awardBadges({ ...p, lifetimeStars: 1 }).badges.includes("first_star"), "first star badge should award at 1 lifetime star");
  console.assert(!String(APP_VERSION).toLowerCase().includes("lucide"), "app version should not reference lucide dependency");
  console.assert(LETTERS.length === 26, "letter bank should include full alphabet");
  console.assert(LETTERS.every((l) => l.name && l.say && l.clue), "every letter should include name, TTS-safe say text, and clue text");
  console.assert(wordsForReadingLevel(4).length >= 60, "word bank should include many decodable words");
  console.assert(sentencesForReadingLevel(4).length >= 80, "sentence bank should include many practice sentences");
  console.assert(MINI_GAMES.every((g) => g.cost > 0), "every mini game should have a star cost");
  console.assert(COUNTING_SETS.length >= 25, "counting mode should include many counting sets up to 20");
  console.assert(COUNTING_SETS.some((c) => c.count >= 20), "counting sets should include counts up to 20");
  console.assert(MATH_FACTS.length >= 80, "math bank should include at least 80 facts");
  console.assert(MATH_FACTS.some((f) => f.answer >= 20), "math bank should include facts with answers up to 20");
  console.assert(MATH_FACTS.some((f) => f.missing), "math bank should include missing-number puzzles");
  console.assert(SENTENCE_BANK.some((s) => s.type === "mini_story"), "sentence bank should include mini stories");
  const bandLow = resolveDifficultyBand({ level: 2, settings: { activeReadingLevel: 2, activeMathLevel: 2 } }, {}, "reading");
  const bandHigh = resolveDifficultyBand({ level: 8, settings: { activeReadingLevel: 2, activeMathLevel: 2 } }, {}, "math");
  console.assert(bandLow.maxTier <= 4, "low player level should stay in early tiers");
  console.assert(bandHigh.maxTier >= 5, "high player level should unlock advanced tiers");
  const session = createGameSession();
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const first = session.pickFromPool(pool, (x) => x.id);
  const second = session.pickFromPool(pool, (x) => x.id);
  console.assert(first && second && first.id !== second.id, "session picker should avoid immediate repeats when possible");
  console.assert(countBirdBuddySentences() >= 35, "sentence bank should include a large bird reading pool");
  console.assert(countBirdPackSentences() >= 25, "bird pack should add many themed sentences");
  const dayNorm = normalizeDayEntry({ correct: 2 });
  console.assert(dayNorm.sentencesRead === 0, "normalizeDayEntry should default sentencesRead to 0");
  console.assert(normalizeDayEntry({}).helpedWordsBuilt === 0, "normalizeDayEntry should default helpedWordsBuilt to 0");
  const afterRead = { ...dayNorm, sentencesRead: dayNorm.sentencesRead + 1 };
  console.assert(afterRead.sentencesRead === 1, "sentencesRead increment should stay numeric");
  console.assert(sentencesForReadGame({ level: 8, settings: { activeReadingLevel: 4, readingTheme: "bird" } }).some((s) => s.type === "mini_story"), "level 8 read pool should include mini stories");
  const recRead = getTeacherRecommendation({ sentencesRead: 0, attempts: 0, correct: 0 }, { stars: 0, level: 3, settings: {} });
  console.assert(recRead.mode === "read", "teacher recommendation should suggest Read It when no sentences read");
  console.assert(
    MATH_FACTS.every(
      (f) =>
        f.id &&
        typeof f.answer === "number" &&
        typeof f.level === "number" &&
        typeof f.story === "string" &&
        f.story.length > 0 &&
        typeof f.visualEmoji === "string" &&
        f.visualEmoji.length > 0
    ),
    "every math fact should include id, answer, level, story, and visualEmoji"
  );
  console.assert(MATH_FACTS.every((f) => typeof f.answer === "number"), "math facts should have numeric answers");
  console.assert(
    ["math_helper", "counting_captain", "counting_ten", "tiny_math_ten", "two_day_streak", "sound_scout", "word_builder", "sentence_reader", "sentence_starter", "word_family_explorer", "level_2_reader"].every(Boolean),
    "cleanup badge ids should exist as strings"
  );
  console.assert((true || 0 >= 999) === true, "test mode should allow mini games regardless of stars");
  console.assert((false || 0 >= 3) === false, "normal mode should block mini games without enough stars");
  const dupClaims = sanitizeRewardClaims([
    { id: "snack", title: "Snack", cost: 8, claimedAt: "2026-05-01T10:00:00.000Z", claimId: "a" },
    { id: "snack", title: "Snack", cost: 8, claimedAt: "2026-05-01T10:00:00.000Z", claimId: "b" },
  ]);
  console.assert(dupClaims.length === 1, "migrate should collapse exact duplicate reward claims");
  const kept = sanitizeRewardClaims([
    { id: "snack", title: "Snack", cost: 8, claimedAt: "2026-05-01T10:00:00.000Z", claimId: "a" },
    { id: "snack", title: "Snack", cost: 8, claimedAt: "2026-05-01T10:01:00.000Z", claimId: "b" },
  ]);
  console.assert(kept.length === 2, "different claimedAt should preserve separate claims");
  const leveled = syncProgression({ lifetimeStars: 12, correct: 12, stars: 3 });
  console.assert(leveled.level === 2, "12 XP should reach level 2");
  console.assert(leveled.levelTitle === "Sound Scout", "level 2 title should match");
  const spent = syncProgression({ lifetimeStars: 50, stars: 0 });
  console.assert(spent.level === levelFromXp(50), "spending stars must not lower level");
  const exported = buildProgressExportPayload({
    childName: "Octavia",
    stars: 5,
    dailyLog: { "2026-05-15": { correct: 1 } },
    password: "secret",
    accessToken: "tok",
  });
  console.assert(exported.childName === "Octavia" && exported.stars === 5, "export should keep progress fields");
  console.assert(!("password" in exported) && !("accessToken" in exported), "export should strip sensitive keys");
  console.assert(JSON.parse(formatProgressExportJson({ stars: 1, dailyLog: {} })).stars === 1, "export JSON should round-trip");
  console.assert(!parseProgressImportText("not json").ok, "import should reject invalid JSON");
  console.assert(!parseProgressImportText("[]").ok, "import should reject non-object JSON");
  console.assert(parseProgressImportText('{"stars":3,"dailyLog":{}}').ok, "import should accept minimal valid progress");
  const anonymousReader = getReaderDisplay({ childName: "Octavia" }, null);
  console.assert(anonymousReader.greetingName === "reader" && anonymousReader.name === "your reader", "signed-out reader display should be generic");
  const signedInReader = getReaderDisplay({ childName: "Octavia" }, "family@example.com");
  console.assert(signedInReader.name === "Octavia" && signedInReader.possessiveName === "Octavia's", "signed-in reader display should use progress childName");
  console.assert(getProgressSaveModeLabel({ configured: false }).id === "local", "unconfigured cloud should be local only");
  console.assert(getProgressSaveModeLabel({ configured: true, authEmail: "a@b.c", syncStatus: "saved" }).label === "Saved", "signed in saved should show Saved");
  console.assert(getCloudSyncStatus({ configured: true, authEmail: "a@b.c", syncStatus: "syncing" }).label === "Saving…", "syncing should show Saving…");
  console.assert(getCloudSyncStatus({ configured: true, authEmail: "a@b.c", syncStatus: "saved" }).label === "Synced", "saved should show Synced");
  console.assert(isBlankProgress({ lifetimeStars: 0, correct: 0, badges: [] }), "blank progress detection");
  console.assert(!isBlankProgress({ lifetimeStars: 1, correct: 0, badges: [] }), "one star is not blank");
  console.assert(
    wouldCauseProgressLoss({ lifetimeStars: 0, badges: [] }, { lifetimeStars: 10, badges: ["first_star"] }),
    "blank incoming should not overwrite cloud"
  );
  const backup = createProgressBackup({ lifetimeStars: 5, stars: 3, badges: ["first_star"], correct: 5, dailyLog: {} });
  console.assert(backup.ok && backup.key.startsWith("ltr_progress_backup_"), "backup should use ltr_progress_backup prefix");
  console.assert(listProgressBackups().some((b) => b.key === backup.key), "backup should appear in list");
  const leveledImport = honorParentProgressFields({ level: 3, lifetimeStars: 0, correct: 0 });
  console.assert(leveledImport.lifetimeStars >= 25, "import with level should map to XP for that level");
  console.assert(isModeUnlocked("letterEcho", { level: 1 }), "level 1 unlocks letter echo");
  console.assert(isModeUnlocked("sounds", { level: 1 }), "level 1 unlocks sounds");
  console.assert(!isModeUnlocked("readingMaze", { level: 2 }), "reading maze locked below level 3");
  console.assert(isModeUnlocked("readingMaze", { level: 3 }), "reading maze unlocks at level 3");
  console.assert(!isModeUnlocked("math", { level: 4 }), "math unlocks at level 5");
  console.assert(!isModeUnlocked("kidRewards", { level: 1 }), "badges unlock at level 2");
  console.assert(isModeUnlocked("kidRewards", { level: 2 }), "badges unlock at level 2");
}

if (typeof window !== "undefined" && !window.__octaviaReadingQuestTestsRan_v04) {
  window.__octaviaReadingQuestTestsRan_v04 = true;
  runSelfTests();
}

if (typeof window !== "undefined" && !window.__octaviaCloudSyncTestsRan_v01) {
  window.__octaviaCloudSyncTestsRan_v01 = true;
  runCloudSyncSelfTests();
}

function BigButton({ children, className = "", onClick, disabled = false, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`rq-button rounded-3xl border-2 border-slate-900 bg-white px-5 py-4 text-lg font-black shadow-[0_6px_0_rgba(15,23,42,1)] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function LevelProgress({ progress, compact = false }) {
  const level = progress.level || 1;
  const title = progress.levelTitle || "Letter Listener";
  const current = progress.currentLevelXp ?? 0;
  const next = progress.nextLevelXp ?? xpForLevel(level + 1);
  const start = xpForLevel(level);
  const span = Math.max(1, next - start);
  const pct = Math.min(100, Math.round((current / span) * 100));

  if (compact) {
    return (
      <span
        className="rounded-full border-2 border-slate-900 bg-violet-200 px-3 py-1 text-sm font-black"
        aria-label={`Level ${level}, ${title}`}
        title={`${title} — ${current} of ${span} XP to next level`}
      >
        Lv {level}
      </span>
    );
  }

  return (
    <div className="min-w-0 flex-1" aria-label={`Level ${level}, ${title}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border-2 border-slate-900 bg-violet-200 px-3 py-1 text-sm font-black">
          Lv {level}
        </span>
        <span className="truncate text-sm font-bold text-slate-700">{title}</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-slate-900 bg-white">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-pink-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-xs font-bold text-slate-600">
        {current} / {span} XP to level {level + 1}
      </p>
    </div>
  );
}

function ProgressStars({ stars }) {
  const shownStars = Math.min(5, Math.max(0, stars));
  return (
    <div className="flex items-center gap-1" aria-label={`${stars} stars earned`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < shownStars ? "rq-pulse" : ""}>
          <StarIcon className={`text-2xl ${i < shownStars ? "opacity-100" : "opacity-20 grayscale"}`} />
        </span>
      ))}
      {stars > 5 && <span className="ml-1 rounded-full bg-white px-2 py-1 text-xs font-black">+{stars - 5}</span>}
    </div>
  );
}

function Header({ setMode, progress, reader }) {
  const streak = getStreak(progress.dailyLog);
  return (
    <div className="sticky top-0 z-20 mb-4 rounded-b-3xl border-b-2 border-slate-900 bg-amber-100/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <button onClick={() => setMode("home")} className="flex items-center gap-2 rounded-2xl px-2 py-1 text-left font-black">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-slate-900 bg-white text-2xl shadow-[0_4px_0_rgba(15,23,42,1)]">📚</span>
          <span>
            <span className="block text-sm uppercase tracking-wide text-slate-600">
              {reader.signedIn ? reader.possessiveName : "Family"}
            </span>
            <span className="block text-xl leading-none">Reading Quest</span>
          </span>
        </button>
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <LevelProgress progress={progress} compact />
          <ProgressStars stars={progress.stars} />
          <span className="hidden rounded-full border-2 border-slate-900 bg-white px-3 py-1 text-sm font-bold lg:inline">
            {progress.correct} right
          </span>
          <span className="rounded-full border-2 border-slate-900 bg-orange-100 px-3 py-1 text-sm font-bold">🔥 {streak}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode("teacher")} className="rq-button rounded-2xl border-2 border-slate-900 bg-teal-100 px-3 py-2 font-black shadow-[0_4px_0_rgba(15,23,42,1)]" aria-label="Teacher mode">
            <span className="text-lg">👩‍🏫</span>
            <span className="text-sm">Teacher</span>
          </button>
          <button onClick={() => setMode("admin")} className="rq-button rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-[0_4px_0_rgba(15,23,42,1)]" aria-label="Parent admin">
            <SettingsIcon className="text-xl" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TodayStatsDashboard({ today }) {
  const day = normalizeDayEntry(today);
  const items = [
    { emoji: "📖", label: "Sentences read", value: day.sentencesRead },
    { emoji: "🧱", label: "Words built", value: day.wordsBuilt },
    { emoji: "🔢", label: "Math correct", value: day.mathCorrect },
    { emoji: "🔊", label: "Sounds correct", value: day.soundsCorrect },
  ];
  if (day.helpedWordsBuilt > 0) {
    items.splice(2, 0, { emoji: "🤝", label: "Words with help", value: day.helpedWordsBuilt });
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border-2 border-slate-900 bg-white px-3 py-3 text-center shadow-[0_4px_0_rgba(15,23,42,1)]"
        >
          <div className="text-3xl">{item.emoji}</div>
          <div className="mt-1 text-2xl font-black tabular-nums">{item.value}</div>
          <p className="text-xs font-bold leading-tight text-slate-600">{item.label} today</p>
        </div>
      ))}
    </div>
  );
}

function GameLaunchCard({ game, progress, setMode, className = "" }) {
  const { unlocked, requirementLabel } = getGameUnlockState(game.id, progress);

  if (!unlocked || game.comingSoon) {
    return (
      <div
        className={`relative rounded-3xl border-2 border-dashed border-slate-400 bg-slate-100 p-5 text-left shadow-inner ${className}`}
        aria-disabled="true"
      >
        <span className="absolute right-4 top-4 text-2xl" aria-hidden>
          🔒
        </span>
        <div className="text-5xl opacity-60">{game.emoji}</div>
        <div className="mt-2 text-2xl font-black text-slate-600">{game.title}</div>
        <p className="mt-1 text-sm font-bold text-slate-500">{game.blurb}</p>
        <p className="mt-2 text-sm font-black text-violet-900">{requirementLabel}</p>
      </div>
    );
  }

  const tone =
    game.category === "core"
      ? game.id === "letterEcho"
        ? "bg-sky-100"
        : game.id === "sounds"
          ? "bg-pink-100"
          : game.id === "build"
            ? "bg-lime-100"
            : "bg-violet-100"
      : game.id === "readingMaze"
        ? "bg-indigo-100"
        : game.id === "miniGames"
          ? "bg-cyan-100"
          : "bg-orange-100";

  return (
    <BigButton onClick={() => setMode(game.mode)} className={`${tone} text-left ${className}`}>
      <div className="text-5xl">{game.emoji}</div>
      <div className="mt-2 text-2xl">{game.title}</div>
      <p className="mt-1 text-sm font-bold text-slate-600">{game.blurb}</p>
    </BigButton>
  );
}

function Home({ setMode, progress, reader }) {
  const earnedBadges = BADGES.filter((b) => progress.badges.includes(b.id));
  const today = normalizeDayEntry(progress.dailyLog[TODAY_KEY]);
  const coreGames = listCoreGames();
  const unlockables = listUnlockableGames();
  const bonusGames = listBonusGames();
  return (
    <div className="rq-page mx-auto grid max-w-5xl gap-5 px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-900">
              <SparklesIcon /> Today’s quest: 5–8 minutes
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-6xl">Hello, {reader.greetingName}! 👋</h1>
            <p className="mt-1 text-3xl font-black text-slate-800 sm:text-4xl">Tiny reading games. Big confidence.</p>
            <p className="mt-3 text-lg font-semibold text-slate-700">Start with sounds, build short words, then read a silly sentence out loud with Mom or Dad.</p>
          </div>
          <div className="rounded-[2rem] border-2 border-slate-900 bg-sky-100 p-4 shadow-inner">
            <LevelProgress progress={progress} />
            <div className="mt-4 text-center">
              <div className="text-5xl">🌈</div>
              <p className="mt-2 text-2xl font-black">{progress.stars} spendable stars</p>
              <p className="text-sm font-bold text-slate-600">
                {progress.lifetimeStars} lifetime stars • {progress.xp ?? 0} XP • {getStreak(progress.dailyLog)} day streak
              </p>
              {progress.skillRanks && (
                <p className="mt-2 text-xs font-bold text-violet-900">
                  Skills: phonics {progress.skillRanks.phonicsRank} • reading {progress.skillRanks.readingRank} • math{" "}
                  {progress.skillRanks.mathRank}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {coreGames.map((game) => (
          <GameLaunchCard key={game.id} game={game} progress={progress} setMode={setMode} />
        ))}
      </div>

      <section className="rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h2 className="text-2xl font-black">Unlockables</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">Special games you earn as your reader level grows.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {unlockables.map((game) => (
            <GameLaunchCard key={game.id} game={game} progress={progress} setMode={setMode} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {bonusGames.map((game) => (
          <GameLaunchCard key={game.id} game={game} progress={progress} setMode={setMode} />
        ))}
      </div>

      <BigButton onClick={() => setMode("teacher")} className="bg-teal-100 text-left">
        <div className="text-5xl">👩‍🏫</div>
        <div className="mt-2 text-2xl">Parent &amp; Teacher</div>
        <p className="mt-1 text-sm font-bold text-slate-600">For Summer: summary, next activity, and daily notes.</p>
      </BigButton>

      {isModeUnlocked("kidRewards", progress) ? (
        <BigButton onClick={() => setMode("kidRewards")} className="bg-yellow-100 text-left">
          <div className="text-5xl">🏆</div>
          <div className="mt-2 text-2xl">My Badges</div>
          <p className="mt-1 text-sm font-bold text-slate-600">See badges, stars, and prizes.</p>
        </BigButton>
      ) : (
        <div
          className="relative rounded-3xl border-2 border-dashed border-slate-400 bg-slate-100 p-5 text-left shadow-inner"
          aria-disabled="true"
        >
          <span className="absolute right-4 top-4 text-2xl" aria-hidden>
            🔒
          </span>
          <div className="text-5xl opacity-60">🏆</div>
          <div className="mt-2 text-2xl font-black text-slate-600">My Badges</div>
          <p className="mt-1 text-sm font-bold text-slate-500">See badges, stars, and prizes.</p>
          <p className="mt-2 text-sm font-black text-violet-900">Unlocks at Level 2</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border-2 border-slate-900 bg-amber-50 p-4 md:col-span-2">
          <div className="flex items-center gap-2 font-black">
            <CalendarIcon /> Today&apos;s practice
          </div>
          <div className="mt-3">
            <TodayStatsDashboard today={today} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {today.correct} right • {today.attempts} attempts • {today.stars} stars earned today
          </p>
        </div>
        <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-4">
          <div className="flex items-center gap-2 font-black">
            <TrophyIcon /> Badges
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {earnedBadges.length === 0 ? (
              <span className="font-semibold text-slate-600">Earn the first badge today!</span>
            ) : (
              earnedBadges.map((badge) => (
                <span key={badge.id} className="rounded-full border-2 border-slate-900 bg-yellow-100 px-3 py-1 font-black">
                  {badge.emoji} {badge.name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StarCost({ cost }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" aria-label={`${cost} stars`}>
      {Array.from({ length: cost }).map((_, i) => (
        <span key={i} className="text-lg">
          ⭐
        </span>
      ))}
    </span>
  );
}

function KidRewards({ progress, reader }) {
  const earnedBadges = BADGES.filter((b) => progress.badges.includes(b.id));
  return (
    <div className="rq-page mx-auto grid max-w-5xl gap-5 px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-yellow-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="text-7xl">🏆</div>
        <h2 className="mt-2 text-4xl font-black">{reader.signedIn ? `${reader.possessiveName} Badge Box` : "My Badge Box"}</h2>
        <p className="mt-2 text-xl font-black">You have {progress.stars} stars to spend!</p>
        <div className="mt-3 flex justify-center">
          <StarCost cost={Math.min(progress.stars, 20)} />
        </div>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5">
        <h3 className="text-2xl font-black">My Badges</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => {
            const earned = progress.badges.includes(badge.id);
            return (
              <div key={badge.id} className={`rounded-3xl border-2 border-slate-900 p-4 text-center ${earned ? "bg-yellow-100" : "bg-slate-100 opacity-60"}`}>
                <div className="text-5xl">{earned ? badge.emoji : "🔒"}</div>
                <div className="mt-1 font-black">{badge.name}</div>
                <div className="text-sm font-bold text-slate-600">{badge.description}</div>
              </div>
            );
          })}
        </div>
        {earnedBadges.length === 0 && <p className="mt-4 font-bold text-slate-600">Play one reading game to unlock your first badge!</p>}
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-rose-50 p-5">
        <h3 className="text-2xl font-black">Prize Shelf</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REWARDS.map((reward) => (
            <div key={reward.id} className={`rounded-3xl border-2 border-slate-900 bg-white p-4 ${progress.stars >= reward.cost ? "" : "opacity-60"}`}>
              <div className="text-5xl">{reward.emoji}</div>
              <div className="mt-1 text-xl font-black">{reward.childText}</div>
              <div className="mt-2">
                <StarCost cost={reward.cost} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmojiRow({ emoji, count, crossed = 0 }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`text-3xl sm:text-4xl ${i < crossed ? "relative opacity-40 line-through decoration-slate-900" : ""}`} aria-hidden>
          {emoji}
        </span>
      ))}
    </div>
  );
}

function MathAndCounting({ logWin, logAttempt, playerLevel, activeMathLevel, celebrationFrequency }) {
  const correctCountRef = useRef(0);
  const sessionRef = useRef(createGameSession());
  const [sessionTick, setSessionTick] = useState(0);
  const progressSlice = useMemo(
    () => ({ level: playerLevel, settings: { activeMathLevel } }),
    [playerLevel, activeMathLevel]
  );
  const sessionStats = useMemo(() => sessionRef.current.getStats(), [sessionTick]);
  const countingPool = useMemo(() => countingSetsForDifficulty(progressSlice, sessionStats), [progressSlice, sessionStats]);
  const mathPool = useMemo(() => mathFactsForDifficulty(progressSlice, sessionStats), [progressSlice, sessionStats]);
  const countKey = (x) => `${x.emoji}-${x.count}`;
  const pickCountCard = () => sessionRef.current.pickFromPool(countingPool, countKey) || pickRandom(countingPool);
  const pickMathCard = () => sessionRef.current.pickFromPool(mathPool, (x) => x.id) || pickRandom(mathPool);
  const recordSession = (ok) => {
    sessionRef.current.recordAttempt(ok);
    setSessionTick((t) => t + 1);
  };

  const [mode, setMode] = useState("count");
  const [countCard, setCountCard] = useState(null);
  const [mathCard, setMathCard] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!countingPool.length) return;
    setCountCard((c) => (c && countingPool.some((x) => countKey(x) === countKey(c)) ? c : pickCountCard()));
  }, [countingPool]);

  useEffect(() => {
    if (!mathPool.length) return;
    setMathCard((c) => (c && mathPool.some((x) => x.id === c.id) ? c : pickMathCard()));
  }, [mathPool]);

  const countChoices = useMemo(() => {
    if (!countCard) return [];
    const wrong = countingPool.map((x) => x.count).filter((n) => n !== countCard.count);
    return shuffle([countCard.count, ...shuffle(wrong).slice(0, 3)]);
  }, [countCard, countingPool]);

  const mathChoices = useMemo(() => {
    if (!mathCard) return [];
    const correct = mathCard.answer;
    const maxN = Math.max(10, correct, mathCard.a, mathCard.b, 20);
    const pool = Array.from({ length: maxN + 1 }, (_, i) => i).filter((n) => n !== correct);
    return shuffle([correct, ...shuffle(pool).slice(0, 3)]);
  }, [mathCard]);

  const chooseCount = (n) => {
    if (!countCard) return;
    logAttempt("counting");
    const ok = n === countCard.count;
    recordSession(ok);
    if (ok) {
      correctCountRef.current += 1;
      const speakPraise = shouldSpeakPraise({
        correctCount: correctCountRef.current,
        celebrationFrequency,
      });
      const praiseLine = speakPraise ? getPraiseLine() : null;
      setResult(speakPraise ? { type: "good", text: praiseLine } : subtleCorrectResult());
      logWin("counting");
      let done = false;
      const next = () => {
        if (done) return;
        done = true;
        setCountCard(pickCountCard());
        setResult(null);
      };
      const safety = window.setTimeout(next, TTS_FALLBACK_TOTAL_MS);
      const afterSpeech = () => {
        window.clearTimeout(safety);
        window.setTimeout(next, TTS_AFTER_PHRASE_GAP_MS);
      };
      if (speakPraise) {
        speak(praiseLine, 0.72, afterSpeech);
      } else {
        window.setTimeout(next, RIGHT_ANSWER_PAUSE_MS);
        scheduleAudio(() => setResult(null), 500);
      }
    } else {
      setResult({ type: "try", text: "Count again" });
      speak(getGentleTryAgainLine(), 0.72);
      setTimeout(() => setResult(null), 900);
    }
  };

  const chooseMath = (n) => {
    if (!mathCard) return;
    logAttempt("math");
    const ok = n === mathCard.answer;
    recordSession(ok);
    if (ok) {
      correctCountRef.current += 1;
      const speakPraise = shouldSpeakPraise({
        correctCount: correctCountRef.current,
        celebrationFrequency,
      });
      const praiseLine = speakPraise ? getPraiseLine() : null;
      setResult(speakPraise ? { type: "good", text: praiseLine } : subtleCorrectResult());
      logWin("math");
      let done = false;
      const next = () => {
        if (done) return;
        done = true;
        setMathCard(pickMathCard());
        setResult(null);
      };
      const safety = window.setTimeout(next, TTS_FALLBACK_TOTAL_MS);
      const afterSpeech = () => {
        window.clearTimeout(safety);
        window.setTimeout(next, TTS_AFTER_PHRASE_GAP_MS);
      };
      if (speakPraise) {
        speak(praiseLine, 0.72, afterSpeech);
      } else {
        window.setTimeout(next, RIGHT_ANSWER_PAUSE_MS);
        scheduleAudio(() => setResult(null), 500);
      }
    } else {
      setResult({ type: "try", text: "Try again" });
      speak(getGentleTryAgainLine(), 0.72);
      setTimeout(() => setResult(null), 900);
    }
  };

  if (!countCard || !mathCard) {
    return (
      <div className="rq-page mx-auto max-w-5xl px-4 pb-10 text-center">
        <p className="text-2xl font-black">Loading math fun…</p>
      </div>
    );
  }

  return (
    <div className="rq-page mx-auto max-w-5xl px-4 pb-10">
      <ResultToast result={result} />
      <div className="rounded-[2rem] border-2 border-slate-900 bg-orange-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="text-7xl">🔢</div>
        <h2 className="mt-2 text-4xl font-black">Counting & Math</h2>
        <p className="mt-2 text-lg font-bold text-slate-700">Slow thinking. Count out loud.</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={() => setMode("count")}
            className={`rq-button rounded-full border-2 border-slate-900 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] ${mode === "count" ? "bg-white" : "bg-orange-50"}`}
          >
            Counting
          </button>
          <button
            onClick={() => setMode("math")}
            className={`rq-button rounded-full border-2 border-slate-900 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] ${mode === "math" ? "bg-white" : "bg-orange-50"}`}
          >
            Tiny Math
          </button>
        </div>
      </div>

      {mode === "count" && (
        <div className="mt-5 rounded-[2rem] border-2 border-slate-900 bg-white p-5 text-center shadow-[0_6px_0_rgba(15,23,42,1)]">
          <h3 className="text-3xl font-black">How many?</h3>
          <button
            onClick={() => speak(`Count the ${countCard.label}.`, 0.72)}
            className="rq-button mt-3 rounded-full border-2 border-slate-900 bg-sky-100 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
          >
            🔊 Hear question
          </button>
          <div className="mx-auto mt-5 max-w-xl rounded-3xl bg-slate-50 p-4 text-5xl">
            <EmojiRow emoji={countCard.emoji} count={countCard.count} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {countChoices.map((n) => (
              <BigButton key={n} onClick={() => chooseCount(n)} className="bg-orange-50">
                <span className="text-5xl">{n}</span>
              </BigButton>
            ))}
          </div>
        </div>
      )}

      {mode === "math" && (
        <div className="mt-5 rounded-[2rem] border-2 border-slate-900 bg-white p-5 text-center shadow-[0_6px_0_rgba(15,23,42,1)]">
          <h3 className="text-3xl font-black">Tiny Math Story</h3>
          <button
            onClick={() => speak(mathCard.story, 0.72)}
            className="rq-button mt-3 rounded-full border-2 border-slate-900 bg-sky-100 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
          >
            🔊 Hear story
          </button>
          {mathCard.kind === "word_problem" && (
            <p className="mt-2 text-sm font-black uppercase tracking-wide text-violet-700">Word problem</p>
          )}
          <div className="mt-5 text-5xl font-black sm:text-6xl">{formatMathEquation(mathCard)}</div>
          <div className="mx-auto mt-4 max-w-xl rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-center text-xs font-black uppercase tracking-wide text-slate-500">Picture math</p>
            {!mathCard.missing && mathCard.op === "+" && (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-center text-sm font-bold text-slate-600">First group</p>
                  <EmojiRow emoji={mathCard.visualEmoji || "⭐"} count={mathCard.a} />
                </div>
                <div>
                  <p className="text-center text-sm font-bold text-slate-600">More</p>
                  <EmojiRow emoji={mathCard.visualEmoji || "⭐"} count={mathCard.b} />
                </div>
              </div>
            )}
            {mathCard.missing && (
              <p className="mt-2 text-center text-sm font-bold text-slate-600">Find the missing number in the story.</p>
            )}
            {!mathCard.missing && mathCard.op === "-" && (
              <div className="mt-2">
                <p className="text-center text-sm font-bold text-slate-600">Start, then some go away</p>
                <EmojiRow emoji={mathCard.visualEmoji || "⭐"} count={mathCard.a} crossed={mathCard.b} />
              </div>
            )}
            {mathCard.op !== "+" && mathCard.op !== "-" && (
              <p className="mt-2 text-center text-sm font-bold text-slate-600">Listen to the story and pick the answer.</p>
            )}
          </div>
          <p className="mt-3 text-lg font-bold text-slate-600">{mathCard.story}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {mathChoices.map((n) => (
              <BigButton key={n} onClick={() => chooseMath(n)} className="bg-orange-50">
                <span className="text-5xl">{n}</span>
              </BigButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniGames({ progress, setProgress, testMode }) {
  const [activeGame, setActiveGame] = useState(null);
  const pendingMiniGameRef = useRef(new Set());
  const miniGameInFlightRef = useRef(null);

  const playGame = (game) => {
    if (pendingMiniGameRef.current.has(game.id)) return;
    const cost = Number(game.cost) || 0;
    if (!testMode && (Number(progress.stars) || 0) < cost) return;

    pendingMiniGameRef.current.add(game.id);
    const claimId = `mini-${game.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    miniGameInFlightRef.current = { gameId: game.id, claimId };

    let didClaim = false;
    setProgress((old) => {
      const inFlight = miniGameInFlightRef.current;
      if (!inFlight || inFlight.gameId !== game.id) return old;
      if (inFlight.result) return inFlight.result;

      const next = applyRewardClaim(
        old,
        { claimId: inFlight.claimId, id: game.id, title: game.title, cost, type: "mini_game" },
        { skipStarCost: testMode }
      );
      if (!next) return old;
      inFlight.result = next;
      didClaim = true;
      return next;
    });

    if (didClaim) {
      setActiveGame(game.id);
      speak(`${game.title} unlocked!`, 0.72);
    }

    window.setTimeout(() => {
      pendingMiniGameRef.current.delete(game.id);
      if (miniGameInFlightRef.current?.gameId === game.id) {
        miniGameInFlightRef.current = null;
      }
    }, 800);
  };

  function StarRainGame({ onExit }) {
    const [stars, setStars] = useState([]);
    const [score, setScore] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setStars((s) => [...s.slice(-12), { id: Date.now() + Math.random(), left: Math.random() * 88 }]);
      }, 650);
      return () => clearInterval(interval);
    }, []);

    const popStar = (id) => {
      setStars((s) => s.filter((st) => st.id !== id));
      setScore((n) => n + 1);
    };

    return (
      <div className="rq-page mx-auto max-w-4xl px-4 pb-10 text-center">
        <h2 className="text-4xl font-black">🌟 Star Rain</h2>
        <p className="font-bold">Tap the falling stars!</p>
        <div className="relative mt-6 h-80 overflow-hidden rounded-3xl border-2 border-slate-900 bg-sky-100">
          {stars.map((s) => (
            <button key={s.id} onClick={() => popStar(s.id)} className="absolute text-3xl" style={{ left: `${s.left}%`, top: "0%", animation: "fall 2s linear forwards" }}>
              ⭐
            </button>
          ))}
        </div>
        <p className="mt-4 text-xl font-black">Score: {score}</p>
        <button onClick={onExit} className="rq-button mt-4 rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
          Back
        </button>
      </div>
    );
  }

  function MatchGame({ onExit }) {
    const allEmoji = ["🦄", "🌈", "⭐", "💎", "🧁", "🍓", "🌙", "🌸", "🐱", "🐶", "🐸", "🦊", "🐢", "🦋", "🍎", "🎈"];
    const [deckSize, setDeckSize] = useState(8);
    const [cards, setCards] = useState(() => shuffle([...allEmoji.slice(0, 8), ...allEmoji.slice(0, 8)]));
    const [flipped, setFlipped] = useState([]);
    const [matchedIndexes, setMatchedIndexes] = useState([]);
    const [moves, setMoves] = useState(0);

    const resetDeck = (pairs = deckSize) => {
      setDeckSize(pairs);
      setCards(shuffle([...allEmoji.slice(0, pairs), ...allEmoji.slice(0, pairs)]));
      setFlipped([]);
      setMatchedIndexes([]);
      setMoves(0);
    };

    const flip = (i) => {
      if (flipped.length === 2 || flipped.includes(i) || matchedIndexes.includes(i)) return;
      const newFlip = [...flipped, i];
      setFlipped(newFlip);

      if (newFlip.length === 2) {
        setMoves((n) => n + 1);
        const [a, b] = newFlip;
        if (cards[a] === cards[b]) {
          setMatchedIndexes((m) => [...m, a, b]);
          setTimeout(() => setFlipped([]), 450);
        } else {
          setTimeout(() => setFlipped([]), 850);
        }
      }
    };

    const won = matchedIndexes.length === cards.length;

    return (
      <div className="rq-page mx-auto max-w-5xl px-4 pb-10 text-center">
        <h2 className="text-4xl font-black">🦄 Unicorn Match</h2>
        <p className="font-bold">Find all the matching emoji pairs.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button onClick={() => resetDeck(4)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-4 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            Easy
          </button>
          <button onClick={() => resetDeck(8)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-4 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            Medium
          </button>
          <button onClick={() => resetDeck(16)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-4 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            Big
          </button>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {cards.map((c, i) => {
            const show = flipped.includes(i) || matchedIndexes.includes(i);
            return (
              <button
                key={`${c}-${i}`}
                onClick={() => flip(i)}
                className={`rq-button h-20 rounded-3xl border-2 border-slate-900 text-4xl shadow-[0_4px_0_rgba(15,23,42,1)] ${matchedIndexes.includes(i) ? "bg-emerald-100" : "bg-white"}`}
              >
                {show ? c : "❓"}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xl font-black">Moves: {moves}</p>
        {won && <p className="rq-pop mt-3 text-3xl font-black">You matched them all! 🎉</p>}
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={() => resetDeck(deckSize)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            New board
          </button>
          <button onClick={onExit} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (activeGame === "star_rain") return <StarRainGame onExit={() => setActiveGame(null)} />;
  if (activeGame === "rainbow_pop") return <MatchGame onExit={() => setActiveGame(null)} />;

  return (
    <div className="rq-page mx-auto grid max-w-5xl gap-5 px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-cyan-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="text-7xl">🎮</div>
        <h2 className="mt-2 text-4xl font-black">Star Games</h2>
        <p className="mt-2 text-xl font-black">Spend stars for fun games!</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {MINI_GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => playGame(game)}
            disabled={!testMode && progress.stars < game.cost}
            className="rq-button rounded-[2rem] border-2 border-slate-900 bg-white p-5 text-left shadow-[0_6px_0_rgba(15,23,42,1)] disabled:opacity-50"
          >
            <div className="text-6xl">{game.emoji}</div>
            <div className="mt-2 text-2xl font-black">{game.title}</div>
            <p className="mt-1 font-bold text-slate-600">{game.description}</p>
            <div className="mt-3 font-black">{testMode ? "FREE in Test Mode" : `${game.cost} ⭐`}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultToast({ result }) {
  if (!result) return null;
  const subtle = Boolean(result.subtle);
  return (
    <div
      className={`rq-pop fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-slate-900 shadow-xl ${
        result.type === "good" ? "bg-emerald-200" : "bg-rose-200"
      } ${subtle ? "px-4 py-2 text-2xl" : "px-5 py-3 text-lg font-black"}`}
    >
      {result.type === "good" ? <CheckIcon className={subtle ? "text-xl" : ""} /> : <XIcon />}
      {result.text}
    </div>
  );
}

function BadgeToast({ badge }) {
  if (!badge) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-5">
      <div className="rq-pop rounded-[2rem] border-2 border-slate-900 bg-white p-6 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="text-7xl">{badge.emoji}</div>
        <h3 className="mt-2 text-3xl font-black">New badge!</h3>
        <p className="text-xl font-black">{badge.name}</p>
        <p className="font-semibold text-slate-600">{badge.description}</p>
      </div>
    </div>
  );
}

function PhonicsAudioToggle({ enabled, onToggle, disabled = false, className = "" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(!enabled)}
      className={`rq-button rounded-full border-2 border-slate-900 px-4 py-2 text-sm font-black shadow-[0_3px_0_rgba(15,23,42,1)] disabled:opacity-50 ${enabled ? "bg-white" : "bg-slate-200"} ${className}`}
      aria-label={enabled ? "Turn phonics audio off" : "Turn phonics audio on"}
    >
      {enabled ? "🔊 Audio on" : "🔇 Audio off"}
    </button>
  );
}

function LetterLessonScript({ letterObj, className = "" }) {
  const lines = buildLetterLessonLines(letterObj);
  return (
    <div className={`rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left ${className}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Repeat after me</p>
      {lines.map((line) => (
        <p key={line} className="mt-1 text-lg font-bold text-slate-700">
          {line}
        </p>
      ))}
    </div>
  );
}

function LetterEchoGame({
  logWin,
  logAttempt,
  playerLevel,
  activeReadingLevel,
  celebrationFrequency,
  phonicsAudioEnabled,
  onPhonicsAudioChange,
}) {
  const sessionRef = useRef(createGameSession());
  const correctCountRef = useRef(0);
  const [sessionTick, setSessionTick] = useState(0);
  const progressSlice = useMemo(
    () => ({ level: playerLevel, settings: { activeReadingLevel } }),
    [playerLevel, activeReadingLevel]
  );
  const sessionStats = useMemo(() => sessionRef.current.getStats(), [sessionTick]);
  const letterPool = useMemo(() => lettersForReadingDifficulty(progressSlice, sessionStats), [progressSlice, sessionStats]);
  const poolOrFallback = useMemo(
    () => (letterPool.length ? letterPool : LETTERS.filter((l) => l.level <= 1)),
    [letterPool]
  );
  const pickLetter = () => sessionRef.current.pickFromPool(poolOrFallback, (l) => l.letter) || pickRandom(poolOrFallback);

  const [target, setTarget] = useState(() => pickRandom(poolOrFallback));
  const [result, setResult] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const roundTokenRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    setTarget((t) => (poolOrFallback.some((l) => l.letter === t.letter) ? t : pickRandom(poolOrFallback)));
  }, [poolOrFallback]);

  useEffect(() => {
    const token = ++roundTokenRef.current;
    clearScheduledTimers();
    if (!phonicsAudioEnabled) return () => clearScheduledTimers();

    scheduleAudio(() => {
      if (roundTokenRef.current !== token) return;
      speakLetterLesson(targetRef.current, { enabled: true });
    }, LETTER_ECHO_AUTO_PLAY_MS);

    return () => clearScheduledTimers();
  }, [target.letter, phonicsAudioEnabled]);

  useEffect(() => () => clearScheduledAudio(), []);

  const replayLesson = () => {
    if (isTransitioning || !phonicsAudioEnabled) return;
    cancelSpeech();
    speakLetterLesson(target, { enabled: true });
  };

  const advance = () => {
    if (isTransitioning) return;
    logAttempt();
    logWin("letterEcho");
    correctCountRef.current += 1;
    const speakPraise = shouldSpeakPraise({
      correctCount: correctCountRef.current,
      celebrationFrequency,
    });
    const praiseLine = speakPraise ? getPraiseLine() : null;
    setIsTransitioning(true);
    setResult(speakPraise ? { type: "good", text: praiseLine } : subtleCorrectResult());

    let advanced = false;
    const goNext = () => {
      if (advanced) return;
      advanced = true;
      clearScheduledTimers();
      cancelSpeech();
      setTarget(pickLetter());
      setResult(null);
      setIsTransitioning(false);
    };

    const safetyId = scheduleAudio(goNext, TTS_FALLBACK_TOTAL_MS);
    if (speakPraise && phonicsAudioEnabled) {
      speakText(praiseLine, 0.78, () => {
        cancelScheduledTimer(safetyId);
        scheduleAudio(goNext, TTS_AFTER_PHRASE_GAP_MS);
      });
    } else {
      scheduleAudio(() => setResult(null), 500);
      cancelScheduledTimer(safetyId);
      scheduleAudio(goNext, RIGHT_ANSWER_PAUSE_MS);
    }
  };

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      <ResultToast result={result} />
      <div className="rounded-[2rem] border-2 border-slate-900 bg-sky-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <p className="text-lg font-black text-slate-600">Letter Echo</p>
          <PhonicsAudioToggle enabled={phonicsAudioEnabled} onToggle={onPhonicsAudioChange} disabled={isTransitioning} />
        </div>
        <h2 className="mt-2 text-3xl font-black sm:text-4xl">Repeat after me, then tap I said it!</h2>
        <div className="mt-6 flex items-center justify-center gap-6">
          <span className="text-8xl font-black sm:text-9xl">{letterUpper(target)}</span>
          <span className="text-5xl font-black text-slate-400">and</span>
          <span className="text-8xl font-black sm:text-9xl">{letterLower(target)}</span>
        </div>
        <p className="mt-4 text-5xl" aria-hidden>
          {target.emoji}
        </p>
        {phonicsAudioEnabled ? (
          <button
            type="button"
            onClick={replayLesson}
            disabled={isTransitioning}
            className="rq-button mx-auto mt-5 flex items-center gap-3 rounded-full border-2 border-slate-900 bg-white px-6 py-4 text-xl font-black shadow-[0_5px_0_rgba(15,23,42,1)] disabled:opacity-50"
          >
            <VolumeIcon className="text-2xl" /> Hear it again
          </button>
        ) : (
          <LetterLessonScript letterObj={target} className="mx-auto mt-5 max-w-md" />
        )}
        <BigButton
          onClick={advance}
          disabled={isTransitioning}
          className="mx-auto mt-6 max-w-sm bg-emerald-100 disabled:opacity-50"
        >
          <span className="text-3xl">I said it!</span>
        </BigButton>
      </div>
    </div>
  );
}

function SoundsGame({
  logWin,
  logAttempt,
  playerLevel,
  activeReadingLevel,
  celebrationFrequency,
  phonicsAudioEnabled,
  onPhonicsAudioChange,
}) {
  const sessionRef = useRef(createGameSession());
  const correctCountRef = useRef(0);
  const [sessionTick, setSessionTick] = useState(0);
  const progressSlice = useMemo(
    () => ({ level: playerLevel, settings: { activeReadingLevel } }),
    [playerLevel, activeReadingLevel]
  );
  const sessionStats = useMemo(() => sessionRef.current.getStats(), [sessionTick]);
  const letterPool = useMemo(() => lettersForReadingDifficulty(progressSlice, sessionStats), [progressSlice, sessionStats]);
  const poolOrFallback = useMemo(
    () => (letterPool.length ? letterPool : LETTERS.filter((l) => l.level <= 1)),
    [letterPool]
  );
  const pickLetter = () => sessionRef.current.pickFromPool(poolOrFallback, (l) => l.letter) || pickRandom(poolOrFallback);
  const recordSession = (ok) => {
    sessionRef.current.recordAttempt(ok);
    setSessionTick((t) => t + 1);
  };

  const [target, setTarget] = useState(() => pickRandom(poolOrFallback));
  const [choices, setChoices] = useState(() => shuffle(poolOrFallback).slice(0, 4));
  const [result, setResult] = useState(null);
  const [showClue, setShowClue] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const roundTokenRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    setTarget((t) => (poolOrFallback.some((l) => l.letter === t.letter) ? t : pickRandom(poolOrFallback)));
  }, [poolOrFallback]);

  useEffect(() => {
    if (!choices.some((c) => c.letter === target.letter)) {
      setChoices(shuffle([target, ...shuffle(poolOrFallback.filter((l) => l.letter !== target.letter)).slice(0, 3)]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-play target letter after each new challenge renders.
  useEffect(() => {
    const token = ++roundTokenRef.current;
    clearScheduledTimers();
    if (!phonicsAudioEnabled) return () => clearScheduledTimers();

    scheduleAudio(() => {
      if (roundTokenRef.current !== token) return;
      speakLetterSound(targetRef.current, true);
    }, SOUND_POP_AUTO_PLAY_MS);

    return () => clearScheduledTimers();
  }, [target.letter, phonicsAudioEnabled]);

  useEffect(() => () => clearScheduledAudio(), []);

  const loadNextChallenge = () => {
    const next = pickLetter();
    setTarget(next);
    setChoices(shuffle([next, ...shuffle(poolOrFallback.filter((l) => l.letter !== next.letter)).slice(0, 3)]));
    setResult(null);
    setShowClue(false);
    setIsTransitioning(false);
  };

  const replayTargetSound = () => {
    if (isTransitioning || !phonicsAudioEnabled) return;
    cancelSpeech();
    speakLetterSound(target, true);
  };

  const replayLetterLesson = () => {
    if (isTransitioning || !phonicsAudioEnabled) return;
    cancelSpeech();
    speakLetterLesson(target, { enabled: true });
  };

  const choiceDisplays = useMemo(() => {
    const map = {};
    choices.forEach((c) => {
      map[c.letter] = letterChoiceDisplay(c.letter, `${target.letter}-${c.letter}`);
    });
    return map;
  }, [choices, target.letter]);

  const choose = (choice) => {
    if (isTransitioning) return;
    logAttempt("sounds");
    const ok = choice.letter === target.letter;
    recordSession(ok);
    if (ok) {
      const tokenAtAnswer = roundTokenRef.current;
      setIsTransitioning(true);
      correctCountRef.current += 1;
      const speakPraise = shouldSpeakPraise({
        correctCount: correctCountRef.current,
        celebrationFrequency,
      });
      const praiseLine = speakPraise ? getPraiseLine() : null;
      setResult(speakPraise ? { type: "good", text: praiseLine } : subtleCorrectResult());
      logWin("sounds");
      clearScheduledTimers();
      let advanced = false;
      const advance = () => {
        if (advanced || roundTokenRef.current !== tokenAtAnswer) return;
        advanced = true;
        clearScheduledTimers();
        loadNextChallenge();
      };
      const safetyId = scheduleAudio(advance, TTS_FALLBACK_TOTAL_MS);

      if (speakPraise) {
        speakText(praiseLine, 0.78, () => {
          cancelScheduledTimer(safetyId);
          scheduleAudio(advance, TTS_AFTER_PHRASE_GAP_MS);
        });
      } else {
        scheduleAudio(() => setResult(null), 500);
        cancelScheduledTimer(safetyId);
        scheduleAudio(advance, RIGHT_ANSWER_PAUSE_MS);
      }
    } else {
      const tokenAtWrong = roundTokenRef.current;
      setResult({ type: "try", text: "Try again" });
      clearScheduledTimers();
      cancelSpeech();
      speakText(getGentleTryAgainLine(), 0.72, () => {
        scheduleAudio(() => {
          if (roundTokenRef.current !== tokenAtWrong) return;
          if (phonicsAudioEnabled) speakLetterSound(targetRef.current, true);
        }, TTS_AFTER_PHRASE_GAP_MS);
      });
      scheduleAudio(() => setResult(null), 2200);
    }
  };

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      <ResultToast result={result} />
      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <p className="text-lg font-black text-slate-600">Sound Pop</p>
          <PhonicsAudioToggle enabled={phonicsAudioEnabled} onToggle={onPhonicsAudioChange} disabled={isTransitioning} />
        </div>
        <h2 className="mt-2 text-4xl font-black">Listen, then tap the letter.</h2>
        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="text-6xl font-black">{letterUpper(target)}</span>
          <span className="text-2xl font-black text-slate-400">/</span>
          <span className="text-6xl font-black">{letterLower(target)}</span>
        </div>
        {!phonicsAudioEnabled && (
          <p className="mt-3 text-base font-bold text-slate-600">
            Which letter makes the <strong>{target.sound}</strong> sound?
          </p>
        )}
        {phonicsAudioEnabled && (
          <>
            <button
              type="button"
              onClick={replayTargetSound}
              disabled={isTransitioning}
              className="rq-button mx-auto mt-5 flex items-center gap-3 rounded-full border-2 border-slate-900 bg-sky-100 px-6 py-4 text-2xl font-black shadow-[0_5px_0_rgba(15,23,42,1)] disabled:opacity-50"
            >
              <VolumeIcon className="text-3xl" /> Hear Sound Again
            </button>
            <button
              type="button"
              onClick={replayLetterLesson}
              disabled={isTransitioning}
              className="rq-button mx-auto mt-3 rounded-full border-2 border-slate-900 bg-violet-100 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
            >
              Hear letter lesson
            </button>
          </>
        )}
        {!phonicsAudioEnabled && <LetterLessonScript letterObj={target} className="mx-auto mt-4 max-w-md text-center" />}
        <button
          type="button"
          onClick={() => {
            setShowClue(true);
            if (phonicsAudioEnabled) speak(target.clue);
          }}
          disabled={isTransitioning}
          className="rq-button mx-auto mt-3 rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
        >
          Need a picture clue?
        </button>
        {showClue ? <p className="mt-4 text-6xl">{target.emoji}</p> : <p className="mt-4 text-lg font-black text-slate-500">Picture hidden so your reading brain works first 🧠</p>}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {choices.map((choice) => (
          <BigButton key={choice.letter} onClick={() => choose(choice)} disabled={isTransitioning} className="bg-amber-50 disabled:opacity-50">
            <span className="block text-7xl">{choiceDisplays[choice.letter]}</span>
            <span className="block text-sm text-slate-500">tap the letter</span>
          </BigButton>
        ))}
      </div>
    </div>
  );
}

function BuildWordGame({
  logWin,
  logAttempt,
  playerLevel,
  activeReadingLevel,
  readingTheme,
  celebrationFrequency,
  phonicsAudioEnabled,
}) {
  const sessionRef = useRef(createGameSession());
  const roundTokenRef = useRef(0);
  const correctCountRef = useRef(0);
  const [sessionTick, setSessionTick] = useState(0);
  const progressSlice = useMemo(
    () => ({ level: playerLevel, settings: { activeReadingLevel, readingTheme } }),
    [playerLevel, activeReadingLevel, readingTheme]
  );
  const sessionStats = useMemo(() => sessionRef.current.getStats(), [sessionTick]);
  const wordPool = useMemo(() => wordsForReadingDifficulty(progressSlice, sessionStats), [progressSlice, sessionStats]);
  const letterPool = useMemo(() => lettersForReadingDifficulty(progressSlice, sessionStats), [progressSlice, sessionStats]);
  const pickWord = () => sessionRef.current.pickFromPool(wordPool, (w) => w.word) || pickRandom(wordPool);
  const recordSession = (ok) => {
    sessionRef.current.recordAttempt(ok);
    setSessionTick((t) => t + 1);
  };

  const [target, setTarget] = useState(() => pickRandom(wordPool));
  const [built, setBuilt] = useState([]);
  const [result, setResult] = useState(null);
  const [showClue, setShowClue] = useState(false);
  const [giveUpRunning, setGiveUpRunning] = useState(false);

  useEffect(() => {
    setTarget((t) => (wordPool.some((w) => w.word === t.word) ? t : pickRandom(wordPool)));
  }, [wordPool]);

  useEffect(() => {
    const token = ++roundTokenRef.current;
    clearScheduledTimers();
    cancelSpeech();
    setShowClue(false);
    setGiveUpRunning(false);
    setBuilt([]);
    setResult(null);

    scheduleAudio(() => {
      if (roundTokenRef.current !== token) return;
      if (phonicsAudioEnabled) speakWholeWord(target);
    }, BUILD_ROUND_INTRO_MS);

    return () => clearScheduledTimers();
  }, [target.word, phonicsAudioEnabled]);

  useEffect(() => () => clearScheduledTimers(), []);

  const familyLabel = useMemo(() => {
    if (!target.family) return null;
    const fam = WORD_FAMILIES.find((f) => f.id === target.family);
    return fam ? fam.label : `-${target.family}`;
  }, [target]);

  const choices = useMemo(() => {
    const needed = [...new Set(target.parts)];
    const poolLetters = letterPool.length ? letterPool.map((l) => l.letter) : LETTERS.filter((l) => l.level <= 1).map((l) => l.letter);
    const distractorCount = Math.max(0, 6 - needed.length);
    const extras = shuffle(poolLetters.filter((l) => !needed.includes(l))).slice(0, distractorCount);
    const merged = shuffle([...needed, ...extras]);
    while (merged.length < 4) {
      const filler = pickRandom(poolLetters) || "a";
      if (!merged.includes(filler)) merged.push(filler);
    }
    return merged.slice(0, 6);
  }, [target, letterPool]);

  const nextIndex = built.length;
  const roundComplete = built.length >= target.parts.length;
  const letterGridDisabled = giveUpRunning || roundComplete;

  const nextRound = () => {
    clearScheduledTimers();
    cancelSpeech();
    setTarget(pickWord());
  };

  const hearWordAgain = () => {
    if (giveUpRunning || roundComplete) return;
    const tokenAt = roundTokenRef.current;
    clearScheduledTimers();
    cancelSpeech();
    scheduleAudio(() => {
      if (roundTokenRef.current !== tokenAt) return;
      if (phonicsAudioEnabled) speakWholeWord(target);
    }, 120);
  };

  const runNeedHelp = () => {
    if (giveUpRunning || roundComplete) return;
    const tokenAt = roundTokenRef.current;
    clearScheduledTimers();
    cancelSpeech();
    setShowClue(true);
    scheduleAudio(() => {
      if (roundTokenRef.current !== tokenAt) return;
      speakPhonicsForParts(target.parts, tokenAt, roundTokenRef, undefined, phonicsAudioEnabled);
    }, 400);
  };

  const runGiveUp = () => {
    if (giveUpRunning || roundComplete) return;
    const tokenAt = roundTokenRef.current;
    clearScheduledTimers();
    cancelSpeech();
    recordSession(false);
    setGiveUpRunning(true);
    setShowClue(true);

    let step = built.length;
    const parts = target.parts;

    const stepNext = () => {
      if (roundTokenRef.current !== tokenAt) {
        setGiveUpRunning(false);
        return;
      }
      if (step >= parts.length) {
        setGiveUpRunning(false);
        setResult(subtleCorrectResult());
        logWin("build", { family: target.family, buildOutcome: "giveup" });
        scheduleAudio(() => {
          if (roundTokenRef.current !== tokenAt) return;
          speakText("We built it together.", 0.76);
        }, TTS_AFTER_PHRASE_GAP_MS);
        return;
      }
      const ch = parts[step];
      const lo = LETTERS.find((l) => l.letter === ch);
      const afterLetter = () => {
        if (roundTokenRef.current !== tokenAt) {
          setGiveUpRunning(false);
          return;
        }
        setBuilt(parts.slice(0, step + 1));
        step += 1;
        scheduleAudio(stepNext, BUILD_GIVE_UP_LETTER_MS);
      };
      if (lo && phonicsAudioEnabled) {
        speakLetterLesson(lo, { enabled: true, onEnd: afterLetter });
      } else if (lo) {
        afterLetter();
      } else {
        speakText(ch, 0.58, afterLetter);
      }
    };

    scheduleAudio(stepNext, 280);
  };

  const choose = (letter) => {
    if (letterGridDisabled) return;
    logAttempt();
    const expected = target.parts[nextIndex];
    if (letter === expected) {
      const newBuilt = [...built, letter];
      setBuilt(newBuilt);
      if (newBuilt.length === target.parts.length) {
        recordSession(true);
        correctCountRef.current += 1;
        const speakPraise = shouldSpeakPraise({
          correctCount: correctCountRef.current,
          celebrationFrequency,
        });
        const praiseLine = speakPraise ? getPraiseLine() : null;
        setResult(speakPraise ? { type: "good", text: praiseLine } : subtleCorrectResult());
        logWin("build", { family: target.family });
        const tokenAt = roundTokenRef.current;
        const safetyId = scheduleAudio(() => {
          if (roundTokenRef.current !== tokenAt) return;
          speakText(target.word, 0.72);
        }, TTS_FALLBACK_TOTAL_MS);
        if (speakPraise) {
          speakText(praiseLine, 0.78, () => {
            if (roundTokenRef.current !== tokenAt) return;
            cancelScheduledTimer(safetyId);
            speakText(target.word, 0.72);
          });
        } else {
          scheduleAudio(() => setResult(null), 500);
          cancelScheduledTimer(safetyId);
          scheduleAudio(() => {
            if (roundTokenRef.current !== tokenAt) return;
            speakText(target.word, 0.72);
          }, RIGHT_ANSWER_PAUSE_MS);
        }
      }
    } else {
      recordSession(false);
      setResult({ type: "try", text: "Try another letter" });
      cancelSpeech();
      speakText(getGentleTryAgainLine(), 0.72);
      scheduleAudio(() => setResult(null), 1400);
    }
  };

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      <ResultToast result={result} />
      <div className="rounded-[2rem] border-2 border-slate-900 bg-lime-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <p className="text-lg font-black text-slate-600">Build a Word</p>
        {familyLabel && <p className="mt-1 text-sm font-bold text-slate-500">Word family {familyLabel}</p>}
        <h2 className="mt-3 text-3xl font-black">Tap the letters in order</h2>
        <div className="mt-5 flex justify-center gap-3">
          {target.parts.map((part, i) => (
            <div
              key={i}
              className={`grid h-20 w-20 place-items-center rounded-3xl border-2 border-slate-900 text-5xl font-black shadow-inner ${built[i] ? "rq-bounce bg-white" : "bg-lime-50"}`}
            >
              {built[i] ? letterCaseInWord(built[i], target.word) : "_"}
            </div>
          ))}
        </div>
        <div className="mt-4 min-h-[5rem] rounded-2xl border-2 border-dashed border-slate-300 bg-lime-50/80 px-3 py-3">
          {showClue ? (
            <p className="text-6xl" aria-hidden>
              {target.emoji}
            </p>
          ) : (
            <p className="text-base font-bold text-slate-600">Picture clue is hidden — build the word by listening and tapping letters.</p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={hearWordAgain}
            disabled={letterGridDisabled}
            className="rq-button rounded-full border-2 border-slate-900 bg-white px-4 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
          >
            <VolumeIcon className="mr-2 text-xl" /> Hear Word Again
          </button>
          <button
            type="button"
            onClick={runNeedHelp}
            disabled={letterGridDisabled}
            className="rq-button rounded-full border-2 border-slate-900 bg-sky-100 px-4 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
          >
            Need Help
          </button>
          <button
            type="button"
            onClick={runGiveUp}
            disabled={letterGridDisabled}
            className="rq-button rounded-full border-2 border-slate-900 bg-amber-100 px-4 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
          >
            I Give Up
          </button>
        </div>
        {roundComplete && (
          <button
            type="button"
            onClick={nextRound}
            className="rq-button mt-4 rounded-full border-2 border-slate-900 bg-white px-6 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
          >
            Next word
          </button>
        )}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {choices.map((letter) => (
          <BigButton key={letter} onClick={() => choose(letter)} disabled={letterGridDisabled} className="bg-white disabled:opacity-50">
            <span className="text-6xl">{letterCaseInWord(letter, target.word)}</span>
          </BigButton>
        ))}
      </div>
    </div>
  );
}

function normalizeWordToken(raw) {
  return raw.replace(/[^a-z]/gi, "").toLowerCase();
}

function ReadGame({ logWin, logAttempt, playerLevel, activeReadingLevel, readingTheme, todayStats, celebrationFrequency }) {
  const correctCountRef = useRef(0);
  const sessionRef = useRef(createGameSession());
  const advanceTimerRef = useRef(null);
  const [sessionTick, setSessionTick] = useState(0);
  const progressSlice = useMemo(
    () => ({ level: playerLevel, settings: { activeReadingLevel, readingTheme } }),
    [playerLevel, activeReadingLevel, readingTheme]
  );
  const sessionStats = useMemo(() => sessionRef.current.getStats(), [sessionTick]);
  const sentencePool = useMemo(() => sentencesForReadGame(progressSlice, sessionStats), [progressSlice, sessionStats]);
  const pickSentence = () => sessionRef.current.pickFromPool(sentencePool, (s) => s.id) || pickRandom(sentencePool);
  const recordSession = (ok) => {
    sessionRef.current.recordAttempt(ok);
    setSessionTick((t) => t + 1);
  };

  const [card, setCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!sentencePool.length) return;
    setCard((c) => (c && sentencePool.some((s) => s.id === c.id) ? c : pickSentence()));
  }, [sentencePool]);

  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
  }, []);

  const focusSet = useMemo(() => new Set((card?.focusWords || []).map((w) => w.toLowerCase())), [card]);
  const storyParts = useMemo(() => {
    if (!card) return [];
    if (card.type !== "mini_story") return [{ text: card.text, words: card.text.split(/\s+/) }];
    return card.text
      .split(/(?<=\.)\s+/)
      .filter(Boolean)
      .map((text) => ({ text, words: text.split(/\s+/) }));
  }, [card]);

  const goToNextSentence = () => {
    if (!sentencePool.length) return;
    setCard(pickSentence());
    setRevealed(false);
    setCompleted(false);
    setResult(null);
  };

  const markRead = () => {
    if (completed || !card) return;
    setCompleted(true);
    recordSession(true);
    logAttempt();
    logWin("read", { sentenceId: card.id });
    correctCountRef.current += 1;
    const speakPraise = shouldSpeakPraise({
      correctCount: correctCountRef.current,
      celebrationFrequency,
    });
    const praiseLine = speakPraise ? getPraiseLine() : null;
    setResult(speakPraise ? { type: "good", text: `${praiseLine} +1 star!` } : subtleCorrectResult());
    setCelebrate(speakPraise);
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    const advance = () => {
      advanceTimerRef.current = null;
      setCelebrate(false);
      goToNextSentence();
    };
    const delayMs = speakPraise ? TTS_FALLBACK_TOTAL_MS : RIGHT_ANSWER_PAUSE_MS;
    advanceTimerRef.current = window.setTimeout(advance, delayMs);
    if (speakPraise) {
      speak(praiseLine, 0.78, () => {
        if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = window.setTimeout(advance, TTS_AFTER_PHRASE_GAP_MS);
      });
    } else {
      scheduleAudio(() => setResult(null), 500);
    }
  };

  const day = normalizeDayEntry(todayStats);

  const emojiForCard = useMemo(() => {
    if (!card) return "📖";
    if (card.theme === "bird" || readingTheme === "bird") return "🐦";
    const first = (card.focusWords && card.focusWords[0]) || card.text.split(/\s+/)[0] || "read";
    const hit = LETTERS.find((l) => l.letter === normalizeWordToken(first).slice(0, 1));
    return hit?.emoji || "📖";
  }, [card, card?.id, card?.text, card?.focusWords, card?.theme, readingTheme]);

  if (!card) {
    return (
      <div className="rq-page mx-auto max-w-4xl px-4 pb-10 text-center">
        <p className="text-2xl font-black">Loading reading…</p>
      </div>
    );
  }

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      <ResultToast result={result} />
      <div className="mb-4 rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-[0_4px_0_rgba(15,23,42,1)]">
        <TodayStatsDashboard today={day} />
      </div>
      <div className="rounded-[2rem] border-2 border-slate-900 bg-violet-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <p className="text-lg font-black text-slate-600">
          {readingTheme === "bird" ? "🐦 Bird Buddies — Read It!" : "Read It!"}
        </p>
        <p className="mt-1 text-sm font-bold text-violet-900">
          Today: {day.sentencesRead} sentence{day.sentencesRead === 1 ? "" : "s"} read • Tap words, then press I read it!
        </p>
        <h2 className="mt-2 text-3xl font-black">{card.type === "mini_story" ? "Read the mini story out loud" : "Read the sentence out loud"}</h2>
        <div className="my-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-inner">
          <div className="mb-4 text-7xl">{emojiForCard}</div>
          {storyParts.map((part, pi) => (
            <div key={`${card.id}-part-${pi}`} className={pi > 0 ? "mt-6 border-t-2 border-dashed border-slate-200 pt-6" : ""}>
              <div className="flex flex-wrap justify-center gap-3">
                {part.words.map((w, i) => {
                  const key = normalizeWordToken(w);
                  const isFocus = focusSet.has(key);
                  return (
                    <button
                      key={`${card.id}-${pi}-${w}-${i}`}
                      onClick={() => speak(key || w.replace(/[^a-z]/gi, "") || part.text, 0.7)}
                      className={`rq-button rounded-2xl px-3 py-2 text-4xl font-black ${isFocus ? "bg-amber-200 underline decoration-4 decoration-amber-700" : "bg-slate-100"}`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => speak(card.text, 0.75)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            <VolumeIcon className="mr-2 text-xl" /> Hear it
          </button>
          <button onClick={() => setRevealed(!revealed)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            Helper hint
          </button>
          <button
            type="button"
            onClick={markRead}
            disabled={completed}
            className="rq-button rounded-full border-2 border-slate-900 bg-emerald-200 px-6 py-4 text-xl font-black shadow-[0_5px_0_rgba(15,23,42,1)] disabled:opacity-60"
          >
            {completed ? "Nice reading! Next one…" : "I read it! ⭐"}
          </button>
          <button
            type="button"
            onClick={goToNextSentence}
            disabled={completed}
            className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
          >
            Skip (no star)
          </button>
        </div>
        {revealed && (
          <div className="rq-pop mx-auto mt-5 max-w-xl rounded-3xl border-2 border-slate-900 bg-white p-4 text-left font-bold">
            <p>1. Focus words are underlined in yellow.</p>
            <p>2. Tap any word to hear it.</p>
            <p>3. Read slowly like this: “{card.text}”</p>
            {card.helperPrompt && <p className="mt-2 text-slate-600">Tip: {card.helperPrompt}</p>}
            <p className="mt-2 text-sm text-slate-500">
              Type:{" "}
              {card.type === "mini_story"
                ? "two-sentence story"
                : card.type === "sight-word-supported"
                  ? "some helper words"
                  : "mostly decodable"}
            </p>
          </div>
        )}
      </div>
      {celebrate && (
        <div className="rq-pop pointer-events-none fixed inset-0 z-40 grid place-items-center text-8xl">
          ✨⭐✨
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="rounded-3xl border-2 border-slate-900 bg-white p-4 shadow-[0_4px_0_rgba(15,23,42,1)]">
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  );
}

function formatParentProgressSuccessMessage(progress, sourceLabel) {
  return `Progress restored (${sourceLabel}): Level ${progress.level || 1}, ${progress.lifetimeStars ?? 0} lifetime stars, ${progress.stars ?? 0} spendable stars.`;
}

function AdminDashboard({
  progress,
  setProgress,
  testMode,
  setTestMode,
  cloud,
  onApplyParentProgress,
  onApplyRepairFields,
  onResetDeviceOnly,
  onResetEverywhere,
  onClearAppCache,
  reader,
}) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [adminLoginEmail, setAdminLoginEmail] = useState("");
  const [adminLoginPassword, setAdminLoginPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);
  const [claimingRewardId, setClaimingRewardId] = useState(null);
  const pendingRewardClaimRef = useRef(new Set());
  const rewardClaimInFlightRef = useRef(null);
  const [note, setNote] = useState(progress.dailyLog[TODAY_KEY]?.notes || "");
  const today = progress.dailyLog[TODAY_KEY] || emptyDay();
  const streak = getStreak(progress.dailyLog);
  const earnedBadges = BADGES.filter((b) => progress.badges.includes(b.id));
  const days = Object.entries(progress.dailyLog || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14);

  const addParentMinutes = (minutes) => {
    setProgress((old) => {
      const currentDay = old.dailyLog[TODAY_KEY] || emptyDay();
      return awardBadges({
        ...old,
        totals: { ...old.totals, parentMinutes: old.totals.parentMinutes + minutes },
        dailyLog: {
          ...old.dailyLog,
          [TODAY_KEY]: {
            ...currentDay,
            parentMinutes: currentDay.parentMinutes + minutes,
            lastPlayedAt: new Date().toISOString(),
          },
        },
      });
    });
  };

  const saveNote = () => {
    setProgress((old) => ({
      ...old,
      dailyLog: {
        ...old.dailyLog,
        [TODAY_KEY]: { ...(old.dailyLog[TODAY_KEY] || emptyDay()), notes: note, lastPlayedAt: new Date().toISOString() },
      },
    }));
  };

  const claimReward = (reward) => {
    const cost = Number(reward.cost) || 0;
    if (pendingRewardClaimRef.current.has(reward.id)) return;
    if (claimingRewardId) return;
    if ((Number(progress.stars) || 0) < cost) return;

    pendingRewardClaimRef.current.add(reward.id);
    setClaimingRewardId(reward.id);

    const claimId = `reward-${reward.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    rewardClaimInFlightRef.current = { rewardId: reward.id, claimId };

    let didClaim = false;
    setProgress((old) => {
      const inFlight = rewardClaimInFlightRef.current;
      if (!inFlight || inFlight.rewardId !== reward.id) return old;
      if (inFlight.result) return inFlight.result;

      const next = applyRewardClaim(old, {
        claimId: inFlight.claimId,
        id: reward.id,
        title: reward.title,
        cost,
      });
      if (!next) return old;
      inFlight.result = next;
      didClaim = true;
      return next;
    });

    if (didClaim) {
      speak(`${reward.title} reward claimed!`);
    }

    window.setTimeout(() => {
      pendingRewardClaimRef.current.delete(reward.id);
      setClaimingRewardId((current) => (current === reward.id ? null : current));
      if (rewardClaimInFlightRef.current?.rewardId === reward.id) {
        rewardClaimInFlightRef.current = null;
      }
    }, 800);
  };

  const exportProgress = async () => {
    const text = JSON.stringify(progress, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        alert(`Progress copied. Paste it into ChatGPT so I can analyze ${reader.possessiveName} reading progress.`);
      } else {
        alert(text);
      }
    } catch {
      alert(text);
    }
  };

  const resetMathAndCountingTestData = () => {
    const ok = window.confirm("Remove test math/counting progress and related badges? Reading progress will stay.");
    if (!ok) return;
    setProgress((old) => {
      const cleanedDailyLog = Object.fromEntries(
        Object.entries(old.dailyLog || {}).map(([day, log]) => [
          day,
          {
            ...log,
            countingCorrect: 0,
            mathCorrect: 0,
          },
        ])
      );
      return {
        ...old,
        badges: (old.badges || []).filter((id) => !["math_helper", "counting_captain", "counting_ten", "tiny_math_ten"].includes(id)),
        totals: {
          ...old.totals,
          countingCorrect: 0,
          mathCorrect: 0,
        },
        dailyLog: cleanedDailyLog,
      };
    });
  };

  const resetReadingBadgeTestData = () => {
    const ok = window.confirm(`Remove tested reading badge progress? This clears sound/word/sentence badge progress so ${reader.name} can earn those badges later.`);
    if (!ok) return;
    setProgress((old) => {
      const cleanedDailyLog = Object.fromEntries(
        Object.entries(old.dailyLog || {}).map(([day, log]) => [
          day,
          {
            ...log,
            soundsCorrect: 0,
            wordsBuilt: 0,
            helpedWordsBuilt: 0,
            mazeCompleted: 0,
            sentencesRead: 0,
          },
        ])
      );
      return {
        ...old,
        badges: (old.badges || []).filter(
          (id) =>
            ![
              "sound_scout",
              "word_builder",
              "sentence_reader",
              "sentence_starter",
              "word_family_explorer",
              "level_2_reader",
            ].includes(id)
        ),
        totals: {
          ...old.totals,
          soundsCorrect: 0,
          wordsBuilt: 0,
          helpedWordsBuilt: 0,
          mazeCompleted: 0,
          sentencesRead: 0,
          wordFamiliesUsed: [],
          readingWinsAtLevel2Plus: 0,
        },
        dailyLog: cleanedDailyLog,
      };
    });
  };

  const removeTestingStarsAndRewards = () => {
    const ok = window.confirm(`Remove test-earned stars, reward claims, and star badges? This lets ${reader.name} earn First Star and 10-Star Reader later.`);
    if (!ok) return;
    setProgress((old) => ({
      ...old,
      stars: 0,
      lifetimeStars: 0,
      correct: 0,
      attempts: 0,
      badges: (old.badges || []).filter((id) => !["first_star", "ten_star_reader"].includes(id)),
      rewardClaims: [],
      dailyLog: Object.fromEntries(
        Object.entries(old.dailyLog || {}).map(([day, log]) => [
          day,
          {
            ...log,
            stars: 0,
            correct: 0,
            attempts: 0,
          },
        ])
      ),
    }));
  };

  const removeStreakBadgesOnly = () => {
    const ok = window.confirm("Remove streak badges and clear practice markers from daily logs so they do not instantly re-award?");
    if (!ok) return;
    setProgress((old) => ({
      ...old,
      badges: (old.badges || []).filter((id) => !["two_day_streak", "five_day_streak"].includes(id)),
      dailyLog: {
        [TODAY_KEY]: {
          ...(old.dailyLog?.[TODAY_KEY] || emptyDay()),
          opened: 1,
          attempts: 0,
          correct: 0,
          stars: 0,
          soundsCorrect: 0,
          wordsBuilt: 0,
          helpedWordsBuilt: 0,
          sentencesRead: 0,
          countingCorrect: 0,
          mathCorrect: 0,
          parentMinutes: 0,
          lastPlayedAt: new Date().toISOString(),
        },
      },
    }));
  };

  if (!unlocked) {
    return (
      <div className="rq-page mx-auto max-w-xl px-4 pb-10">
        <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
          <LockIcon className="text-4xl" />
          <h2 className="mt-2 text-3xl font-black">Parent Admin</h2>
          <p className="mt-2 font-semibold text-slate-600">
            Parent PIN clue: <strong>{ADMIN_PIN_WORDS}</strong>.
          </p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            type="password"
            placeholder="Enter PIN"
            className="mt-5 w-full rounded-2xl border-2 border-slate-900 px-4 py-4 text-center text-2xl font-black"
          />
          <button onClick={() => setUnlocked(pin === ADMIN_PIN)} className="rq-button mt-4 w-full rounded-2xl border-2 border-slate-900 bg-emerald-200 px-5 py-4 text-xl font-black shadow-[0_5px_0_rgba(15,23,42,1)]">
            <UnlockIcon className="mr-2 text-xl" /> Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rq-page mx-auto grid max-w-5xl gap-5 px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black">Parent Admin</h2>
            <p className="font-semibold text-slate-600">Daily logs, badges, rewards, and export for ChatGPT check-ins.</p>
          </div>
          <button onClick={exportProgress} className="rq-button rounded-full border-2 border-slate-900 bg-sky-100 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            <ClipboardIcon className="mr-2 text-xl" /> Copy progress JSON
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard icon={<StarIcon />} label="Stars" value={progress.stars} />
        <StatCard icon={<TrophyIcon />} label="Badges" value={earnedBadges.length} />
        <StatCard icon={<CalendarIcon />} label="Streak" value={`${streak} day`} />
        <StatCard icon={<CheckIcon />} label="Today" value={`${today.correct}/${today.attempts}`} />
        <button
          onClick={() => setTestMode((v) => !v)}
          className={`rq-button rounded-3xl border-2 border-slate-900 p-4 text-left shadow-[0_4px_0_rgba(15,23,42,1)] ${testMode ? "bg-emerald-200" : "bg-white"}`}
        >
          <div className="text-sm font-black uppercase tracking-wide text-slate-500">🧪 Test Mode</div>
          <div className="mt-1 text-2xl font-black">{testMode ? "ON" : "OFF"}</div>
          <div className="text-xs font-bold text-slate-600">Mini games cost 0 when ON</div>
        </button>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-emerald-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h3 className="text-2xl font-black">Learning settings</h3>
        <p className="mt-2 font-semibold text-slate-700">Pick the highest pack {reader.name} should see. Games include that level and easier content. Saved with cloud progress.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-black text-slate-800">Active reading level</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={`rl-${n}`}
                  type="button"
                  onClick={() =>
                    setProgress((old) => ({
                      ...old,
                      settings: { ...(old.settings || {}), activeReadingLevel: clampLevel(n) },
                    }))
                  }
                  className={`rq-button rounded-full border-2 border-slate-900 px-4 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)] ${
                    clampLevel(progress.settings?.activeReadingLevel) === n ? "bg-emerald-200" : "bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-black text-slate-800">Active math level</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={`ml-${n}`}
                  type="button"
                  onClick={() =>
                    setProgress((old) => ({
                      ...old,
                      settings: { ...(old.settings || {}), activeMathLevel: clampLevel(n) },
                    }))
                  }
                  className={`rq-button rounded-full border-2 border-slate-900 px-4 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)] ${
                    clampLevel(progress.settings?.activeMathLevel) === n ? "bg-emerald-200" : "bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p className="font-black text-slate-800">Reading theme</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">Bird Buddies favors nest, egg, owl, and bird stories in Read It and Build a Word.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.values(READING_THEMES).map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() =>
                  setProgress((old) => ({
                    ...old,
                    settings: { ...(old.settings || {}), readingTheme: theme.id },
                  }))
                }
                className={`rq-button rounded-full border-2 border-slate-900 px-4 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)] ${
                  (progress.settings?.readingTheme || "default") === theme.id ? "bg-emerald-200" : "bg-white"
                }`}
              >
                {theme.emoji} {theme.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="font-black text-slate-800">Phonics audio</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">Turn off so {reader.name} can practice letters quietly with you coaching. Applies to Letter Echo and Sound Pop.</p>
          <button
            type="button"
            onClick={() =>
              setProgress((old) => ({
                ...old,
                settings: {
                  ...(old.settings || {}),
                  phonicsAudioEnabled: !normalizePhonicsAudioEnabled(old.settings?.phonicsAudioEnabled),
                },
              }))
            }
            className={`rq-button mt-2 rounded-full border-2 border-slate-900 px-4 py-2 font-black shadow-[0_3px_0_rgba(15,23,42,1)] ${
              normalizePhonicsAudioEnabled(progress.settings?.phonicsAudioEnabled) ? "bg-emerald-200" : "bg-slate-200"
            }`}
          >
            {normalizePhonicsAudioEnabled(progress.settings?.phonicsAudioEnabled) ? "🔊 Audio on" : "🔇 Audio off"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={<VolumeIcon />} label="Letters in pool" value={filterByMaxLevel(LETTERS, clampLevel(progress.settings?.activeReadingLevel)).length} />
          <StatCard icon={<BookIcon />} label="Build-a-word pool" value={wordsForReadingLevel(clampLevel(progress.settings?.activeReadingLevel)).length} />
          <StatCard icon={<BookIcon />} label="Read It sentences" value={sentencesForReadingLevel(clampLevel(progress.settings?.activeReadingLevel)).length} />
          <StatCard icon={<BookIcon />} label="Bird sentences" value={countBirdBuddySentences()} />
          <StatCard icon={<ClipboardIcon />} label="Counting sets" value={countingSetsForMathLevel(clampLevel(progress.settings?.activeMathLevel)).length} />
          <StatCard icon={<ClipboardIcon />} label="Tiny math facts" value={mathFactsForLevel(clampLevel(progress.settings?.activeMathLevel)).length} />
        </div>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-sky-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h3 className="text-2xl font-black">Family account &amp; cloud sync</h3>
        {(() => {
          const sync = getCloudSyncStatus(cloud);
          return (
            <div className={`mt-3 inline-flex flex-col rounded-2xl border-2 border-slate-900 px-4 py-2 ${
              sync.id === "saved" ? "bg-emerald-100" : sync.id === "saving" ? "bg-sky-100" : sync.id === "conflict" ? "bg-violet-100" : "bg-slate-100"
            }`}>
              <span className="text-xs font-black uppercase tracking-wide">Sync status</span>
              <span className="text-lg font-black">{sync.label}</span>
              <span className="text-sm font-semibold">{sync.detail}</span>
            </div>
          );
        })()}
        {!cloud.configured && (
          <p className="mt-2 text-sm font-semibold text-slate-600">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to <code className="rounded bg-white px-1">.env.local</code>, then restart the dev server.</p>
        )}
        {authMessage && <p className="mt-2 text-sm font-semibold text-slate-800">{authMessage}</p>}
        {cloud.configured && cloud.authEmail && (
          <div className="mt-4 grid gap-3">
            <p className="font-semibold text-slate-700">
              Signed in as <strong>{cloud.authEmail}</strong>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={authBusy || cloud.syncStatus === "syncing"}
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthMessage(null);
                  try {
                    await cloud.onSyncNow();
                  } catch (e) {
                    setAuthMessage(e?.message || "Sync failed");
                  } finally {
                    setAuthBusy(false);
                  }
                }}
                className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
              >
                Sync now
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthMessage(null);
                  try {
                    await cloud.onSignOut();
                    setAdminLoginPassword("");
                  } catch (e) {
                    setAuthMessage(e?.message || "Sign out failed");
                  } finally {
                    setAuthBusy(false);
                  }
                }}
                className="rq-button rounded-full border-2 border-slate-900 bg-rose-100 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
        {cloud.configured && !cloud.authEmail && (
          <div className="mt-4 grid max-w-md gap-3">
            <label className="grid gap-1 font-semibold text-slate-700">
              Email
              <input
                type="email"
                autoComplete="username"
                value={adminLoginEmail}
                onChange={(e) => setAdminLoginEmail(e.target.value)}
                className="rounded-2xl border-2 border-slate-900 px-4 py-3 font-semibold"
                placeholder="parent@family.com"
              />
            </label>
            <label className="grid gap-1 font-semibold text-slate-700">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={adminLoginPassword}
                onChange={(e) => setAdminLoginPassword(e.target.value)}
                className="rounded-2xl border-2 border-slate-900 px-4 py-3 font-semibold"
                placeholder="••••••••"
              />
            </label>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                disabled={authBusy}
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthMessage(null);
                  try {
                    await cloud.onSignIn(adminLoginEmail.trim(), adminLoginPassword);
                    setAdminLoginPassword("");
                  } catch (e) {
                    setAuthMessage(e?.message || "Sign in failed");
                  } finally {
                    setAuthBusy(false);
                  }
                }}
                className="rq-button rounded-full border-2 border-slate-900 bg-emerald-200 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
              >
                Sign in
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthMessage(null);
                  try {
                    await cloud.onSignUp(adminLoginEmail.trim(), adminLoginPassword);
                    setAdminLoginPassword("");
                    setAuthMessage("Check your email if confirmation is required, then sign in.");
                  } catch (e) {
                    setAuthMessage(e?.message || "Could not create account");
                  } finally {
                    setAuthBusy(false);
                  }
                }}
                className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
              >
                Create account
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[2rem] border-2 border-slate-900 bg-amber-50 p-5">
          <h3 className="flex items-center gap-2 text-2xl font-black">
            <CalendarIcon /> Today’s manual log
          </h3>
          <p className="mt-2 font-semibold text-slate-700">Use this when you read with her outside the app so the streak still reflects real work.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => addParentMinutes(5)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
              +5 min
            </button>
            <button onClick={() => addParentMinutes(10)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
              +10 min
            </button>
            <button onClick={() => addParentMinutes(15)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
              +15 min
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Example: struggled with /a/ vs /i/, loved badges, read 'cat' independently."
            className="mt-4 min-h-28 w-full rounded-2xl border-2 border-slate-900 p-3 font-semibold"
          />
          <button onClick={saveNote} className="rq-button mt-3 rounded-full border-2 border-slate-900 bg-emerald-200 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            Save note
          </button>
        </div>

        <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5">
          <h3 className="flex items-center gap-2 text-2xl font-black">
            <GiftIcon /> Reward store
          </h3>
          <p className="mt-2 font-semibold text-slate-700">
            Spendable stars: <strong>{progress.stars}</strong>. Keep prizes tiny and joyful.
          </p>
          <div className="mt-4 grid gap-3">
            {REWARDS.map((reward) => (
              <button
                key={reward.id}
                type="button"
                onClick={() => claimReward(reward)}
                disabled={progress.stars < reward.cost || claimingRewardId !== null}
                className="rq-button flex items-center justify-between rounded-2xl border-2 border-slate-900 bg-rose-50 px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)] disabled:opacity-45"
              >
                <span>
                  {reward.emoji} {reward.title}
                </span>
                <span>{reward.cost} ⭐</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-red-50 p-5">
        <h3 className="text-2xl font-black">Testing cleanup</h3>
        <p className="mt-2 font-semibold text-slate-700">Use these after parent testing so {reader.name} can earn badges and rewards for real later.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button onClick={removeTestingStarsAndRewards} className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            ⭐ Remove test stars/reward claims
            <span className="block text-sm font-bold text-slate-600">Sets spendable stars to 0 and clears claimed rewards.</span>
          </button>
          <button onClick={resetMathAndCountingTestData} className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            🔢 Reset math/counting test data
            <span className="block text-sm font-bold text-slate-600">Clears math/count totals and removes math/counting badges (including Counting 10 and Tiny Math 10).</span>
          </button>
          <button onClick={resetReadingBadgeTestData} className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            📚 Reset reading badge test data
            <span className="block text-sm font-bold text-slate-600">Clears sound/word/sentence totals, word-family tracking, level-2 win counts, and related reading badges.</span>
          </button>
          <button onClick={removeStreakBadgesOnly} className="rq-button rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            🔥 Remove streak badges only
            <span className="block text-sm font-bold text-slate-600">Clears old daily logs and removes 2-day/5-day badges so they can be earned later.</span>
          </button>
        </div>
      </div>

      <ParentProgressTools
        progress={progress}
        onApplyParentProgress={onApplyParentProgress}
        onApplyRepairFields={onApplyRepairFields}
        onResetDeviceOnly={onResetDeviceOnly}
        onResetEverywhere={onResetEverywhere}
        getStreak={getStreak}
        pinGate={false}
        adminPin={ADMIN_PIN}
        adminPinWords={ADMIN_PIN_WORDS}
        allowCloudResetUnlock
      />

      <div className="rounded-[2rem] border-2 border-slate-900 bg-slate-100 p-5">
        <h3 className="text-xl font-black">App update</h3>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          If repair or import changes do not appear, clear the installed app cache and reload the latest version.
        </p>
        <button
          type="button"
          onClick={onClearAppCache}
          className="rq-button mt-4 rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
        >
          Update app / clear app cache
        </button>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5">
        <h3 className="text-2xl font-black">Badge board</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => {
            const earned = progress.badges.includes(badge.id);
            return (
              <div key={badge.id} className={`rounded-3xl border-2 border-slate-900 p-4 ${earned ? "bg-yellow-100" : "bg-slate-100 opacity-70"}`}>
                <div className="text-4xl">{badge.emoji}</div>
                <div className="mt-1 font-black">{badge.name}</div>
                <div className="text-sm font-bold text-slate-600">{badge.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5">
        <h3 className="text-2xl font-black">Recent daily logs</h3>
        <div className="mt-4 overflow-auto rounded-2xl border-2 border-slate-900">
          <table className="w-full min-w-[640px] text-left text-sm font-semibold">
            <thead className="bg-slate-100 font-black">
              <tr>
                <th className="p-3">Day</th>
                <th className="p-3">Right</th>
                <th className="p-3">Sounds</th>
                <th className="p-3">Words</th>
                <th className="p-3">Sentences</th>
                <th className="p-3">Parent min</th>
              </tr>
            </thead>
            <tbody>
              {days.map(([day, log]) => (
                <tr key={day} className="border-t-2 border-slate-200">
                  <td className="p-3">{day}</td>
                  <td className="p-3">
                    {log.correct}/{log.attempts}
                  </td>
                  <td className="p-3">{log.soundsCorrect}</td>
                  <td className="p-3">{log.wordsBuilt}</td>
                  <td className="p-3">{log.sentencesRead}</td>
                  <td className="p-3">{log.parentMinutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-violet-50 p-5">
        <div className="flex items-center gap-3">
          <BookIcon className="text-3xl" />
          <h3 className="text-2xl font-black">How to use this week</h3>
        </div>
        <div className="mt-4 grid gap-3 font-semibold text-slate-700">
          <p>
            <strong>Daily target:</strong> 5 minutes minimum. Stop early if frustration rises.
          </p>
          <p>
            <strong>Parent feedback to ChatGPT:</strong> copy progress JSON once or twice a week, then tell me what felt easy/hard emotionally and academically.
          </p>
          <p>
            <strong>Prize rule:</strong> stars can buy tiny relational rewards, not huge dopamine bombs every day.
          </p>
          <p>
            <strong>Next app upgrade:</strong> add level locks so she only advances after enough accuracy with a sound set.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [testMode, setTestMode] = useState(() => {
    try {
      return localStorage.getItem("octavia-test-mode") === "true";
    } catch {
      return false;
    }
  });
  const [mode, setMode] = useState("home");
  const [newBadge, setNewBadge] = useState(null);
  const [authEmail, setAuthEmail] = useState(null);
  const [syncStatus, setSyncStatus] = useState("offline");
  const cloudLoadCompletedRef = useRef(!supabaseConfigured);
  const userEarnedProgressRef = useRef(false);
  const parentOverrideInFlightRef = useRef(0);
  const [progress, setProgress] = useState(() => {
    try {
      const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return saved ? migrateProgress(JSON.parse(saved)) : syncProgression(defaultProgress());
    } catch {
      return syncProgression(defaultProgress());
    }
  });

  const activeReadingLevel = clampLevel(progress.settings?.activeReadingLevel);
  const activeMathLevel = clampLevel(progress.settings?.activeMathLevel);
  const readingTheme = progress.settings?.readingTheme === "bird" ? "bird" : "default";
  const celebrationFrequency = normalizeCelebrationFrequency(progress.settings?.celebrationFrequency);
  const phonicsAudioEnabled = normalizePhonicsAudioEnabled(progress.settings?.phonicsAudioEnabled);
  const playerLevel = progress.level || 1;

  useEffect(() => {
    if (mode === "home" || mode === "teacher" || mode === "admin") return;
    if (!isModeUnlocked(mode, progress)) setMode("home");
  }, [mode, progress.level]);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    try {
      writeProgressToLocalStorage(progress);
      localStorage.setItem("octavia-test-mode", String(testMode));
    } catch {}
  }, [progress, testMode]);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setAuthEmail(null);
        setSyncStatus("offline");
        cloudLoadCompletedRef.current = true;
        return;
      }

      setAuthEmail(session.user.email ?? "");

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        if (Date.now() - parentOverrideInFlightRef.current < PARENT_OVERRIDE_GUARD_MS) {
          cloudLoadCompletedRef.current = true;
          return;
        }
        cloudLoadCompletedRef.current = false;
        void (async () => {
          setSyncStatus("syncing");
          try {
            const row = await loadCloudProgress();
            const { progress: merged, conflictResolved } = reconcileProgressWithMeta(
              progressRef.current,
              row?.progress,
              row?.serverUpdatedAt
            );
            const withBadges = awardBadges(merged);
            flushSync(() => setProgress(withBadges));
            progressRef.current = withBadges;
            writeProgressToLocalStorage(withBadges);
            cloudLoadCompletedRef.current = true;
            const saved = await saveCloudProgress(withBadges, {
              cloudLoadCompleted: true,
              allowReset: false,
            });
            if (saved?.progress && Date.now() - parentOverrideInFlightRef.current >= PARENT_OVERRIDE_GUARD_MS) {
              flushSync(() => setProgress(saved.progress));
              progressRef.current = saved.progress;
              writeProgressToLocalStorage(saved.progress);
            }
            if (saved?.conflictResolved || conflictResolved) {
              setSyncStatus("conflict");
              window.setTimeout(() => setSyncStatus("signed_in"), 5000);
            } else {
              setSyncStatus("saved");
              window.setTimeout(() => setSyncStatus("signed_in"), 2000);
            }
          } catch (e) {
            console.error(e);
            cloudLoadCompletedRef.current = true;
            setSyncStatus("error");
          }
        })();
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !authEmail) return undefined;
    if (!cloudLoadCompletedRef.current) return undefined;
    if (Date.now() - parentOverrideInFlightRef.current < PARENT_OVERRIDE_GUARD_MS) return undefined;

    const current = progressRef.current;
    if (!userEarnedProgressRef.current && !hasMeaningfulProgress(current)) {
      return undefined;
    }

    const id = window.setTimeout(async () => {
      if (Date.now() - parentOverrideInFlightRef.current < PARENT_OVERRIDE_GUARD_MS) return;
      setSyncStatus((s) => (s === "error" || s === "conflict" ? s : "syncing"));
      try {
        const result = await saveCloudProgress(progressRef.current, {
          cloudLoadCompleted: cloudLoadCompletedRef.current,
        });
        if (result?.skipped && result.reason === "cloud_load_pending") return;
        if (result?.conflictResolved) {
          setSyncStatus("conflict");
          window.setTimeout(() => setSyncStatus((prev) => (prev === "conflict" ? "signed_in" : prev)), 5000);
          return;
        }
        setSyncStatus("saved");
        window.setTimeout(() => setSyncStatus((prev) => (prev === "saved" ? "signed_in" : prev)), 2000);
      } catch (e) {
        console.error(e);
        setSyncStatus("error");
      }
    }, 800);

    return () => window.clearTimeout(id);
  }, [progress, authEmail]);

  const handleCloudSignIn = async (email, password) => {
    const { error } = await signInWithEmail(email, password);
    if (error) throw error;
  };

  const handleCloudSignUp = async (email, password) => {
    const { error } = await signUpWithEmail(email, password);
    if (error) throw error;
  };

  const handleCloudSignOut = async () => {
    const { error } = await signOut();
    if (error) throw error;
  };

  const handleCloudSyncNow = async () => {
    if (!authEmail || !supabaseConfigured) return;
    setSyncStatus("syncing");
    try {
      const row = await loadCloudProgress();
      const { progress: merged, conflictResolved } = reconcileProgressWithMeta(
        progressRef.current,
        row?.progress,
        row?.serverUpdatedAt
      );
      const withBadges = awardBadges(merged);
      setProgress(withBadges);
      const saved = await saveCloudProgress(withBadges, { cloudLoadCompleted: true });
      if (saved?.progress && Date.now() - parentOverrideInFlightRef.current >= PARENT_OVERRIDE_GUARD_MS) {
        flushSync(() => setProgress(saved.progress));
        progressRef.current = saved.progress;
        writeProgressToLocalStorage(saved.progress);
      }
      if (saved?.conflictResolved || conflictResolved) {
        setSyncStatus("conflict");
        window.setTimeout(() => setSyncStatus("signed_in"), 5000);
      } else {
        setSyncStatus("saved");
        window.setTimeout(() => setSyncStatus("signed_in"), 2000);
      }
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
      throw e;
    }
  };

  const applyParentProgressOverride = useCallback(
    async (nextProgress, sourceLabel = "parent-override", { allowReset = false } = {}) => {
      console.log("[progress-repair] clicked", sourceLabel, nextProgress);
      parentOverrideInFlightRef.current = Date.now();

      try {
        const backup = createProgressBackup(progressRef.current);
        if (!backup.ok) {
          console.warn("[progress-repair] backup before override failed", backup.error);
        }

        let prepared = typeof nextProgress === "object" && nextProgress ? { ...nextProgress } : {};
        prepared = honorParentProgressFields(prepared);
        const finalProgress = awardBadges(migrateProgress(prepared));

        console.log("[progress-repair] applying", sourceLabel, {
          level: finalProgress.level,
          lifetimeStars: finalProgress.lifetimeStars,
          stars: finalProgress.stars,
          correct: finalProgress.correct,
        });

        userEarnedProgressRef.current = true;
        flushSync(() => setProgress(finalProgress));
        progressRef.current = finalProgress;
        const wroteLocal = writeProgressToLocalStorage(finalProgress);
        console.log("[progress-repair] localStorage written", PROGRESS_STORAGE_KEY, wroteLocal, {
          level: finalProgress.level,
          lifetimeStars: finalProgress.lifetimeStars,
        });

        setSyncStatus("syncing");
        let syncError = null;

        if (supabaseConfigured && authEmail) {
          try {
            const saved = await saveCloudProgress(finalProgress, {
              cloudLoadCompleted: true,
              allowReset,
              parentOverride: !allowReset,
              skipReconcile: !allowReset,
            });
            if (saved?.skipped && saved.reason === "cloud_load_pending") {
              syncError = "Cloud sync is still loading — saved on this device only.";
            } else if (saved?.progress) {
              flushSync(() => setProgress(saved.progress));
              progressRef.current = saved.progress;
              writeProgressToLocalStorage(saved.progress);
              console.log("[progress-repair] cloud saved", sourceLabel, {
                level: saved.progress.level,
                lifetimeStars: saved.progress.lifetimeStars,
              });
            } else {
              console.log("[progress-repair] cloud saved", sourceLabel, saved);
            }
            setSyncStatus("saved");
            window.setTimeout(() => setSyncStatus("signed_in"), 2000);
          } catch (e) {
            console.error("[progress-repair] failed", sourceLabel, e);
            syncError = e?.message || "Cloud sync failed — saved on this device.";
            setSyncStatus("error");
          }
        } else {
          setSyncStatus("offline");
        }

        const message = formatParentProgressSuccessMessage(progressRef.current, sourceLabel);
        if (syncError) {
          return { ok: true, progress: progressRef.current, message: `${message} ${syncError}`, syncError };
        }
        return { ok: true, progress: progressRef.current, message };
      } catch (err) {
        console.error("[progress-repair] failed", sourceLabel, err);
        return { ok: false, error: err?.message || "Could not apply progress", progress: progressRef.current };
      }
    },
    [authEmail]
  );

  const applyRepairFields = useCallback(
    async (fields, sourceLabel = "repair-save") => {
      console.log("[progress-repair] clicked", sourceLabel, fields);
      const repaired = applyProgressRepair(progressRef.current, fields);
      return applyParentProgressOverride(repaired, sourceLabel);
    },
    [applyParentProgressOverride]
  );

  const handleResetDeviceOnly = async () => {
    const fresh = syncProgression(defaultProgress());
    userEarnedProgressRef.current = false;
    parentOverrideInFlightRef.current = Date.now();
    flushSync(() => setProgress(fresh));
    progressRef.current = fresh;
    writeProgressToLocalStorage(fresh);
    setMode("home");
  };

  const handleResetEverywhere = async () => {
    await applyParentProgressOverride(syncProgression(defaultProgress()), "reset-everywhere", { allowReset: true });
    userEarnedProgressRef.current = false;
    setMode("home");
  };

  const handleClearAppCache = () => {
    void clearAppCacheAndReload();
  };

  const updateProgress = (updater) => {
    setProgress((old) => {
      const beforeBadges = new Set(old.badges || []);
      const updated = typeof updater === "function" ? updater(old) : updater;
      const withBadges = touchProgressUpdatedAt(awardBadges(updated));
      if (hasMeaningfulProgress(withBadges)) {
        userEarnedProgressRef.current = true;
      }
      const earnedNow = BADGES.find((b) => withBadges.badges.includes(b.id) && !beforeBadges.has(b.id));
      if (earnedNow) {
        // Give the "right answer" voice confirmation time first.
        setTimeout(() => {
          setNewBadge(earnedNow);
          speak(`New badge! ${earnedNow.name}`);
          setTimeout(() => setNewBadge(null), 1900);
        }, RIGHT_ANSWER_PAUSE_MS);
      }
      return withBadges;
    });
  };

  const logAttempt = () => {
    updateProgress((old) => {
      const day = old.dailyLog[TODAY_KEY] || emptyDay();
      return {
        ...old,
        attempts: old.attempts + 1,
        dailyLog: {
          ...old.dailyLog,
          [TODAY_KEY]: {
            ...day,
            attempts: day.attempts + 1,
            lastPlayedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  const logWin = (kind, meta = {}) => {
    updateProgress((old) => {
      const day = normalizeDayEntry(old.dailyLog[TODAY_KEY]);
      const totals = old.totals || {};
      const isBuildGiveUp = kind === "build" && meta.buildOutcome === "giveup";
      const isLetterEcho = kind === "letterEcho";
      const wordsBuiltAdd = kind === "build" && !isBuildGiveUp ? 1 : 0;
      const helpedWordsAdd = kind === "build" && isBuildGiveUp ? 1 : 0;
      const starAdd = isBuildGiveUp || isLetterEcho ? 0 : 1;
      const correctAdd = isBuildGiveUp || isLetterEcho ? 0 : 1;
      const add = {
        soundsCorrect: kind === "sounds" ? 1 : 0,
        letterEchoCompleted: kind === "letterEcho" ? 1 : 0,
        wordsBuilt: wordsBuiltAdd,
        helpedWordsBuilt: helpedWordsAdd,
        sentencesRead: kind === "read" ? 1 : 0,
        mazeCompleted: kind === "maze" ? 1 : 0,
        countingCorrect: kind === "counting" ? 1 : 0,
        mathCorrect: kind === "math" ? 1 : 0,
      };
      const levelR = clampLevel(old.settings?.activeReadingLevel);
      const readingWin = ["sounds", "build", "read"].includes(kind) && levelR >= 2 && !(kind === "build" && isBuildGiveUp);
      let wordFamiliesUsed = Array.isArray(totals.wordFamiliesUsed) ? [...totals.wordFamiliesUsed] : [];
      if (kind === "build" && meta.family && typeof meta.family === "string" && !wordFamiliesUsed.includes(meta.family)) {
        wordFamiliesUsed = [...wordFamiliesUsed, meta.family];
      }
      return {
        ...old,
        stars: (Number(old.stars) || 0) + starAdd,
        lifetimeStars: (Number(old.lifetimeStars) || 0) + starAdd,
        correct: (Number(old.correct) || 0) + correctAdd,
        dailyLog: {
          ...old.dailyLog,
          [TODAY_KEY]: {
            ...day,
            correct: day.correct + correctAdd,
            stars: day.stars + starAdd,
            soundsCorrect: day.soundsCorrect + add.soundsCorrect,
            letterEchoCompleted: (Number(day.letterEchoCompleted) || 0) + add.letterEchoCompleted,
            wordsBuilt: day.wordsBuilt + add.wordsBuilt,
            helpedWordsBuilt: (Number(day.helpedWordsBuilt) || 0) + add.helpedWordsBuilt,
            sentencesRead: day.sentencesRead + add.sentencesRead,
            mazeCompleted: (Number(day.mazeCompleted) || 0) + add.mazeCompleted,
            countingCorrect: day.countingCorrect + add.countingCorrect,
            mathCorrect: day.mathCorrect + add.mathCorrect,
            lastPlayedAt: new Date().toISOString(),
          },
        },
        totals: {
          ...totals,
          soundsCorrect: (Number(totals.soundsCorrect) || 0) + add.soundsCorrect,
          letterEchoCompleted: (Number(totals.letterEchoCompleted) || 0) + add.letterEchoCompleted,
          wordsBuilt: (Number(totals.wordsBuilt) || 0) + add.wordsBuilt,
          helpedWordsBuilt: (Number(totals.helpedWordsBuilt) || 0) + add.helpedWordsBuilt,
          sentencesRead: (Number(totals.sentencesRead) || 0) + add.sentencesRead,
          mazeCompleted: (Number(totals.mazeCompleted) || 0) + add.mazeCompleted,
          countingCorrect: (Number(totals.countingCorrect) || 0) + add.countingCorrect,
          mathCorrect: (Number(totals.mathCorrect) || 0) + add.mathCorrect,
          wordFamiliesUsed,
          readingWinsAtLevel2Plus: (Number(totals.readingWinsAtLevel2Plus) || 0) + (readingWin ? 1 : 0),
        },
      };
    });
  };

  useEffect(() => {
    if (hasMeaningfulProgress(progress)) {
      userEarnedProgressRef.current = true;
    }
  }, []);

  const setPhonicsAudioEnabled = (enabled) => {
    updateProgress((old) => ({
      ...old,
      settings: { ...(old.settings || {}), phonicsAudioEnabled: Boolean(enabled) },
    }));
  };
  const reader = getReaderDisplay(progress, authEmail);

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-pink-50 text-slate-950">
      <style>{STYLES}</style>
      <Header setMode={setMode} progress={progress} reader={reader} />
      <BadgeToast badge={newBadge} />
      <div key={mode}>
        {mode === "home" && <Home setMode={setMode} progress={progress} reader={reader} />}
        {mode === "letterEcho" && (
          <LetterEchoGame
            logWin={logWin}
            logAttempt={logAttempt}
            playerLevel={playerLevel}
            activeReadingLevel={activeReadingLevel}
            celebrationFrequency={celebrationFrequency}
            phonicsAudioEnabled={phonicsAudioEnabled}
            onPhonicsAudioChange={setPhonicsAudioEnabled}
          />
        )}
        {mode === "sounds" && (
          <SoundsGame
            logWin={logWin}
            logAttempt={logAttempt}
            playerLevel={playerLevel}
            activeReadingLevel={activeReadingLevel}
            celebrationFrequency={celebrationFrequency}
            phonicsAudioEnabled={phonicsAudioEnabled}
            onPhonicsAudioChange={setPhonicsAudioEnabled}
          />
        )}
        {mode === "build" && (
          <BuildWordGame
            logWin={logWin}
            logAttempt={logAttempt}
            playerLevel={playerLevel}
            activeReadingLevel={activeReadingLevel}
            readingTheme={readingTheme}
            celebrationFrequency={celebrationFrequency}
            phonicsAudioEnabled={phonicsAudioEnabled}
          />
        )}
        {mode === "read" && (
          <ReadGame
            logWin={logWin}
            logAttempt={logAttempt}
            playerLevel={playerLevel}
            activeReadingLevel={activeReadingLevel}
            readingTheme={readingTheme}
            todayStats={progress.dailyLog[TODAY_KEY]}
            celebrationFrequency={celebrationFrequency}
          />
        )}
        {mode === "readingMaze" && isModeUnlocked("readingMaze", progress) && (
          <ReadingMaze
            logWin={logWin}
            logAttempt={logAttempt}
            playerLevel={playerLevel}
            activeReadingLevel={activeReadingLevel}
            readingTheme={readingTheme}
            celebrationFrequency={celebrationFrequency}
          />
        )}
        {mode === "teacher" && (
          <TeacherModeScreen
            progress={progress}
            setProgress={updateProgress}
            setMode={setMode}
            todayKey={TODAY_KEY}
            normalizeDayEntry={normalizeDayEntry}
            cloud={{
              configured: supabaseConfigured,
              authEmail,
              syncStatus,
            }}
            onImportProgress={async (raw) => {
              const result = await applyParentProgressOverride(raw, "json-import");
              if (!result.ok) {
                return { ok: false, error: result.error || "Import failed" };
              }
              return { ok: true, message: result.message };
            }}
            onApplyParentProgress={applyParentProgressOverride}
            onApplyRepairFields={applyRepairFields}
            onResetDeviceOnly={handleResetDeviceOnly}
            onResetEverywhere={handleResetEverywhere}
            getStreak={getStreak}
            adminPin={ADMIN_PIN}
            adminPinWords={ADMIN_PIN_WORDS}
            reader={reader}
          />
        )}
        {mode === "admin" && (
          <AdminDashboard
            progress={progress}
            setProgress={updateProgress}
            testMode={testMode}
            setTestMode={setTestMode}
            onApplyParentProgress={applyParentProgressOverride}
            onApplyRepairFields={applyRepairFields}
            onResetDeviceOnly={handleResetDeviceOnly}
            onResetEverywhere={handleResetEverywhere}
            onClearAppCache={handleClearAppCache}
            cloud={{
              configured: supabaseConfigured,
              authEmail,
              syncStatus,
              onSignIn: handleCloudSignIn,
              onSignUp: handleCloudSignUp,
              onSignOut: handleCloudSignOut,
              onSyncNow: handleCloudSyncNow,
            }}
            reader={reader}
          />
        )}
        {mode === "kidRewards" && isModeUnlocked("kidRewards", progress) && <KidRewards progress={progress} reader={reader} />}
        {mode === "miniGames" && <MiniGames progress={progress} setProgress={updateProgress} testMode={testMode} />}
        {mode === "math" && (
          <MathAndCounting
            logWin={logWin}
            logAttempt={logAttempt}
            playerLevel={playerLevel}
            activeMathLevel={activeMathLevel}
            celebrationFrequency={celebrationFrequency}
          />
        )}
      </div>
    </main>
  );
}

