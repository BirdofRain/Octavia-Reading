/**
 * Bird Buddies reading pack — words, sentences, mini stories, and theme weighting.
 */

export const READING_THEMES = {
  default: { id: "default", label: "All stories", emoji: "📚" },
  bird: { id: "bird", label: "Bird Buddies", emoji: "🐦" },
};

const BIRD_TEXT_RE =
  /\b(bird|birds|nest|egg|eggs|owl|owls|wing|wings|chirp|chirps|feather|feathers|beak|perch|cage|seed|seeds|parrot|chick|worm|branch|feather)\b/i;

export function normalizeReadingTheme(theme) {
  return theme === "bird" ? "bird" : "default";
}

export function isBirdThemedItem(item) {
  if (!item) return false;
  if (item.theme === "bird") return true;
  if (item.family === "bird") return true;
  if (typeof item.text === "string" && BIRD_TEXT_RE.test(item.text)) return true;
  if (typeof item.word === "string" && BIRD_TEXT_RE.test(item.word)) return true;
  if (typeof item.sentence === "string" && BIRD_TEXT_RE.test(item.sentence)) return true;
  return false;
}

/** When bird theme is on, double-weight bird items so picks feel fresher and more on-theme. */
export function applyReadingTheme(pool, theme) {
  const list = Array.isArray(pool) ? pool : [];
  if (normalizeReadingTheme(theme) !== "bird") return list;
  const bird = list.filter(isBirdThemedItem);
  const rest = list.filter((x) => !isBirdThemedItem(x));
  if (bird.length === 0) return list;
  return [...bird, ...bird, ...rest];
}

function splitParts(word) {
  return word.split("");
}

function birdWord({ word, level, emoji, sentence, parts }) {
  return {
    word,
    parts: parts || splitParts(word),
    family: "bird",
    level,
    emoji,
    sentence,
    theme: "bird",
  };
}

/** Easy bird pack words (CVC-friendly where possible). */
export const BIRD_PACK_WORDS = [
  birdWord({ word: "owl", level: 2, emoji: "🦉", sentence: "The owl can sit." }),
  birdWord({ word: "fly", level: 3, emoji: "🪽", sentence: "A big bird can fly." }),
  birdWord({ word: "chick", level: 3, emoji: "🐤", sentence: "The chick hid in the nest." }),
  birdWord({ word: "worm", level: 3, emoji: "🪱", sentence: "A red bird sees a worm." }),
  birdWord({ word: "tree", level: 4, emoji: "🌳", sentence: "The nest is high in the tree." }),
  birdWord({ word: "pond", level: 4, emoji: "💧", sentence: "The bird flew over the pond." }),
];

let bid = 1;

function birdSentence(text, focusWords, level, type, helperPrompt) {
  return {
    id: `brd${bid++}`,
    text,
    focusWords,
    level,
    type,
    helperPrompt,
    theme: "bird",
  };
}

/** Bird-themed sentences and mini stories (merged into the main sentence bank). */
export const BIRD_PACK_SENTENCES = [
  // —— Simple (levels 1–3) ——
  birdSentence("The red bird is in the nest.", ["red", "bird", "nest"], 2, "sight-word-supported", "Red tells color. Nest is home."),
  birdSentence("The owl can sit.", ["owl", "sit"], 2, "sight-word-supported", "Owl is a night bird."),
  birdSentence("A big bird can fly.", ["big", "bird", "fly"], 3, "sight-word-supported", "Big and fly are helper words."),
  birdSentence("The owl is in the nest.", ["owl", "nest"], 2, "sight-word-supported", "Owl rests in the nest."),
  birdSentence("A red bird can sit.", ["red", "bird", "sit"], 2, "sight-word-supported", "Sit is calm and still."),
  birdSentence("The bird has a wing.", ["bird", "wing"], 2, "sight-word-supported", "One wing, then the other."),
  birdSentence("The chick is in the nest.", ["chick", "nest"], 3, "sight-word-supported", "Chick is a baby bird."),
  birdSentence("The bird can sit on the nest.", ["bird", "sit", "nest"], 3, "sight-word-supported", "Read slowly: sit on the nest."),
  birdSentence("Mom sees the red bird.", ["Mom", "red", "bird"], 2, "sight-word-supported", "Mom is a helper word."),
  birdSentence("The bird can hop on the rug.", ["bird", "hop", "rug"], 3, "decodable", "Hop is a jump."),
  birdSentence("An egg sat in the nest.", ["egg", "nest"], 2, "sight-word-supported", "An means one."),
  birdSentence("The big owl can sit.", ["big", "owl", "sit"], 3, "sight-word-supported", "Big owl is large."),
  birdSentence("A bird can flap a wing.", ["bird", "flap", "wing"], 3, "sight-word-supported", "Flap means move wings."),
  birdSentence("The hen is a red hen.", ["hen", "red"], 3, "sight-word-supported", "Hen is a farm bird."),
  birdSentence("Ten seeds for the bird.", ["seeds", "bird", "Ten"], 3, "sight-word-supported", "Ten is a number."),
  birdSentence("The bird is on the nest.", ["bird", "nest"], 2, "sight-word-supported", "On means sitting atop."),
  birdSentence("Can the owl hop?", ["owl", "hop"], 3, "sight-word-supported", "Can is a helper word."),
  birdSentence("The red hen can sit.", ["red", "hen", "sit"], 3, "sight-word-supported", "Hen and bird are friends."),
  // —— Level 5+ ——
  birdSentence(
    "The little owl sat in the tall tree.",
    ["owl", "sat", "tree"],
    5,
    "sight-word-supported",
    "Little and tall are picture words."
  ),
  birdSentence(
    "The blue bird flew over the pond.",
    ["blue", "bird", "pond"],
    5,
    "sight-word-supported",
    "Flew is past fly."
  ),
  birdSentence(
    "The parrot can see a green branch.",
    ["parrot", "see", "branch"],
    5,
    "sight-word-supported",
    "Parrot is a bright bird."
  ),
  birdSentence(
    "The chick hid under the soft wing.",
    ["chick", "wing"],
    5,
    "sight-word-supported",
    "Hid means tucked away."
  ),
  birdSentence("The nest is high in the tree.", ["nest", "tree"], 5, "sight-word-supported", "High means up far."),
  birdSentence(
    "The baby owl looks at the big nest.",
    ["owl", "nest", "big"],
    5,
    "sight-word-supported",
    "Baby owl is small."
  ),
  birdSentence(
    "A green parrot sat on the branch.",
    ["parrot", "sat", "branch"],
    5,
    "sight-word-supported",
    "Green is a color word."
  ),
  birdSentence(
    "The red bird pecks a worm by the pond.",
    ["red", "bird", "worm", "pond"],
    5,
    "sight-word-supported",
    "Pecks means bird bites food."
  ),
  birdSentence(
    "Soft wings keep the chick warm.",
    ["wings", "chick"],
    5,
    "sight-word-supported",
    "Warm feels cozy."
  ),
  birdSentence(
    "The owl rests in the tall tree at dusk.",
    ["owl", "tree"],
    6,
    "sight-word-supported",
    "Dusk is evening time."
  ),
  // —— Mini stories (level 6) ——
  birdSentence(
    "The baby owl is in the nest. Mom owl brings food.",
    ["owl", "nest", "Mom"],
    6,
    "mini_story",
    "Read both sentences. Mom helps the baby."
  ),
  birdSentence(
    "A red bird sees a worm. It hops down fast.",
    ["red", "bird", "worm", "hops"],
    6,
    "mini_story",
    "It means the bird. Fast is quick."
  ),
  birdSentence(
    "The parrot sits on a branch. It says hello.",
    ["parrot", "branch"],
    6,
    "mini_story",
    "Parrots can talk. Hello is friendly."
  ),
  birdSentence(
    "The chick is in the nest. The hen sits on the egg.",
    ["chick", "nest", "hen", "egg"],
    6,
    "mini_story",
    "Hen keeps eggs safe."
  ),
  birdSentence(
    "The blue bird flew over the pond. It sat on a branch.",
    ["blue", "bird", "pond", "branch"],
    6,
    "mini_story",
    "Two sentences about one bird trip."
  ),
  birdSentence(
    "An owl can see in the dark. The owl hops to its nest.",
    ["owl", "nest", "hops"],
    6,
    "mini_story",
    "Owls hunt at night."
  ),
  birdSentence(
    "The red bird can hop. The red bird rests in the nest.",
    ["red", "bird", "hop", "nest"],
    6,
    "mini_story",
    "Same bird, hop then rest."
  ),
];

export function countBirdPackSentences() {
  return BIRD_PACK_SENTENCES.length;
}
