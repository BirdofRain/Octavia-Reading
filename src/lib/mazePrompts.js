import { mazeTierForLevel } from "../data/mazeLayouts.js";
import { cancelSpeech, clearScheduledTimers, scheduleAudio, speakText } from "./questAudio.js";

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

/** @typedef {{ sentence: string, blank: string, word: string, distractors: string[] }} MazeClue */

/** @type {Record<import("../data/mazeLayouts.js").MazeTier, MazeClue[]>} */
const CHECKPOINT_POOLS = {
  starter: [
    {
      sentence: "The bird can see a cat.",
      blank: "The bird can see a ____.",
      word: "cat",
      distractors: ["cap", "can", "cab"],
    },
    {
      sentence: "The bird can sit on a mat.",
      blank: "The bird can sit on a ____.",
      word: "mat",
      distractors: ["map", "mad", "man"],
    },
    {
      sentence: "The bird can hop to a log.",
      blank: "The bird can hop to a ____.",
      word: "log",
      distractors: ["lot", "lip", "leg"],
    },
    {
      sentence: "The bird can peck a seed.",
      blank: "The bird can peck a ____.",
      word: "seed",
      distractors: ["seem", "seen", "seek"],
    },
    {
      sentence: "The bird can rest in a nest.",
      blank: "The bird can rest in a ____.",
      word: "nest",
      distractors: ["next", "net", "neck"],
    },
  ],
  explorer: [
    {
      sentence: "The red bird is on the branch.",
      blank: "The red bird is on the ____.",
      word: "branch",
      distractors: ["bench", "brunch", "bunch"],
    },
    {
      sentence: "The bird can find a small nest.",
      blank: "The bird can find a small ____.",
      word: "nest",
      distractors: ["next", "rest", "test"],
    },
    {
      sentence: "The chick will jump in the mud.",
      blank: "The chick will jump in the ____.",
      word: "mud",
      distractors: ["mug", "map", "mad"],
    },
    {
      sentence: "The bird can flap past the bed.",
      blank: "The bird can flap past the ____.",
      word: "bed",
      distractors: ["bad", "bud", "bid"],
    },
    {
      sentence: "The bird can land on a soft wing path.",
      blank: "The bird can land on a soft wing ____.",
      word: "path",
      distractors: ["past", "pack", "part"],
    },
    {
      sentence: "A tiny bird hid under the leaf.",
      blank: "A tiny bird hid under the ____.",
      word: "leaf",
      distractors: ["left", "lend", "lamp"],
    },
  ],
  champion: [
    {
      sentence: "The little bird can follow the bright path.",
      blank: "The little bird can follow the bright ____.",
      word: "path",
      distractors: ["patch", "past", "pack"],
    },
    {
      sentence: "A brave bird will fly over the small hill.",
      blank: "A brave bird will fly over the small ____.",
      word: "hill",
      distractors: ["hall", "help", "hold"],
    },
    {
      sentence: "The bird found a shiny seed near the nest.",
      blank: "The bird found a shiny seed near the ____.",
      word: "nest",
      distractors: ["next", "rest", "test"],
    },
    {
      sentence: "The bird can stretch its wing in the sun.",
      blank: "The bird can stretch its wing in the ____.",
      word: "sun",
      distractors: ["son", "sum", "run"],
    },
    {
      sentence: "The bird will hop along the mossy branch.",
      blank: "The bird will hop along the mossy ____.",
      word: "branch",
      distractors: ["bench", "bunch", "brunch"],
    },
  ],
};

/**
 * @param {import("../data/mazeLayouts.js").MazeCheckpointDef} cp
 * @param {MazeClue} clue
 */
function buildCheckpointPrompt(cp, clue) {
  const distractors = shuffle(clue.distractors).slice(0, 3);
  const wrongChoices = distractors.map((word, i) => ({
    word,
    isCorrect: false,
    wrongPathIndex: Math.min(i, cp.wrongBranchPaths.length - 1),
  }));
  const correctChoice = { word: clue.word, isCorrect: true, wrongPathIndex: -1 };
  const choices = shuffle([correctChoice, ...wrongChoices]);
  return {
    displayBlank: clue.blank,
    fullSentence: clue.sentence,
    correct: clue.word,
    choices,
  };
}

/**
 * @param {import("../data/mazeLayouts.js").BranchingMazeLayout} layout
 * @param {object} _progress
 * @param {object} _sessionStats
 */
export function enrichMazeLayout(layout, _progress, _sessionStats) {
  const pool = shuffle([...CHECKPOINT_POOLS[layout.tier]]);
  const checkpoints = layout.checkpoints.map((cp, i) => {
    const clue = pool[i % pool.length];
    return { ...cp, prompt: buildCheckpointPrompt(cp, clue) };
  });
  return { ...layout, checkpoints };
}

/**
 * @param {{ displayBlank: string, fullSentence: string, correct: string }} prompt
 * @param {() => void} [onDone]
 */
export function speakCheckpointClue(prompt, onDone) {
  const instruction = `Click on ${prompt.correct} to continue.`;
  cancelSpeech();
  clearScheduledTimers();
  speakText(prompt.fullSentence, 0.72, () => {
    scheduleAudio(() => speakText(instruction, 0.72, onDone), 400);
  });
}

/** @deprecated Linear maze step prompts */
export function buildMazePrompt(progress, sessionStats, stepIndex) {
  const tier = mazeTierForLevel(progress?.level ?? 3);
  const pool = CHECKPOINT_POOLS[tier];
  const clue = pool[stepIndex % pool.length];
  const prompt = buildCheckpointPrompt(
    { wrongBranchPaths: [[], [], []] },
    clue
  );
  return {
    type: "checkpoint",
    prompt: prompt.displayBlank,
    correct: prompt.correct,
    choices: prompt.choices.map((c) => c.word),
    speakHint: prompt.correct,
    fullSentence: prompt.fullSentence,
    displayBlank: prompt.displayBlank,
  };
}
