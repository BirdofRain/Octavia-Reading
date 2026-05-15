import { filterByMaxLevel } from "./levels.js";
import { resolveDifficultyBand, filterByDifficultyBand, filterCountingByBand } from "../lib/difficulty.js";

const COUNT_EMOJIS = [
  { emoji: "🍎", label: "apples" },
  { emoji: "🐢", label: "turtles" },
  { emoji: "⭐", label: "stars" },
  { emoji: "🐱", label: "cats" },
  { emoji: "🌸", label: "flowers" },
  { emoji: "🦆", label: "ducks" },
  { emoji: "🍓", label: "berries" },
  { emoji: "🌙", label: "moons" },
  { emoji: "💎", label: "gems" },
  { emoji: "🧁", label: "cupcakes" },
  { emoji: "🐶", label: "pups" },
  { emoji: "🐟", label: "fish" },
  { emoji: "🍌", label: "bananas" },
  { emoji: "🎈", label: "balloons" },
  { emoji: "🚗", label: "cars" },
  { emoji: "🐸", label: "frogs" },
  { emoji: "🦋", label: "butterflies" },
  { emoji: "🍪", label: "cookies" },
  { emoji: "🎵", label: "notes" },
  { emoji: "🧸", label: "bears" },
  { emoji: "🪁", label: "kites" },
  { emoji: "🍊", label: "oranges" },
  { emoji: "🐝", label: "bees" },
  { emoji: "🌈", label: "rainbows" },
  { emoji: "🎀", label: "bows" },
  { emoji: "🍉", label: "melon slices" },
];

/** Counting sets 1–20, at least 25 entries */
const BASE_COUNTING_SETS = Array.from({ length: 25 }, (_, i) => {
  const count = (i % 20) + 1;
  const pack = COUNT_EMOJIS[i % COUNT_EMOJIS.length];
  const level = count <= 5 ? 1 : count <= 10 ? 2 : 5;
  return {
    count,
    emoji: pack.emoji,
    label: pack.label,
    level,
  };
});

/** Bird Buddies counting (10–20) for extra variety */
const BIRD_COUNTING_SETS = [
  { count: 10, emoji: "🌾", label: "seeds", level: 2 },
  { count: 11, emoji: "🪶", label: "feathers", level: 2 },
  { count: 12, emoji: "🥚", label: "eggs", level: 2 },
  { count: 13, emoji: "🐦", label: "birds", level: 5 },
  { count: 14, emoji: "🪽", label: "wings", level: 5 },
  { count: 15, emoji: "🪺", label: "nests", level: 5 },
  { count: 16, emoji: "🌾", label: "seeds", level: 5 },
  { count: 17, emoji: "🪶", label: "feathers", level: 5 },
  { count: 18, emoji: "🥚", label: "eggs", level: 5 },
  { count: 19, emoji: "🐦", label: "birds", level: 5 },
  { count: 20, emoji: "⭐", label: "stars", level: 5 },
];

export const COUNTING_SETS = [...BASE_COUNTING_SETS, ...BIRD_COUNTING_SETS];

let mid = 1;

function mathFact({ a, b, op, answer, level, story, visualEmoji, missing, kind }) {
  const row = { id: `mf${mid++}`, a, b, op, answer, level, story, visualEmoji };
  if (missing) row.missing = missing;
  if (kind) row.kind = kind;
  return row;
}

const facts = [];

for (let a = 1; a <= 5; a += 1) {
  for (let b = 1; b <= 5 - a; b += 1) {
    if (a + b <= 5) {
      facts.push(
        mathFact({
          a,
          b,
          op: "+",
          answer: a + b,
          level: 1,
          story: `${a} ${a === 1 ? "apple" : "apples"} and ${b} more make ${a + b}.`,
          visualEmoji: "🍎",
        })
      );
    }
  }
}

for (let total = 2; total <= 5; total += 1) {
  for (let b = 1; b < total; b += 1) {
    const a = total;
    facts.push(
      mathFact({
        a,
        b,
        op: "-",
        answer: a - b,
        level: 1,
        story: `${a} stars, ${b} hide, ${a - b} are left.`,
        visualEmoji: "⭐",
      })
    );
  }
}

for (let a = 1; a <= 9; a += 1) {
  for (let b = 1; b <= 9; b += 1) {
    if (a + b <= 10 && a + b > 5) {
      facts.push(
        mathFact({
          a,
          b,
          op: "+",
          answer: a + b,
          level: 2,
          story: `${a} ducks and ${b} more ducks make ${a + b} ducks.`,
          visualEmoji: "🦆",
        })
      );
    }
  }
}

for (let a = 6; a <= 10; a += 1) {
  for (let b = 1; b <= a - 1 && a <= 10; b += 1) {
    if (a - b >= 1 && a - b <= 9) {
      facts.push(
        mathFact({
          a,
          b,
          op: "-",
          answer: a - b,
          level: 2,
          story: `${a} gems, ${b} roll away, ${a - b} gems stay.`,
          visualEmoji: "💎",
        })
      );
    }
  }
}

for (let n = 1; n <= 5; n += 1) {
  facts.push(
    mathFact({
      a: n,
      b: n,
      op: "+",
      answer: n + n,
      level: 3,
      story: `Double ${n}: ${n} plus ${n} makes ${n + n}.`,
      visualEmoji: "⭐",
    })
  );
}

for (let total = 3; total <= 8; total += 1) {
  for (let missing = 1; missing < total; missing += 1) {
    const other = total - missing;
    if (other >= 1 && other <= 9) {
      facts.push(
        mathFact({
          a: missing,
          b: other,
          op: "+",
          answer: total,
          level: 4,
          story: `Some number plus ${other} makes ${total}. What is the missing number?`,
          visualEmoji: "🧩",
        })
      );
    }
  }
}

function levelForAnswer10to20(answer) {
  if (answer <= 12) return 2;
  if (answer <= 16) return 3;
  return 4;
}

/** Answers 10–20: addition and subtraction within 20, many bird-themed stories */
const FACTS_10_TO_20_RAW = [
  { a: 9, b: 1, op: "+", answer: 10, story: "Nine seeds and one more seed make ten seeds.", visualEmoji: "🌾" },
  { a: 8, b: 2, op: "+", answer: 10, story: "Eight eggs plus two eggs make ten eggs.", visualEmoji: "🥚" },
  { a: 7, b: 3, op: "+", answer: 10, story: "Seven stars plus three stars make ten stars.", visualEmoji: "⭐" },
  { a: 6, b: 4, op: "+", answer: 10, story: "Six and four make ten.", visualEmoji: "🐦" },
  { a: 10, b: 1, op: "+", answer: 11, story: "Ten seeds and one more seed make eleven seeds.", visualEmoji: "🌾" },
  { a: 9, b: 2, op: "+", answer: 11, story: "Nine birds and two more birds make eleven birds.", visualEmoji: "🐦" },
  { a: 8, b: 3, op: "+", answer: 11, story: "Eight plus three make eleven.", visualEmoji: "🪶" },
  { a: 10, b: 2, op: "+", answer: 12, story: "Ten eggs and two more eggs make twelve eggs.", visualEmoji: "🥚" },
  { a: 11, b: 1, op: "+", answer: 12, story: "Eleven feathers plus one feather make twelve feathers.", visualEmoji: "🪶" },
  { a: 9, b: 3, op: "+", answer: 12, story: "Nine plus three make twelve.", visualEmoji: "🪽" },
  { a: 12, b: 1, op: "+", answer: 13, story: "Twelve eggs and one more egg make thirteen eggs.", visualEmoji: "🥚" },
  { a: 10, b: 3, op: "+", answer: 13, story: "Ten birds plus three birds make thirteen birds.", visualEmoji: "🐦" },
  { a: 8, b: 5, op: "+", answer: 13, story: "Eight plus five make thirteen.", visualEmoji: "🪺" },
  { a: 10, b: 4, op: "+", answer: 14, story: "Ten wings plus four wings make fourteen wings.", visualEmoji: "🪽" },
  { a: 7, b: 7, op: "+", answer: 14, story: "Seven plus seven make fourteen.", visualEmoji: "🐦" },
  { a: 9, b: 5, op: "+", answer: 14, story: "Nine plus five make fourteen.", visualEmoji: "🌾" },
  { a: 10, b: 5, op: "+", answer: 15, story: "Ten nests and five more nests make fifteen nests.", visualEmoji: "🪺" },
  { a: 12, b: 3, op: "+", answer: 15, story: "Twelve seeds plus three seeds make fifteen seeds.", visualEmoji: "🌾" },
  { a: 11, b: 4, op: "+", answer: 15, story: "Eleven plus four make fifteen.", visualEmoji: "🥚" },
  { a: 10, b: 6, op: "+", answer: 16, story: "Ten birds and six more birds make sixteen birds.", visualEmoji: "🐦" },
  { a: 14, b: 2, op: "+", answer: 16, story: "Fourteen seeds plus two seeds make sixteen seeds.", visualEmoji: "🌾" },
  { a: 12, b: 4, op: "+", answer: 16, story: "Twelve plus four make sixteen.", visualEmoji: "🪶" },
  { a: 12, b: 5, op: "+", answer: 17, story: "Twelve eggs and five more eggs make seventeen eggs.", visualEmoji: "🥚" },
  { a: 10, b: 7, op: "+", answer: 17, story: "Ten plus seven make seventeen.", visualEmoji: "🪽" },
  { a: 9, b: 8, op: "+", answer: 17, story: "Nine plus eight make seventeen.", visualEmoji: "🐦" },
  { a: 15, b: 3, op: "+", answer: 18, story: "Fifteen birds plus three birds make eighteen birds.", visualEmoji: "🐦" },
  { a: 12, b: 6, op: "+", answer: 18, story: "Twelve feathers plus six feathers make eighteen feathers.", visualEmoji: "🪶" },
  { a: 10, b: 8, op: "+", answer: 18, story: "Ten plus eight make eighteen.", visualEmoji: "🪺" },
  { a: 11, b: 8, op: "+", answer: 19, story: "Eleven nests plus eight nests make nineteen nests.", visualEmoji: "🪺" },
  { a: 14, b: 5, op: "+", answer: 19, story: "Fourteen plus five make nineteen.", visualEmoji: "🌾" },
  { a: 10, b: 9, op: "+", answer: 19, story: "Ten plus nine make nineteen.", visualEmoji: "🥚" },
  { a: 10, b: 10, op: "+", answer: 20, story: "Ten chirps plus ten chirps make twenty chirps.", visualEmoji: "🐤" },
  { a: 12, b: 8, op: "+", answer: 20, story: "Twelve seeds plus eight seeds make twenty seeds.", visualEmoji: "🌾" },
  { a: 15, b: 5, op: "+", answer: 20, story: "Fifteen plus five make twenty.", visualEmoji: "⭐" },
  { a: 20, b: 1, op: "-", answer: 19, story: "Twenty seeds, one rolls away, nineteen are left.", visualEmoji: "🌾" },
  { a: 18, b: 2, op: "-", answer: 16, story: "Eighteen eggs, two crack open for snack, sixteen are left.", visualEmoji: "🥚" },
  { a: 15, b: 5, op: "-", answer: 10, story: "Fifteen birds, five fly away, ten are left.", visualEmoji: "🐦" },
  { a: 12, b: 2, op: "-", answer: 10, story: "Twelve minus two make ten.", visualEmoji: "⭐" },
  { a: 20, b: 5, op: "-", answer: 15, story: "Twenty seeds, five are eaten, fifteen are left.", visualEmoji: "🌾" },
  { a: 19, b: 3, op: "-", answer: 16, story: "Nineteen minus three make sixteen.", visualEmoji: "🪶" },
  { a: 17, b: 2, op: "-", answer: 15, story: "Seventeen feathers, two float off, fifteen are left.", visualEmoji: "🪶" },
  { a: 16, b: 4, op: "-", answer: 12, story: "Sixteen eggs, four hatch, twelve are left.", visualEmoji: "🥚" },
  { a: 14, b: 3, op: "-", answer: 11, story: "Fourteen minus three make eleven.", visualEmoji: "🐦" },
  { a: 13, b: 2, op: "-", answer: 11, story: "Thirteen birds, two fly to a tree, eleven are left.", visualEmoji: "🐦" },
  { a: 12, b: 1, op: "-", answer: 11, story: "Twelve minus one make eleven.", visualEmoji: "🪺" },
  { a: 15, b: 3, op: "-", answer: 12, story: "Fifteen wings, three tuck in, twelve are left.", visualEmoji: "🪽" },
  { a: 18, b: 5, op: "-", answer: 13, story: "Eighteen minus five make thirteen.", visualEmoji: "🌾" },
  { a: 20, b: 7, op: "-", answer: 13, story: "Twenty nests, seven are empty, thirteen are left.", visualEmoji: "🪺" },
  { a: 17, b: 4, op: "-", answer: 13, story: "Seventeen minus four make thirteen.", visualEmoji: "🥚" },
  { a: 14, b: 2, op: "-", answer: 12, story: "Fourteen minus two make twelve.", visualEmoji: "🐤" },
  { a: 11, b: 1, op: "-", answer: 10, story: "Eleven chirps, one stops, ten are left.", visualEmoji: "🐤" },
  { a: 20, b: 10, op: "-", answer: 10, story: "Twenty minus ten make ten.", visualEmoji: "⭐" },
  { a: 16, b: 6, op: "-", answer: 10, story: "Sixteen seeds, six get planted, ten are left.", visualEmoji: "🌾" },
  { a: 19, b: 9, op: "-", answer: 10, story: "Nineteen minus nine make ten.", visualEmoji: "🐦" },
];

for (const row of FACTS_10_TO_20_RAW) {
  facts.push(
    mathFact({
      a: row.a,
      b: row.b,
      op: row.op,
      answer: row.answer,
      level: levelForAnswer10to20(row.answer),
      story: row.story,
      visualEmoji: row.visualEmoji,
    })
  );
}

/** Missing-number puzzles (answer = the blank), tier 5+ */
const MISSING_NUMBER_FACTS = [
  { a: 8, b: 5, op: "+", missing: "b", answer: 5, level: 5, story: "Eight plus something makes thirteen.", visualEmoji: "🪺" },
  { a: 5, b: 8, op: "+", missing: "a", answer: 5, level: 5, story: "Something plus eight makes thirteen.", visualEmoji: "⭐" },
  { a: 9, b: 4, op: "+", missing: "b", answer: 4, level: 5, story: "Nine plus something makes thirteen.", visualEmoji: "🐦" },
  { a: 14, b: 4, op: "-", missing: "b", answer: 10, level: 5, story: "Fourteen take away something leaves ten.", visualEmoji: "🌾" },
  { a: 12, b: 4, op: "-", missing: "b", answer: 8, level: 5, story: "Twelve minus something equals eight.", visualEmoji: "🥚" },
  { a: 18, b: 5, op: "-", missing: "b", answer: 13, level: 5, story: "Eighteen minus something makes thirteen.", visualEmoji: "🪶" },
  { a: 7, b: 8, op: "+", missing: "b", answer: 8, level: 5, story: "Seven plus something makes fifteen.", visualEmoji: "🐦" },
  { a: 6, b: 9, op: "+", missing: "b", answer: 9, level: 5, story: "Six plus something makes fifteen.", visualEmoji: "🌾" },
  { a: 11, b: 6, op: "+", missing: "b", answer: 6, level: 5, story: "Eleven plus something makes seventeen.", visualEmoji: "🪽" },
  { a: 20, b: 7, op: "-", missing: "b", answer: 13, level: 5, story: "Twenty minus something makes thirteen.", visualEmoji: "🪺" },
];

for (const row of MISSING_NUMBER_FACTS) {
  facts.push(mathFact(row));
}

/** Word problems and mixed ±20 stories, tier 6 */
const WORD_PROBLEM_FACTS = [
  { a: 7, b: 5, op: "+", answer: 12, level: 6, kind: "word_problem", story: "Sam has seven stickers. Mom gives five more. How many stickers now?", visualEmoji: "⭐" },
  { a: 10, b: 3, op: "-", answer: 7, level: 6, kind: "word_problem", story: "Ten birds on a branch. Three fly away. How many birds are left?", visualEmoji: "🐦" },
  { a: 8, b: 7, op: "+", answer: 15, level: 6, kind: "word_problem", story: "Eight seeds in one cup and seven in another. How many seeds altogether?", visualEmoji: "🌾" },
  { a: 16, b: 4, op: "-", answer: 12, level: 6, kind: "word_problem", story: "Sixteen eggs in the nest. Four hatch. How many eggs are still waiting?", visualEmoji: "🥚" },
  { a: 9, b: 9, op: "+", answer: 18, level: 6, kind: "word_problem", story: "Nine feathers on the left wing and nine on the right. How many feathers?", visualEmoji: "🪶" },
  { a: 20, b: 8, op: "-", answer: 12, level: 6, kind: "word_problem", story: "Twenty chirps in the morning. Eight stop at nap time. How many chirps are left?", visualEmoji: "🐤" },
  { a: 12, b: 8, op: "+", answer: 20, level: 6, kind: "word_problem", story: "Twelve seeds plus eight seeds. How many seeds for the hungry bird?", visualEmoji: "🌾" },
  { a: 15, b: 5, op: "-", answer: 10, level: 6, kind: "word_problem", story: "Fifteen birds on the fence. Five fly to the tree. How many stay on the fence?", visualEmoji: "🐦" },
];

for (const row of WORD_PROBLEM_FACTS) {
  facts.push(mathFact(row));
}

/** De-duplicate identical a,b,op while keeping variety */
const seen = new Set();
export const MATH_FACTS = facts.filter((f) => {
  const key = f.missing ? `${f.a}|${f.b}|${f.op}|${f.missing}|${f.answer}` : `${f.a}|${f.b}|${f.op}|${f.answer}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

export function countingSetsForMathLevel(activeMathLevel) {
  return filterByMaxLevel(COUNTING_SETS, activeMathLevel);
}

export function mathFactsForLevel(activeMathLevel) {
  return filterByMaxLevel(MATH_FACTS, activeMathLevel);
}

export function countingSetsForDifficulty(progress, sessionStats = {}) {
  const band = resolveDifficultyBand(progress, sessionStats, "math");
  return filterCountingByBand(COUNTING_SETS, band);
}

export function mathFactsForDifficulty(progress, sessionStats = {}) {
  const band = resolveDifficultyBand(progress, sessionStats, "math");
  return filterByDifficultyBand(MATH_FACTS, band);
}
