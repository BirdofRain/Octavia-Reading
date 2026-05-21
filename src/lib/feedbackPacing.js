/**
 * Centralized praise pacing — spoken encouragement is occasional, not every correct answer.
 */

export const CELEBRATION_FREQUENCY_OPTIONS = [
  { id: "calm", label: "Calm", blurb: "Spoken praise about every 6 correct answers." },
  { id: "normal", label: "Normal", blurb: "Spoken praise about every 5 correct answers." },
  { id: "extra", label: "Extra", blurb: "More encouragement about every 3 correct answers." },
];

/** Events that always get spoken celebration (milestones). */
export const MILESTONE_EVENT_TYPES = new Set([
  "level_up",
  "badge_earned",
  "game_completed",
  "maze_completed",
  "new_unlock",
  "daily_goal_complete",
]);

const PRAISE_LINES = [
  "Great focus.",
  "You're working hard.",
  "Nice listening.",
  "Keep going.",
  "Steady reading.",
  "Good thinking.",
];

const TRY_AGAIN_LINES = [
  "Try again.",
  "Listen again.",
  "Good try.",
];

let praiseLineIndex = 0;
let tryAgainLineIndex = 0;

export function normalizeCelebrationFrequency(value) {
  const id = String(value || "calm");
  return CELEBRATION_FREQUENCY_OPTIONS.some((o) => o.id === id) ? id : "calm";
}

function praiseIntervalForFrequency(frequency) {
  const mode = normalizeCelebrationFrequency(frequency);
  if (mode === "extra") return 3;
  if (mode === "normal") return 5;
  return 6;
}

/**
 * @param {{ correctCount?: number, streak?: number, eventType?: string, celebrationFrequency?: string }} opts
 */
export function shouldSpeakPraise({ correctCount = 0, streak = 0, eventType, celebrationFrequency = "calm" } = {}) {
  if (eventType && MILESTONE_EVENT_TYPES.has(eventType)) return true;
  const n = Math.max(0, Number(correctCount) || 0);
  if (n <= 0) return false;
  const interval = praiseIntervalForFrequency(celebrationFrequency);
  if (interval <= 0) return false;
  void streak;
  return n % interval === 0;
}

export function getPraiseLine() {
  const line = PRAISE_LINES[praiseLineIndex % PRAISE_LINES.length];
  praiseLineIndex += 1;
  return line;
}

export function getGentleTryAgainLine() {
  const line = TRY_AGAIN_LINES[tryAgainLineIndex % TRY_AGAIN_LINES.length];
  tryAgainLineIndex += 1;
  return line;
}

/** Visual-only toast for routine correct answers. */
export function subtleCorrectResult() {
  return { type: "good", subtle: true, text: "✓" };
}

export function runFeedbackPacingSelfTests() {
  console.assert(!shouldSpeakPraise({ correctCount: 1 }), "first correct should be visual only");
  console.assert(!shouldSpeakPraise({ correctCount: 4 }), "fourth correct should be visual only");
  console.assert(shouldSpeakPraise({ correctCount: 5, celebrationFrequency: "normal" }), "5th correct normal mode");
  console.assert(!shouldSpeakPraise({ correctCount: 6, celebrationFrequency: "normal" }), "6th correct normal still visual");
  console.assert(shouldSpeakPraise({ correctCount: 10, celebrationFrequency: "normal" }), "10th correct normal");
  console.assert(!shouldSpeakPraise({ correctCount: 5, celebrationFrequency: "calm" }), "5th calm is visual");
  console.assert(shouldSpeakPraise({ correctCount: 6, celebrationFrequency: "calm" }), "6th calm speaks");
  console.assert(shouldSpeakPraise({ eventType: "maze_completed" }), "maze completion always celebrates");
  console.assert(getPraiseLine().length > 0, "praise line non-empty");
  console.assert(getGentleTryAgainLine() === "Try again.", "first try-again is calm default");
}

if (typeof window !== "undefined" && !window.__octaviaFeedbackPacingTestsRan) {
  window.__octaviaFeedbackPacingTestsRan = true;
  runFeedbackPacingSelfTests();
}
