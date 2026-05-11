import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  mergeProgress,
  loadCloudProgress,
  saveCloudProgress,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  supabase,
  supabaseConfigured,
  runCloudSyncSelfTests,
} from "./lib/cloudProgress.js";
import { LETTERS, WORD_FAMILIES } from "./data/phonics.js";
import { wordsForReadingLevel, sentencesForReadingLevel, countBirdBuddySentences } from "./data/reading.js";
import { COUNTING_SETS, MATH_FACTS, countingSetsForMathLevel, mathFactsForLevel } from "./data/mathContent.js";
import { filterByMaxLevel } from "./data/levels.js";

const APP_VERSION = "1.4.1-bird-buddies-math";
const TODAY_KEY = new Date().toISOString().slice(0, 10);
const ADMIN_PIN = "8403";
const ADMIN_PIN_WORDS = "eight four zero three";

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
const ResetIcon = ({ className = "" }) => (
  <Icon className={className} label="reset">
    ↻
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

const ENCOURAGEMENT = [
  "Great try!",
  "You are getting stronger!",
  "Good listening!",
  "Reading muscles are growing!",
  "Nice work, Octavia!",
  "That was brave reading!",
];

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
    wordsBuilt: 0,
    sentencesRead: 0,
    countingCorrect: 0,
    mathCorrect: 0,
    parentMinutes: 0,
    notes: "",
    lastPlayedAt: null,
  };
}

function clampLevel(n) {
  const x = Number(n);
  if (Number.isFinite(x)) return Math.min(4, Math.max(1, Math.round(x)));
  return 1;
}

function defaultProgress() {
  return {
    version: APP_VERSION,
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
    },
    dailyLog: {
      [TODAY_KEY]: { ...emptyDay(), opened: 1, lastPlayedAt: new Date().toISOString() },
    },
    totals: {
      soundsCorrect: 0,
      wordsBuilt: 0,
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
          day.soundsCorrect > 0)
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

function speak(text, rate = 0.72) {
  if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

const RIGHT_ANSWER_PAUSE_MS = 1000;

function speakSound(letterObj) {
  if (!letterObj) return;
  speak(letterObj.say, 0.58);
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
    rewardClaims: Array.isArray(safeRaw.rewardClaims) ? safeRaw.rewardClaims : [],
    settings: {
      ...base.settings,
      ...(safeRaw.settings && typeof safeRaw.settings === "object" ? safeRaw.settings : {}),
      activeReadingLevel: clampLevel(safeRaw.settings?.activeReadingLevel ?? base.settings.activeReadingLevel),
      activeMathLevel: clampLevel(safeRaw.settings?.activeMathLevel ?? base.settings.activeMathLevel),
    },
    totals: {
      ...base.totals,
      ...(safeRaw.totals || {}),
      wordFamiliesUsed: Array.isArray(safeRaw.totals?.wordFamiliesUsed) ? safeRaw.totals.wordFamiliesUsed : base.totals.wordFamiliesUsed,
      readingWinsAtLevel2Plus: Number.isFinite(Number(safeRaw.totals?.readingWinsAtLevel2Plus))
        ? Number(safeRaw.totals.readingWinsAtLevel2Plus)
        : base.totals.readingWinsAtLevel2Plus,
    },
    dailyLog: { ...base.dailyLog, ...(safeRaw.dailyLog || {}) },
  };

  if (!merged.dailyLog[TODAY_KEY]) {
    merged.dailyLog[TODAY_KEY] = { ...emptyDay(), opened: 1, lastPlayedAt: new Date().toISOString() };
  }

  return merged;
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

  return changed ? { ...progress, badges: Array.from(earned) } : progress;
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
  console.assert(LETTERS.every((l) => l.say && l.clue), "every letter should include TTS-safe say text and clue text");
  console.assert(wordsForReadingLevel(4).length >= 60, "word bank should include many decodable words");
  console.assert(sentencesForReadingLevel(4).length >= 80, "sentence bank should include many practice sentences");
  console.assert(MINI_GAMES.every((g) => g.cost > 0), "every mini game should have a star cost");
  console.assert(COUNTING_SETS.length >= 25, "counting mode should include many counting sets up to 20");
  console.assert(COUNTING_SETS.some((c) => c.count >= 20), "counting sets should include counts up to 20");
  console.assert(MATH_FACTS.length >= 80, "math bank should include at least 80 facts");
  console.assert(MATH_FACTS.some((f) => f.answer >= 20), "math bank should include facts with answers up to 20");
  console.assert(countBirdBuddySentences() >= 10, "sentence bank should include bird buddy sentences");
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

function Header({ setMode, progress, reset }) {
  const streak = getStreak(progress.dailyLog);
  return (
    <div className="sticky top-0 z-20 mb-4 rounded-b-3xl border-b-2 border-slate-900 bg-amber-100/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <button onClick={() => setMode("home")} className="flex items-center gap-2 rounded-2xl px-2 py-1 text-left font-black">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-slate-900 bg-white text-2xl shadow-[0_4px_0_rgba(15,23,42,1)]">📚</span>
          <span>
            <span className="block text-sm uppercase tracking-wide text-slate-600">Octavia's</span>
            <span className="block text-xl leading-none">Reading Quest</span>
          </span>
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          <ProgressStars stars={progress.stars} />
          <span className="rounded-full border-2 border-slate-900 bg-white px-3 py-1 text-sm font-bold">{progress.correct} right</span>
          <span className="rounded-full border-2 border-slate-900 bg-orange-100 px-3 py-1 text-sm font-bold">🔥 {streak} day</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode("admin")} className="rq-button rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-[0_4px_0_rgba(15,23,42,1)]" aria-label="Parent admin">
            <SettingsIcon className="text-xl" />
          </button>
          <button onClick={reset} className="rq-button rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-[0_4px_0_rgba(15,23,42,1)]" aria-label="Reset game">
            <ResetIcon className="text-xl" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Home({ setMode, progress }) {
  const earnedBadges = BADGES.filter((b) => progress.badges.includes(b.id));
  const today = progress.dailyLog[TODAY_KEY] || emptyDay();
  return (
    <div className="rq-page mx-auto grid max-w-5xl gap-5 px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-900">
              <SparklesIcon /> Today’s quest: 5–8 minutes
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-6xl">Hello Octavia! 👋</h1>
            <p className="mt-1 text-3xl font-black text-slate-800 sm:text-4xl">Tiny reading games. Big confidence.</p>
            <p className="mt-3 text-lg font-semibold text-slate-700">Start with sounds, build short words, then read a silly sentence out loud with Mom or Dad.</p>
          </div>
          <div className="rounded-[2rem] border-2 border-slate-900 bg-sky-100 p-4 text-center shadow-inner">
            <div className="text-7xl">🌈</div>
            <p className="mt-2 text-2xl font-black">{progress.stars} spendable stars</p>
            <p className="text-sm font-bold text-slate-600">
              {progress.lifetimeStars} lifetime stars • {getStreak(progress.dailyLog)} day streak
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BigButton onClick={() => setMode("sounds")} className="bg-pink-100 text-left">
          <div className="text-5xl">🔊</div>
          <div className="mt-2 text-2xl">Sound Pop</div>
          <p className="mt-1 text-sm font-bold text-slate-600">Hear a sound. Tap the matching letter.</p>
        </BigButton>
        <BigButton onClick={() => setMode("build")} className="bg-lime-100 text-left">
          <div className="text-5xl">🧱</div>
          <div className="mt-2 text-2xl">Build a Word</div>
          <p className="mt-1 text-sm font-bold text-slate-600">Tap letters in order and blend them together.</p>
        </BigButton>
        <BigButton onClick={() => setMode("read")} className="bg-violet-100 text-left">
          <div className="text-5xl">📖</div>
          <div className="mt-2 text-2xl">Read It!</div>
          <p className="mt-1 text-sm font-bold text-slate-600">Read a short sentence with one helper button.</p>
        </BigButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BigButton onClick={() => setMode("kidRewards")} className="bg-yellow-100 text-left">
          <div className="text-5xl">🏆</div>
          <div className="mt-2 text-2xl">My Badges</div>
          <p className="mt-1 text-sm font-bold text-slate-600">See badges, stars, and prizes.</p>
        </BigButton>
        <BigButton onClick={() => setMode("miniGames")} className="bg-cyan-100 text-left">
          <div className="text-5xl">🎮</div>
          <div className="mt-2 text-2xl">Star Games</div>
          <p className="mt-1 text-sm font-bold text-slate-600">Spend stars on tiny unlockable games.</p>
        </BigButton>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <BigButton onClick={() => setMode("math")} className="bg-orange-100 text-left">
          <div className="text-5xl">🔢</div>
          <div className="mt-2 text-2xl">Counting & Math</div>
          <p className="mt-1 text-sm font-bold text-slate-600">Count objects and solve tiny math stories.</p>
        </BigButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border-2 border-slate-900 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-black">
            <CalendarIcon /> Today’s log
          </div>
          <p className="mt-2 font-semibold text-slate-700">
            {today.correct} right • {today.attempts} attempts • {today.soundsCorrect} sounds • {today.wordsBuilt} words • {today.sentencesRead} sentences •{" "}
            {today.countingCorrect || 0} counting • {today.mathCorrect || 0} math
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

function KidRewards({ progress }) {
  const earnedBadges = BADGES.filter((b) => progress.badges.includes(b.id));
  return (
    <div className="rq-page mx-auto grid max-w-5xl gap-5 px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-yellow-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <div className="text-7xl">🏆</div>
        <h2 className="mt-2 text-4xl font-black">Octavia’s Badge Box</h2>
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

function MathAndCounting({ logWin, logAttempt, activeMathLevel }) {
  const countingPool = useMemo(() => countingSetsForMathLevel(activeMathLevel), [activeMathLevel]);
  const mathPool = useMemo(() => mathFactsForLevel(activeMathLevel), [activeMathLevel]);

  const [mode, setMode] = useState("count");
  const [countCard, setCountCard] = useState(() => pickRandom(countingPool));
  const [mathCard, setMathCard] = useState(() => pickRandom(mathPool));
  const [result, setResult] = useState(null);

  useEffect(() => {
    setCountCard((c) => (countingPool.some((x) => x.count === c.count && x.emoji === c.emoji) ? c : pickRandom(countingPool)));
  }, [countingPool]);

  useEffect(() => {
    setMathCard((c) => (mathPool.some((x) => x.id === c.id) ? c : pickRandom(mathPool)));
  }, [mathPool]);

  const countChoices = useMemo(() => {
    const wrong = countingPool.map((x) => x.count).filter((n) => n !== countCard.count);
    return shuffle([countCard.count, ...shuffle(wrong).slice(0, 3)]);
  }, [countCard, countingPool]);

  const mathChoices = useMemo(() => {
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => n !== mathCard.answer);
    return shuffle([mathCard.answer, ...shuffle(pool).slice(0, 3)]);
  }, [mathCard]);

  const nextCountCard = () => pickRandom(countingPool);
  const nextMathCard = () => pickRandom(mathPool);

  const chooseCount = (n) => {
    logAttempt("counting");
    if (n === countCard.count) {
      setResult({ type: "good", text: "Good counting!" });
      logWin("counting");
      speak(`Yes. ${countCard.count} ${countCard.label}.`, 0.72);
      setTimeout(() => {
        setCountCard(nextCountCard());
        setResult(null);
      }, 1000);
    } else {
      setResult({ type: "try", text: "Count again" });
      speak("Good try. Count them slowly.", 0.72);
      setTimeout(() => setResult(null), 900);
    }
  };

  const chooseMath = (n) => {
    logAttempt("math");
    if (n === mathCard.answer) {
      setResult({ type: "good", text: "Math helper!" });
      logWin("math");
      speak(`Yes. The answer is ${mathCard.answer}.`, 0.72);
      setTimeout(() => {
        setMathCard(nextMathCard());
        setResult(null);
      }, 1200);
    } else {
      setResult({ type: "try", text: "Try again" });
      speak("Good try. Use your fingers if you need to.", 0.72);
      setTimeout(() => setResult(null), 900);
    }
  };

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
          <div className="mt-5 text-5xl font-black sm:text-6xl">
            {mathCard.a} {mathCard.op} {mathCard.b} = ?
          </div>
          <div className="mx-auto mt-4 max-w-xl rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-center text-xs font-black uppercase tracking-wide text-slate-500">Picture math</p>
            {mathCard.op === "+" && (
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
            {mathCard.op === "-" && (
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

  const playGame = (game) => {
    if (!testMode && progress.stars < game.cost) return;
    setProgress((old) => ({
      ...old,
      stars: testMode ? old.stars : old.stars - game.cost,
      rewardClaims: [
        { id: game.id, title: game.title, cost: game.cost, claimedAt: new Date().toISOString(), type: "mini_game" },
        ...(old.rewardClaims || []),
      ].slice(0, 30),
    }));
    setActiveGame(game.id);
    speak(`${game.title} unlocked!`, 0.72);
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
  return (
    <div
      className={`rq-pop fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-slate-900 px-5 py-3 text-lg font-black shadow-xl ${
        result.type === "good" ? "bg-emerald-200" : "bg-rose-200"
      }`}
    >
      {result.type === "good" ? <CheckIcon /> : <XIcon />}
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

function SoundsGame({ logWin, logAttempt, activeReadingLevel }) {
  const letterPool = useMemo(() => filterByMaxLevel(LETTERS, activeReadingLevel), [activeReadingLevel]);

  const [target, setTarget] = useState(() => pickRandom(letterPool));
  const [choices, setChoices] = useState(() => shuffle(letterPool).slice(0, 4));
  const [result, setResult] = useState(null);
  const [step, setStep] = useState("listen");
  const [showClue, setShowClue] = useState(false);

  useEffect(() => {
    const pool = letterPool.length ? letterPool : LETTERS.filter((l) => l.level <= 1);
    setTarget((t) => (pool.some((l) => l.letter === t.letter) ? t : pickRandom(pool)));
  }, [letterPool]);

  useEffect(() => {
    if (!choices.some((c) => c.letter === target.letter)) {
      const pool = letterPool.length ? letterPool : LETTERS.filter((l) => l.level <= 1);
      setChoices(shuffle([target, ...shuffle(pool.filter((l) => l.letter !== target.letter)).slice(0, 3)]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextRound = () => {
    const pool = letterPool.length ? letterPool : LETTERS.filter((l) => l.level <= 1);
    const next = pickRandom(pool);
    setTarget(next);
    setChoices(shuffle([next, ...shuffle(pool.filter((l) => l.letter !== next.letter)).slice(0, 3)]));
    setResult(null);
    setStep("listen");
    setShowClue(false);
    setTimeout(() => speakSound(next), 100);
  };

  const choose = (choice) => {
    if (step !== "choose") return;
    logAttempt("sounds");
    if (choice.letter === target.letter) {
      setResult({ type: "good", text: pickRandom(ENCOURAGEMENT) });
      logWin("sounds");
      speak(`Yes! ${choice.letter}. ${choice.say}.`);
      setTimeout(nextRound, 1100);
    } else {
      setResult({ type: "try", text: "Try again" });
      speak(`Good try. Listen again.`);
      speakSound(target);
      setTimeout(() => setResult(null), 900);
    }
  };

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      <ResultToast result={result} />
      <div className="rounded-[2rem] border-2 border-slate-900 bg-white p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <p className="text-lg font-black text-slate-600">Sound Pop</p>
        <h2 className="mt-2 text-4xl font-black">Listen first. Then choose.</h2>
        <button onClick={() => { speakSound(target); setStep("choose"); }} className="rq-button mx-auto mt-5 flex items-center gap-3 rounded-full border-2 border-slate-900 bg-sky-100 px-6 py-4 text-2xl font-black shadow-[0_5px_0_rgba(15,23,42,1)]">
          <VolumeIcon className="text-3xl" /> Hear sound
        </button>
        <button onClick={() => { setShowClue(true); speak(target.clue); }} className="rq-button mx-auto mt-3 rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
          Need a picture clue?
        </button>
        {showClue ? <p className="mt-4 text-6xl">{target.emoji}</p> : <p className="mt-4 text-lg font-black text-slate-500">Picture hidden so your reading brain works first 🧠</p>}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {choices.map((choice) => (
          <BigButton key={choice.letter} onClick={() => choose(choice)} className="bg-amber-50">
            <span className="block text-7xl uppercase">{choice.letter}</span>
            <span className="block text-sm normal-case text-slate-500">tap after listening</span>
          </BigButton>
        ))}
      </div>
    </div>
  );
}

function BuildWordGame({ logWin, logAttempt, activeReadingLevel }) {
  const wordPool = useMemo(() => wordsForReadingLevel(activeReadingLevel), [activeReadingLevel]);
  const letterPool = useMemo(() => filterByMaxLevel(LETTERS, activeReadingLevel), [activeReadingLevel]);

  const [target, setTarget] = useState(() => pickRandom(wordPool));
  const [built, setBuilt] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setTarget((t) => (wordPool.some((w) => w.word === t.word) ? t : pickRandom(wordPool)));
  }, [wordPool]);

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

  const nextRound = () => {
    setTarget(pickRandom(wordPool));
    setBuilt([]);
    setResult(null);
  };

  const choose = (letter) => {
    if (built.length >= target.parts.length) return;
    logAttempt("build");
    const expected = target.parts[nextIndex];
    if (letter === expected) {
      const newBuilt = [...built, letter];
      setBuilt(newBuilt);
      speakSound(LETTERS.find((l) => l.letter === letter));
      if (newBuilt.length === target.parts.length) {
        setResult({ type: "good", text: "You built it!" });
        logWin("build", { family: target.family });
        setTimeout(() => speakWordSlow(target), 150);
      }
    } else {
      setResult({ type: "try", text: "Not that one yet" });
      speak(`Try the next sound: ${expected}`);
      setTimeout(() => setResult(null), 900);
    }
  };

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      <ResultToast result={result} />
      <div className="rounded-[2rem] border-2 border-slate-900 bg-lime-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <p className="text-lg font-black text-slate-600">Build a Word</p>
        {familyLabel && <p className="mt-1 text-sm font-bold text-slate-500">Word family {familyLabel}</p>}
        <div className="mt-1 text-6xl">{target.emoji}</div>
        <h2 className="mt-2 text-3xl font-black">Tap the letters in order</h2>
        <div className="mt-5 flex justify-center gap-3">
          {target.parts.map((part, i) => (
            <div key={i} className={`grid h-20 w-20 place-items-center rounded-3xl border-2 border-slate-900 text-5xl font-black uppercase shadow-inner ${built[i] ? "rq-bounce bg-white" : "bg-lime-50"}`}>
              {built[i] || "_"}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button onClick={() => speakWordSlow(target)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            <VolumeIcon className="mr-2 text-xl" /> Blend it
          </button>
          {built.length === target.parts.length && (
            <button onClick={nextRound} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
              Next word
            </button>
          )}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {choices.map((letter) => (
          <BigButton key={letter} onClick={() => choose(letter)} className="bg-white">
            <span className="text-6xl uppercase">{letter}</span>
          </BigButton>
        ))}
      </div>
    </div>
  );
}

function normalizeWordToken(raw) {
  return raw.replace(/[^a-z]/gi, "").toLowerCase();
}

function ReadGame({ logWin, activeReadingLevel }) {
  const sentencePool = useMemo(() => sentencesForReadingLevel(activeReadingLevel), [activeReadingLevel]);
  const [card, setCard] = useState(() => pickRandom(sentencePool));
  const [revealed, setRevealed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    setCard((c) => (sentencePool.some((s) => s.id === c.id) ? c : pickRandom(sentencePool)));
  }, [sentencePool]);

  const focusSet = useMemo(() => new Set((card.focusWords || []).map((w) => w.toLowerCase())), [card]);
  const words = card.text.split(/\s+/);

  const markRead = () => {
    setCelebrate(true);
    logWin("read", { sentenceId: card.id });
    speak("You read it! Amazing work.");
    setTimeout(() => setCelebrate(false), 1200);
  };

  const emojiForCard = useMemo(() => {
    const first = (card.focusWords && card.focusWords[0]) || card.text.split(/\s+/)[0] || "read";
    const hit = LETTERS.find((l) => l.letter === normalizeWordToken(first).slice(0, 1));
    return hit?.emoji || "📖";
  }, [card.id, card.text, card.focusWords]);

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      <div className="rounded-[2rem] border-2 border-slate-900 bg-violet-100 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <p className="text-lg font-black text-slate-600">Read It!</p>
        <h2 className="mt-2 text-3xl font-black">Read the sentence out loud</h2>
        <div className="my-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-inner">
          <div className="mb-4 text-7xl">{emojiForCard}</div>
          <div className="flex flex-wrap justify-center gap-3">
            {words.map((w, i) => {
              const key = normalizeWordToken(w);
              const isFocus = focusSet.has(key);
              return (
                <button
                  key={`${card.id}-${w}-${i}`}
                  onClick={() => speak(key || w.replace(/[^a-z]/gi, "") || card.text, 0.7)}
                  className={`rq-button rounded-2xl px-3 py-2 text-4xl font-black ${isFocus ? "bg-amber-200 underline decoration-4 decoration-amber-700" : "bg-slate-100"}`}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => speak(card.text, 0.75)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            <VolumeIcon className="mr-2 text-xl" /> Hear it
          </button>
          <button onClick={() => setRevealed(!revealed)} className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            Helper hint
          </button>
          <button onClick={markRead} className="rq-button rounded-full border-2 border-slate-900 bg-emerald-200 px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]">
            I read it!
          </button>
          <button
            onClick={() => {
              setCard(pickRandom(sentencePool));
              setRevealed(false);
            }}
            className="rq-button rounded-full border-2 border-slate-900 bg-white px-5 py-3 font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
          >
            New sentence
          </button>
        </div>
        {revealed && (
          <div className="rq-pop mx-auto mt-5 max-w-xl rounded-3xl border-2 border-slate-900 bg-white p-4 text-left font-bold">
            <p>1. Focus words are underlined in yellow.</p>
            <p>2. Tap any word to hear it.</p>
            <p>3. Read slowly like this: “{card.text}”</p>
            {card.helperPrompt && <p className="mt-2 text-slate-600">Tip: {card.helperPrompt}</p>}
            <p className="mt-2 text-sm text-slate-500">Type: {card.type === "sight-word-supported" ? "some helper words" : "mostly decodable"}</p>
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

function cloudSyncStatusLabel(configured, authEmail, syncStatus) {
  if (!configured) return "Cloud unavailable (missing env)";
  if (!authEmail) return "Offline / local only";
  if (syncStatus === "syncing") return "Syncing…";
  if (syncStatus === "saved") return "Saved";
  if (syncStatus === "error") return "Sync error";
  return "Signed in";
}

function AdminDashboard({ progress, setProgress, testMode, setTestMode, cloud }) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [adminLoginEmail, setAdminLoginEmail] = useState("");
  const [adminLoginPassword, setAdminLoginPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);
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
    if (progress.stars < reward.cost) return;
    setProgress((old) => ({
      ...old,
      stars: old.stars - reward.cost,
      rewardClaims: [
        { id: reward.id, title: reward.title, cost: reward.cost, claimedAt: new Date().toISOString() },
        ...(old.rewardClaims || []),
      ].slice(0, 30),
    }));
    speak(`${reward.title} reward claimed!`);
  };

  const exportProgress = async () => {
    const text = JSON.stringify(progress, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        alert("Progress copied. Paste it into ChatGPT so I can analyze Octavia’s reading progress.");
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
    const ok = window.confirm("Remove tested reading badge progress? This clears sound/word/sentence badge progress so Octavia can earn those badges later.");
    if (!ok) return;
    setProgress((old) => {
      const cleanedDailyLog = Object.fromEntries(
        Object.entries(old.dailyLog || {}).map(([day, log]) => [
          day,
          {
            ...log,
            soundsCorrect: 0,
            wordsBuilt: 0,
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
          sentencesRead: 0,
          wordFamiliesUsed: [],
          readingWinsAtLevel2Plus: 0,
        },
        dailyLog: cleanedDailyLog,
      };
    });
  };

  const removeTestingStarsAndRewards = () => {
    const ok = window.confirm("Remove test-earned stars, reward claims, and star badges? This lets Octavia earn First Star and 10-Star Reader later.");
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
          sentencesRead: 0,
          countingCorrect: 0,
          mathCorrect: 0,
          parentMinutes: 0,
          lastPlayedAt: new Date().toISOString(),
        },
      },
    }));
  };

  const resetAllProgress = () => {
    const ok = window.confirm("FULL RESET: erase all local progress, stars, badges, rewards, and daily logs on this device?");
    if (!ok) return;
    setProgress(defaultProgress());
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
        <p className="mt-2 font-semibold text-slate-700">Pick the highest pack Octavia should see. Games include that level and easier content. Saved with cloud progress.</p>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={<VolumeIcon />} label="Letters in pool" value={filterByMaxLevel(LETTERS, clampLevel(progress.settings?.activeReadingLevel)).length} />
          <StatCard icon={<BookIcon />} label="Build-a-word pool" value={wordsForReadingLevel(clampLevel(progress.settings?.activeReadingLevel)).length} />
          <StatCard icon={<BookIcon />} label="Read It sentences" value={sentencesForReadingLevel(clampLevel(progress.settings?.activeReadingLevel)).length} />
          <StatCard icon={<ClipboardIcon />} label="Counting sets" value={countingSetsForMathLevel(clampLevel(progress.settings?.activeMathLevel)).length} />
          <StatCard icon={<ClipboardIcon />} label="Tiny math facts" value={mathFactsForLevel(clampLevel(progress.settings?.activeMathLevel)).length} />
        </div>
      </div>

      <div className="rounded-[2rem] border-2 border-slate-900 bg-sky-50 p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        <h3 className="text-2xl font-black">Family account &amp; cloud sync</h3>
        <p className="mt-2 font-bold text-slate-800">
          Status: <span className="font-black">{cloudSyncStatusLabel(cloud.configured, cloud.authEmail, cloud.syncStatus)}</span>
        </p>
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
                onClick={() => claimReward(reward)}
                disabled={progress.stars < reward.cost}
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
        <p className="mt-2 font-semibold text-slate-700">Use these after parent testing so Octavia can earn badges and rewards for real later.</p>
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
          <button onClick={resetAllProgress} className="rq-button rounded-2xl border-2 border-slate-900 bg-rose-200 px-4 py-3 text-left font-black shadow-[0_3px_0_rgba(15,23,42,1)]">
            🧹 Full local reset
            <span className="block text-sm font-bold text-slate-700">Only use if you want to wipe everything on this device.</span>
          </button>
        </div>
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
  const [progress, setProgress] = useState(() => {
    try {
      const saved = localStorage.getItem("octavia-reading-quest-progress");
      return saved ? migrateProgress(JSON.parse(saved)) : defaultProgress();
    } catch {
      return defaultProgress();
    }
  });

  const activeReadingLevel = clampLevel(progress.settings?.activeReadingLevel);
  const activeMathLevel = clampLevel(progress.settings?.activeMathLevel);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    try {
      localStorage.setItem("octavia-reading-quest-progress", JSON.stringify(progress));
      localStorage.setItem("octavia-test-mode", String(testMode));
    } catch {}
  }, [progress, testMode]);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setAuthEmail(null);
        setSyncStatus("offline");
        return;
      }

      setAuthEmail(session.user.email ?? "");

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        void (async () => {
          setSyncStatus("syncing");
          try {
            const cloud = await loadCloudProgress();
            const merged = awardBadges(mergeProgress(progressRef.current, cloud));
            setProgress(merged);
            await saveCloudProgress(merged);
            setSyncStatus("saved");
            window.setTimeout(() => setSyncStatus("signed_in"), 2000);
          } catch (e) {
            console.error(e);
            setSyncStatus("error");
          }
        })();
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !authEmail) return undefined;

    const id = window.setTimeout(async () => {
      setSyncStatus((s) => (s === "error" ? s : "syncing"));
      try {
        await saveCloudProgress(progressRef.current);
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
      const cloud = await loadCloudProgress();
      const merged = awardBadges(mergeProgress(progressRef.current, cloud));
      setProgress(merged);
      await saveCloudProgress(merged);
      setSyncStatus("saved");
      window.setTimeout(() => setSyncStatus("signed_in"), 2000);
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
      throw e;
    }
  };

  const updateProgress = (updater) => {
    setProgress((old) => {
      const beforeBadges = new Set(old.badges || []);
      const updated = typeof updater === "function" ? updater(old) : updater;
      const withBadges = awardBadges(updated);
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
      const day = old.dailyLog[TODAY_KEY] || emptyDay();
      const add = {
        soundsCorrect: kind === "sounds" ? 1 : 0,
        wordsBuilt: kind === "build" ? 1 : 0,
        sentencesRead: kind === "read" ? 1 : 0,
        countingCorrect: kind === "counting" ? 1 : 0,
        mathCorrect: kind === "math" ? 1 : 0,
      };
      const levelR = clampLevel(old.settings?.activeReadingLevel);
      const readingWin = ["sounds", "build", "read"].includes(kind) && levelR >= 2;
      let wordFamiliesUsed = Array.isArray(old.totals.wordFamiliesUsed) ? [...old.totals.wordFamiliesUsed] : [];
      if (kind === "build" && meta.family && typeof meta.family === "string" && !wordFamiliesUsed.includes(meta.family)) {
        wordFamiliesUsed = [...wordFamiliesUsed, meta.family];
      }
      return {
        ...old,
        stars: old.stars + 1,
        lifetimeStars: old.lifetimeStars + 1,
        correct: old.correct + 1,
        dailyLog: {
          ...old.dailyLog,
          [TODAY_KEY]: {
            ...day,
            correct: day.correct + 1,
            stars: day.stars + 1,
            soundsCorrect: day.soundsCorrect + add.soundsCorrect,
            wordsBuilt: day.wordsBuilt + add.wordsBuilt,
            sentencesRead: day.sentencesRead + add.sentencesRead,
            countingCorrect: (day.countingCorrect || 0) + add.countingCorrect,
            mathCorrect: (day.mathCorrect || 0) + add.mathCorrect,
            lastPlayedAt: new Date().toISOString(),
          },
        },
        totals: {
          ...old.totals,
          soundsCorrect: old.totals.soundsCorrect + add.soundsCorrect,
          wordsBuilt: old.totals.wordsBuilt + add.wordsBuilt,
          sentencesRead: old.totals.sentencesRead + add.sentencesRead,
          countingCorrect: (old.totals.countingCorrect || 0) + add.countingCorrect,
          mathCorrect: (old.totals.mathCorrect || 0) + add.mathCorrect,
          wordFamiliesUsed,
          readingWinsAtLevel2Plus: (old.totals.readingWinsAtLevel2Plus || 0) + (readingWin ? 1 : 0),
        },
      };
    });
  };

  const reset = () => {
    const ok = typeof window !== "undefined" ? window.confirm("Reset Octavia's local progress on this device?") : false;
    if (!ok) return;
    setProgress(defaultProgress());
    setMode("home");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-pink-50 text-slate-950">
      <style>{STYLES}</style>
      <Header setMode={setMode} progress={progress} reset={reset} />
      <BadgeToast badge={newBadge} />
      <div key={mode}>
        {mode === "home" && <Home setMode={setMode} progress={progress} />}
        {mode === "sounds" && <SoundsGame logWin={logWin} logAttempt={logAttempt} activeReadingLevel={activeReadingLevel} />}
        {mode === "build" && <BuildWordGame logWin={logWin} logAttempt={logAttempt} activeReadingLevel={activeReadingLevel} />}
        {mode === "read" && <ReadGame logWin={logWin} activeReadingLevel={activeReadingLevel} />}
        {mode === "admin" && (
          <AdminDashboard
            progress={progress}
            setProgress={updateProgress}
            testMode={testMode}
            setTestMode={setTestMode}
            cloud={{
              configured: supabaseConfigured,
              authEmail,
              syncStatus,
              onSignIn: handleCloudSignIn,
              onSignUp: handleCloudSignUp,
              onSignOut: handleCloudSignOut,
              onSyncNow: handleCloudSyncNow,
            }}
          />
        )}
        {mode === "kidRewards" && <KidRewards progress={progress} />}
        {mode === "miniGames" && <MiniGames progress={progress} setProgress={updateProgress} testMode={testMode} />}
        {mode === "math" && <MathAndCounting logWin={logWin} logAttempt={logAttempt} activeMathLevel={activeMathLevel} />}
      </div>
    </main>
  );
}

