import { filterByMaxLevel } from "./levels.js";

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
export const COUNTING_SETS = Array.from({ length: 25 }, (_, i) => {
  const count = (i % 20) + 1;
  const pack = COUNT_EMOJIS[i % COUNT_EMOJIS.length];
  const level = count <= 5 ? 1 : count <= 10 ? 2 : count <= 15 ? 3 : 4;
  return {
    count,
    emoji: pack.emoji,
    label: pack.label,
    level,
  };
});

let mid = 1;

function mathFact({ a, b, op, answer, level, story, visualEmoji }) {
  return { id: `mf${mid++}`, a, b, op, answer, level, story, visualEmoji };
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

/** De-duplicate identical a,b,op while keeping variety */
const seen = new Set();
export const MATH_FACTS = facts.filter((f) => {
  const key = `${f.a}|${f.b}|${f.op}|${f.answer}`;
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
