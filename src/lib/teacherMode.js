/**
 * Parent/Teacher companion: recommendations and difficulty overrides for Summer.
 */

export const TEACHER_FOCUS_OPTIONS = [
  { id: "mixed", label: "Mixed", emoji: "🌈", blurb: "A little of everything today." },
  { id: "phonics", label: "Phonics", emoji: "🔊", blurb: "Letter sounds and Build a Word." },
  { id: "reading", label: "Reading", emoji: "📖", blurb: "Read It sentences and stories." },
  { id: "math", label: "Math", emoji: "🔢", blurb: "Counting and tiny math stories." },
];

export const TEACHER_DIFFICULTY_OPTIONS = [
  { id: "auto", label: "Auto", blurb: "Adjusts gently from how she is doing." },
  { id: "easy", label: "Easy", blurb: "Shorter, simpler practice." },
  { id: "just_right", label: "Just Right", blurb: "Matches her current level." },
  { id: "challenge", label: "Challenge", blurb: "Stretch goals when she is ready." },
];

export { CELEBRATION_FREQUENCY_OPTIONS, normalizeCelebrationFrequency } from "./feedbackPacing.js";

export function normalizeTeacherFocus(value) {
  const id = String(value || "mixed");
  return TEACHER_FOCUS_OPTIONS.some((o) => o.id === id) ? id : "mixed";
}

export function normalizeTeacherDifficulty(value) {
  const id = String(value || "auto");
  return TEACHER_DIFFICULTY_OPTIONS.some((o) => o.id === id) ? id : "auto";
}

function sentenceSubject(readerName) {
  const name = String(readerName || "").trim();
  return name && name !== "your reader" ? name : "Your reader";
}

/** @param {object} day normalized today entry @param {object} progress */
export function getTeacherRecommendation(day, progress, options = {}) {
  const readerSubject = sentenceSubject(options.readerName);
  const attempts = Number(day.attempts) || 0;
  const correct = Number(day.correct) || 0;
  const rate = attempts > 0 ? correct / attempts : null;
  const sentencesRead = Number(day.sentencesRead) || 0;
  const mathCorrect = Number(day.mathCorrect) || 0;
  const soundsCorrect = Number(day.soundsCorrect) || 0;
  const wordsBuilt = Number(day.wordsBuilt) || 0;
  const stars = Number(progress?.stars) || 0;
  const focus = normalizeTeacherFocus(progress?.settings?.teacherFocus);
  const playerLevel = Number(progress?.level) || 1;

  if (sentencesRead === 0) {
    return {
      title: "Try Read It next",
      message: `${readerSubject} has not logged a sentence yet today. Read one short line together, then tap I read it!`,
      mode: "read",
      emoji: "📖",
      tone: "action",
    };
  }

  if (attempts >= 6 && rate != null && rate < 0.55) {
    return {
      title: "Easier phonics review",
      message: "Lots of tries today with a lower success rate. Sound Pop or Build a Word at Easy difficulty can rebuild confidence.",
      mode: "sounds",
      emoji: "🔊",
      tone: "support",
    };
  }

  if (mathCorrect >= 5 && rate != null && rate >= 0.7 && playerLevel >= 5) {
    return {
      title: "Level 5+ math challenge",
      message: "Math is going well today. Try Counting & Math with Challenge on for numbers up to 20 and word problems.",
      mode: "math",
      emoji: "🔢",
      tone: "stretch",
    };
  }

  if (stars >= 8) {
    return {
      title: "Celebrate with a reward",
      message: `She has ${stars} spendable stars. Pick a small reward together or save stars for a bigger treat.`,
      mode: "kidRewards",
      emoji: "🏆",
      tone: "celebrate",
    };
  }

  if (focus === "phonics" && soundsCorrect <= wordsBuilt) {
    return {
      title: "Phonics focus: Letter Echo",
      message: "Today's plan is phonics. Warm up with repeat-after-me letter practice, then try Sound Pop.",
      mode: "letterEcho",
      emoji: "🗣️",
      tone: "focus",
    };
  }

  if (focus === "reading") {
    return {
      title: "Reading focus: Read It",
      message: "Today's plan is reading. Another sentence or mini story keeps momentum going.",
      mode: "read",
      emoji: "📖",
      tone: "focus",
    };
  }

  if (focus === "math") {
    return {
      title: "Math focus",
      message: "Today's plan is math. Count out loud, then try a tiny math story.",
      mode: "math",
      emoji: "🔢",
      tone: "focus",
    };
  }

  if (wordsBuilt < 2) {
    return {
      title: "Build a Word",
      message: "Blend a few CVC words to connect sounds with spelling.",
      mode: "build",
      emoji: "🧱",
      tone: "action",
    };
  }

  return {
    title: "Keep the streak going",
    message: "Mix one phonics game, one sentence, and a math question for a balanced session.",
    mode: "home",
    emoji: "🌈",
    tone: "mixed",
  };
}

/** Adjust content band from parent-chosen difficulty (Auto = no change). */
export function applyTeacherDifficultyToBand(band, teacherDifficulty) {
  const mode = normalizeTeacherDifficulty(teacherDifficulty);
  if (mode === "auto") return band;

  let { minTier, maxTier, maxCount } = band;

  if (mode === "easy") {
    minTier = 1;
    maxTier = Math.max(1, maxTier - 1);
    maxCount = Math.min(maxCount, 10);
  } else if (mode === "just_right") {
    // Band already reflects player + parent settings.
  } else if (mode === "challenge") {
    minTier = Math.min(6, minTier + 1);
    maxTier = Math.min(6, maxTier + 1);
    if (maxCount < 20) maxCount = Math.min(20, maxCount + 5);
  }

  return { ...band, minTier, maxTier, maxCount };
}
