import { WORD_FAMILIES } from "./phonics.js";
import { filterByMaxLevel } from "./levels.js";

function parts(w) {
  return w.split("");
}

/** Emoji hints for common decodable words */
const WORD_EMOJI = {
  cat: "🐈",
  mat: "🟫",
  sat: "🪑",
  pat: "👋",
  bat: "🦇",
  fat: "🍰",
  rat: "🐀",
  hat: "🎩",
  cap: "🧢",
  map: "🗺️",
  nap: "😴",
  tap: "🚰",
  lap: "🦵",
  can: "🥫",
  man: "🧔",
  pan: "🍳",
  ran: "🏃",
  fan: "🪭",
  pin: "📍",
  tin: "🥫",
  win: "🏆",
  fin: "🐟",
  sit: "🪑",
  bit: "🦷",
  fit: "👟",
  hit: "🥎",
  dog: "🐕",
  log: "🪵",
  fog: "🌫️",
  hop: "🐇",
  mop: "🧹",
  top: "🔝",
  pop: "🎈",
  bug: "🐞",
  rug: "🧶",
  mug: "☕",
  hug: "🤗",
  bed: "🛏️",
  red: "🔴",
  fed: "🍼",
  hen: "🐔",
  pen: "🖊️",
  men: "👨",
  mom: "👩",
  dad: "👨",
  sun: "☀️",
  fun: "🎉",
  run: "🏃",
  mud: "🟤",
  cup: "☕",
  pup: "🐶",
  jet: "✈️",
  net: "🥅",
  vet: "🐾",
  big: "🐘",
  dig: "⛏️",
  pig: "🐷",
  wig: "💇",
  box: "📦",
  fox: "🦊",
  six: "6️⃣",
  mix: "🥣",
  ram: "🐏",
  jam: "🍓",
  sad: "😢",
  mad: "😤",
  pad: "📝",
  tag: "🏷️",
  wag: "🐕",
  jog: "👟",
  rob: "🏴‍☠️",
  rod: "🎣",
  cod: "🐟",
  lid: "🫙",
  rip: "📄",
  sip: "🥤",
  tip: "💵",
  dim: "💡",
  web: "🕸️",
  dot: "🔴",
  cot: "🛏️",
};

function sentenceForFamilyWord(familyId, word) {
  const templates = {
    at: () => {
      const m = {
        cat: "The cat sat.",
        mat: "Sam sat on the mat.",
        sat: "The cat sat.",
        pat: "Pat the cat.",
        bat: "The bat can nap.",
        fat: "The fat cat sat.",
        rat: "The rat ran.",
        hat: "Dad has a hat.",
      };
      return m[word] || `The ${word} is fun.`;
    },
    ap: () => {
      const m = {
        cap: "I can tap the cap.",
        map: "Tap the map.",
        nap: "Dad can nap.",
        tap: "Tap tap tap.",
        lap: "The pup sat on my lap.",
      };
      return m[word] || `I see a ${word}.`;
    },
    an: () => {
      const m = {
        can: "I see a can.",
        man: "I see a man.",
        pan: "I see a pan.",
        ran: "The man ran.",
        fan: "The fan can spin.",
      };
      return m[word] || `I see a ${word}.`;
    },
    in: () => {
      if (word === "pin") return "The pin is in.";
      if (word === "win") return "I can win.";
      return `The ${word} is in.`;
    },
    it: () => {
      if (word === "sit") return "Sit on the mat.";
      if (word === "hit") return "Do not hit.";
      return `I can ${word}.`;
    },
    og: () => (word === "dog" ? "The dog can hop." : `I see a ${word}.`),
    op: () => `I can ${word}.`,
    ug: () => (word === "bug" ? "The bug is on the rug." : `The ${word} is fun.`),
    ed: () => {
      const m = { bed: "The bed is soft.", red: "The bed is red.", fed: "Dad fed the pup." };
      return m[word] || `The ${word} is fun.`;
    },
    en: () => {
      const m = { hen: "The hen is in the pen.", pen: "The pen is in the cup.", men: "The men can run." };
      return m[word] || `The ${word} is fun.`;
    },
  };
  const fn = templates[familyId];
  return fn ? fn() : `Read: ${word}.`;
}

const fromFamilies = WORD_FAMILIES.flatMap((fam) =>
  fam.words.map((word) => ({
    word,
    parts: parts(word),
    family: fam.id,
    level: fam.level,
    emoji: WORD_EMOJI[word] || "📘",
    sentence: sentenceForFamilyWord(fam.id, word),
  }))
);

const extras = [
  { word: "mom", parts: parts("mom"), family: null, level: 4, emoji: "👩", sentence: "Mom can sit." },
  { word: "dad", parts: parts("dad"), family: null, level: 4, emoji: "👨", sentence: "Dad can run." },
  { word: "sun", parts: parts("sun"), family: null, level: 3, emoji: "☀️", sentence: "The sun is up." },
  { word: "fun", parts: parts("fun"), family: null, level: 3, emoji: "🎉", sentence: "We had fun." },
  { word: "run", parts: parts("run"), family: null, level: 3, emoji: "🏃", sentence: "I can run." },
  { word: "mud", parts: parts("mud"), family: null, level: 3, emoji: "🟤", sentence: "The pup got mud." },
  { word: "cup", parts: parts("cup"), family: null, level: 3, emoji: "☕", sentence: "Sip from the cup." },
  { word: "pup", parts: parts("pup"), family: null, level: 3, emoji: "🐶", sentence: "The pup can hop." },
  { word: "jet", parts: parts("jet"), family: null, level: 4, emoji: "✈️", sentence: "The jet is fast." },
  { word: "net", parts: parts("net"), family: null, level: 4, emoji: "🥅", sentence: "The net can trap." },
  { word: "vet", parts: parts("vet"), family: null, level: 4, emoji: "🐾", sentence: "The vet can help." },
  { word: "big", parts: parts("big"), family: null, level: 4, emoji: "🐘", sentence: "The pig is big." },
  { word: "dig", parts: parts("dig"), family: null, level: 4, emoji: "⛏️", sentence: "I can dig." },
  { word: "pig", parts: parts("pig"), family: null, level: 4, emoji: "🐷", sentence: "The pig can dig." },
  { word: "wig", parts: parts("wig"), family: null, level: 4, emoji: "💇", sentence: "The wig is fun." },
  { word: "box", parts: parts("box"), family: null, level: 4, emoji: "📦", sentence: "The fox hid in the box." },
  { word: "fox", parts: parts("fox"), family: null, level: 4, emoji: "🦊", sentence: "The fox can run." },
  { word: "six", parts: parts("six"), family: null, level: 4, emoji: "6️⃣", sentence: "I see six dots." },
  { word: "mix", parts: parts("mix"), family: null, level: 4, emoji: "🥣", sentence: "Mom can mix it." },
  { word: "ram", parts: parts("ram"), family: null, level: 4, emoji: "🐏", sentence: "The ram can run." },
  { word: "jam", parts: parts("jam"), family: null, level: 4, emoji: "🍓", sentence: "I like jam." },
  { word: "sad", parts: parts("sad"), family: null, level: 4, emoji: "😢", sentence: "The pup is sad." },
  { word: "mad", parts: parts("mad"), family: null, level: 4, emoji: "😤", sentence: "Dad is not mad." },
  { word: "pad", parts: parts("pad"), family: null, level: 4, emoji: "📝", sentence: "I jot on the pad." },
  { word: "tag", parts: parts("tag"), family: null, level: 4, emoji: "🏷️", sentence: "We can tag it." },
  { word: "wag", parts: parts("wag"), family: null, level: 4, emoji: "🐕", sentence: "The pup can wag." },
  { word: "jog", parts: parts("jog"), family: null, level: 4, emoji: "👟", sentence: "I can jog." },
  { word: "rob", parts: parts("rob"), family: null, level: 4, emoji: "🏴‍☠️", sentence: "Do not rob." },
  { word: "rod", parts: parts("rod"), family: null, level: 4, emoji: "🎣", sentence: "Dad has a rod." },
  { word: "cod", parts: parts("cod"), family: null, level: 4, emoji: "🐟", sentence: "The cod is big." },
  { word: "lid", parts: parts("lid"), family: null, level: 4, emoji: "🫙", sentence: "Put the lid on." },
  { word: "rip", parts: parts("rip"), family: null, level: 4, emoji: "📄", sentence: "Do not rip it." },
  { word: "sip", parts: parts("sip"), family: null, level: 4, emoji: "🥤", sentence: "Sip the cup." },
  { word: "tip", parts: parts("tip"), family: null, level: 4, emoji: "💵", sentence: "Mom got a tip." },
  { word: "dim", parts: parts("dim"), family: null, level: 4, emoji: "💡", sentence: "The lamp is dim." },
  { word: "web", parts: parts("web"), family: null, level: 4, emoji: "🕸️", sentence: "The bug is on the web." },
  { word: "dot", parts: parts("dot"), family: null, level: 2, emoji: "🔴", sentence: "Put a dot on it." },
  { word: "cot", parts: parts("cot"), family: null, level: 2, emoji: "🛏️", sentence: "The cot is soft." },
];

export const WORDS = [...fromFamilies, ...extras];

let sid = 1;
function S(text, focusWords, level, type, helperPrompt) {
  return { id: `sb${sid++}`, text, focusWords, level, type, helperPrompt };
}

/** @type {Array<{id:string,text:string,focusWords:string[],level:number,type:'decodable'|'sight-word-supported',helperPrompt:string}>} */
export const SENTENCE_BANK = [
  S("The cat sat.", ["cat", "sat"], 1, "decodable", "Tap cat and sat."),
  S("Sam sat on the mat.", ["sat", "mat"], 1, "decodable", "Blend mat slowly."),
  S("A map and a cap.", ["map", "cap"], 1, "decodable", "Find map in your head."),
  S("Tap tap nap.", ["tap", "nap"], 1, "decodable", "Say nap like a sleepy word."),
  S("The pin is in.", ["pin", "in"], 1, "decodable", "Pin ends with n."),
  S("Pat the cat.", ["Pat", "cat"], 1, "sight-word-supported", "Pat is a name sound."),
  S("The pup can nap.", ["pup", "nap"], 2, "decodable", "Pup is like cup."),
  S("Dad can tap.", ["Dad", "tap"], 2, "sight-word-supported", "Dad is a helper word."),
  S("Mom can sit.", ["Mom", "sit"], 2, "sight-word-supported", "Sit ends with t."),
  S("The mat is flat.", ["mat", "flat"], 2, "sight-word-supported", "Flat rhymes with mat."),
  S("A fat rat ran.", ["fat", "rat", "ran"], 2, "decodable", "Ran is in the -an family."),
  S("The fan is on.", ["fan", "on"], 2, "sight-word-supported", "On is a tiny sight word."),
  S("I can hop.", ["can", "hop"], 2, "sight-word-supported", "Hop is a jump."),
  S("The dog can hop.", ["dog", "hop"], 2, "decodable", "Dog is in -og."),
  S("The bug is on the rug.", ["bug", "rug"], 3, "decodable", "Rug is soft."),
  S("The hen is in the pen.", ["hen", "pen"], 3, "decodable", "Hen is a bird."),
  S("The bed is red.", ["bed", "red"], 3, "decodable", "Red is a color word."),
  S("Men can run.", ["Men", "run"], 3, "sight-word-supported", "Men ends with n."),
  S("The fog hid the log.", ["fog", "log"], 3, "decodable", "Fog is like clouds."),
  S("Pop the top.", ["Pop", "top"], 3, "decodable", "Top is up."),
  S("Mop the mess.", ["Mop", "mess"], 3, "sight-word-supported", "Mess is okay to guess."),
  S("A tin can.", ["tin", "can"], 2, "decodable", "Tin is metal."),
  S("I can win.", ["can", "win"], 2, "sight-word-supported", "Win is fun."),
  S("The fin is on the fish.", ["fin"], 3, "sight-word-supported", "Fish is a picture word."),
  S("Sit on it.", ["Sit"], 2, "sight-word-supported", "It is tiny."),
  S("A bit of jam.", ["bit", "jam"], 3, "sight-word-supported", "Jam is sweet."),
  S("Fit the lid.", ["Fit", "lid"], 3, "sight-word-supported", "Fit means just right."),
  S("Do not hit.", ["hit", "not"], 3, "sight-word-supported", "Not is a stop word."),
  S("The sun is up.", ["sun", "up"], 3, "sight-word-supported", "Up goes high."),
  S("We had fun.", ["fun", "had"], 3, "sight-word-supported", "Had is past fun."),
  S("I can run fast.", ["run", "can"], 3, "sight-word-supported", "Fast is speedy."),
  S("The cup is full.", ["cup", "full"], 3, "sight-word-supported", "Full means lots."),
  S("Sip it slow.", ["Sip", "slow"], 3, "sight-word-supported", "Slow is calm."),
  S("The fox ran.", ["fox", "ran"], 3, "decodable", "Fox is quick."),
  S("The box can tip.", ["box", "tip"], 4, "sight-word-supported", "Tip can mean fall."),
  S("Mom and Dad hug.", ["Mom", "Dad", "hug"], 4, "sight-word-supported", "Hug is love."),
  S("The pig is big.", ["pig", "big"], 4, "decodable", "Big is huge."),
  S("I can dig in mud.", ["dig", "mud"], 4, "sight-word-supported", "Mud is wet dirt."),
  S("The jet is up.", ["jet", "up"], 4, "sight-word-supported", "Jet flies high."),
  S("The vet can help.", ["vet", "help"], 4, "sight-word-supported", "Help is kind."),
  S("Six dots on it.", ["Six", "dots"], 4, "sight-word-supported", "Six is a number."),
  S("Mix and sip.", ["Mix", "sip"], 4, "sight-word-supported", "Mix stirs up."),
  S("The ram ran.", ["ram", "ran"], 4, "decodable", "Ram is a sheep."),
  S("The pup got mud.", ["pup", "mud"], 3, "decodable", "Mud is messy fun."),
  S("Dad has a hat.", ["Dad", "hat"], 2, "sight-word-supported", "Hat goes on head."),
  S("Mom has a map.", ["Mom", "map"], 2, "sight-word-supported", "Map shows paths."),
  S("The bat can nap.", ["bat", "nap"], 2, "decodable", "Bat sleeps upside down."),
  S("A cat in a hat.", ["cat", "hat"], 2, "decodable", "Silly hat time."),
  S("The rat sat.", ["rat", "sat"], 2, "decodable", "Sat is past sit."),
  S("Tap the lap.", ["tap", "lap"], 2, "decodable", "Lap is your legs."),
  S("The pan is hot.", ["pan", "hot"], 3, "sight-word-supported", "Hot means careful."),
  S("A man can run.", ["man", "run"], 3, "sight-word-supported", "Man is a grown-up."),
  S("The can is tin.", ["can", "tin"], 3, "decodable", "Tin can rattle."),
  S("I see a fin.", ["see", "fin"], 3, "sight-word-supported", "See with your eyes."),
  S("Sit by Mom.", ["Sit", "Mom"], 3, "sight-word-supported", "By means near."),
  S("The log is big.", ["log", "big"], 3, "decodable", "Log is wood."),
  S("Hop on top.", ["Hop", "top"], 3, "decodable", "Top is the best spot."),
  S("A bug can hug.", ["bug", "hug"], 3, "decodable", "Hug is gentle."),
  S("The mug is red.", ["mug", "red"], 3, "decodable", "Mug holds milk."),
  S("Fed the hen.", ["Fed", "hen"], 3, "sight-word-supported", "Fed means gave food."),
  S("The pen is in the cup.", ["pen", "cup"], 3, "decodable", "Pen writes."),
  S("Fog on the log.", ["Fog", "log"], 3, "decodable", "Fog feels damp."),
  S("Pop and hop.", ["Pop", "hop"], 3, "decodable", "Pop goes pop."),
  S("The mop is wet.", ["mop", "wet"], 3, "sight-word-supported", "Wet is watery."),
  S("A sad pup.", ["sad", "pup"], 4, "sight-word-supported", "Sad is okay."),
  S("Dad is not mad.", ["Dad", "mad", "not"], 4, "sight-word-supported", "Not mad is good."),
  S("Jog with Dad.", ["Jog", "Dad"], 4, "sight-word-supported", "Jog is slow run."),
  S("Mom can mix.", ["Mom", "mix"], 4, "sight-word-supported", "Mix in the cup."),
  S("The web is big.", ["web", "big"], 4, "decodable", "Web is stringy."),
  S("Rip it not.", ["Rip", "not"], 4, "sight-word-supported", "Rip means tear."),
  S("Tip the cup.", ["Tip", "cup"], 4, "decodable", "Tip it slow."),
  S("The lamp is dim.", ["lamp", "dim"], 4, "sight-word-supported", "Dim is soft light."),
  S("The cod is in the net.", ["cod", "net"], 4, "decodable", "Net catches fish."),
  S("The rod can fit.", ["rod", "fit"], 4, "sight-word-supported", "Fit in the box."),
  S("Do not rob.", ["rob", "not"], 4, "sight-word-supported", "Rob is not kind."),
  S("The wig is fun.", ["wig", "fun"], 4, "decodable", "Wig is silly hair."),
  S("A dot on the map.", ["dot", "map"], 2, "decodable", "Dot is tiny."),
  S("The cot is soft.", ["cot", "soft"], 2, "sight-word-supported", "Cot is a bed."),
  S("Pat and tap.", ["Pat", "tap"], 1, "decodable", "Pat is gentle."),
  S("A nap in the sun.", ["nap", "sun"], 3, "sight-word-supported", "Sun is warm."),
  S("The cat can nap.", ["cat", "nap"], 1, "decodable", "Cats love naps."),
  S("Sam can tap.", ["Sam", "tap"], 1, "sight-word-supported", "Sam is a name."),
  S("The mat can fit.", ["mat", "fit"], 3, "decodable", "Fit on the floor."),
  S("A pin on a cap.", ["pin", "cap"], 2, "decodable", "Pin is sharp."),
  S("The fan can spin.", ["fan", "spin"], 4, "sight-word-supported", "Spin goes round."),
  S("Mom ran.", ["Mom", "ran"], 2, "sight-word-supported", "Ran is fast."),
  S("Dad sat.", ["Dad", "sat"], 2, "sight-word-supported", "Sat is rest."),
  S("The bug ran.", ["bug", "ran"], 3, "decodable", "Bugs can run."),
  S("A hug from Mom.", ["hug", "Mom"], 4, "sight-word-supported", "Hugs feel good."),
  S("The dog sat.", ["dog", "sat"], 2, "decodable", "Good dog."),
  S("The cat is mad.", ["cat", "mad"], 4, "sight-word-supported", "Mad cat is silly."),
  S("Fun with Dad.", ["Fun", "Dad"], 3, "sight-word-supported", "Dad time is fun."),
  S("The pig sat in mud.", ["pig", "sat", "mud"], 4, "sight-word-supported", "Mud is squishy."),
  S("Hop to the mat.", ["Hop", "mat"], 2, "decodable", "Hop one two."),
  S("The top can pop.", ["top", "pop"], 3, "decodable", "Pop like popcorn."),
  S("A red cap.", ["red", "cap"], 2, "decodable", "Red cap on."),
  S("The hen can hop.", ["hen", "hop"], 3, "decodable", "Hen can hop a bit."),
  S("Men can dig.", ["Men", "dig"], 4, "sight-word-supported", "Dig with care."),
  S("The bed is big.", ["bed", "big"], 3, "decodable", "Big cozy bed."),
  S("Fed the pup.", ["Fed", "pup"], 3, "sight-word-supported", "Fed means ate."),
  S("Fog hid the dog.", ["Fog", "dog"], 3, "sight-word-supported", "Fog is gray."),
  S("The rug is soft.", ["rug", "soft"], 3, "sight-word-supported", "Soft is cozy."),
  S("A tin pin.", ["tin", "pin"], 3, "decodable", "Tin is shiny."),
  S("Win the cup.", ["Win", "cup"], 3, "sight-word-supported", "Win is play fun."),
  S("Sit on the mat.", ["Sit", "mat"], 2, "sight-word-supported", "Mat is for sitting."),
  S("A bit of mud.", ["bit", "mud"], 4, "sight-word-supported", "Mud pie pretend."),
  S("Fit on the lap.", ["Fit", "lap"], 3, "decodable", "Lap is safe."),
  S("The sun can set.", ["sun", "set"], 4, "sight-word-supported", "Set means go down."),
  S("The fox is red.", ["fox", "red"], 3, "decodable", "Fox fur is red."),
  S("The jet can hop up.", ["jet", "hop", "up"], 4, "sight-word-supported", "Up up up."),
  S("The vet fed the pup.", ["vet", "fed", "pup"], 4, "sight-word-supported", "Vet helps pups."),
  S("Six bugs on a log.", ["Six", "bugs", "log"], 4, "sight-word-supported", "Count the bugs."),
  S("Mix jam in the mug.", ["Mix", "jam", "mug"], 4, "sight-word-supported", "Jam is sticky."),
  S("The ram had a nap.", ["ram", "nap", "had"], 4, "sight-word-supported", "Nap time."),
  S("Sad pup sat.", ["Sad", "pup", "sat"], 4, "sight-word-supported", "Cheer up pup."),
  S("Dad can jog.", ["Dad", "jog"], 4, "sight-word-supported", "Jog with Dad."),
  S("Mom can sip.", ["Mom", "sip"], 4, "sight-word-supported", "Sip warm milk."),
  S("The web hid a bug.", ["web", "bug"], 4, "decodable", "Bug on web."),
  S("Tip the mop.", ["Tip", "mop"], 4, "decodable", "Mop the mess."),
  S("The dim lamp sat.", ["dim", "lamp", "sat"], 4, "sight-word-supported", "Dim is sleepy."),
  S("Cod in the net.", ["Cod", "net"], 4, "decodable", "Fish in net."),
  S("Rod and tin can.", ["Rod", "tin", "can"], 4, "sight-word-supported", "Camp trip gear."),
  S("The wig sat on the hat.", ["wig", "hat", "sat"], 4, "sight-word-supported", "Silly hat stack."),
  S("A fat cat sat.", ["fat", "cat", "sat"], 2, "decodable", "Fat cat nap."),
  S("The map led to the mat.", ["map", "mat", "led"], 4, "sight-word-supported", "Led means showed the way."),
];

export function wordsForReadingLevel(activeReadingLevel) {
  return filterByMaxLevel(WORDS, activeReadingLevel);
}

export function sentencesForReadingLevel(activeReadingLevel) {
  return filterByMaxLevel(SENTENCE_BANK, activeReadingLevel);
}
