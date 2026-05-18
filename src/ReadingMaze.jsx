import React, { useCallback, useEffect, useRef, useState } from "react";
import { createGameSession } from "./lib/difficulty.js";
import { enrichMazeLayout, speakCheckpointClue } from "./lib/mazePrompts.js";
import {
  cellSizeClassForTier,
  mainPathSegment,
  MAZE_TIER_LABELS,
  pickMazeLayoutForLevel,
} from "./data/mazeLayouts.js";
import {
  cancelSpeech,
  clearScheduledTimers,
  scheduleAudio,
  speakText,
  TTS_AFTER_PHRASE_GAP_MS,
} from "./lib/questAudio.js";

const MAZE_WIN_PHRASE = ["You finished the maze!", "Amazing reading path!", "Maze champion!"];
const WALK_STEP_MS = 280;
const WRONG_END_PAUSE_MS = 900;

/** @typedef {"moving"|"waitingForAnswer"|"wrongBranchMoving"|"returningToCheckpoint"|"completed"} MazePhase */

function pickRandom(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function BranchingMazeGrid({ layout, birdCell, cellSizeClass }) {
  const { rows, cols, cellGrid } = layout;
  const [br, bc] = birdCell;

  return (
    <div
      className={`maze-grid mx-auto rounded-2xl border-2 border-slate-900 bg-slate-900 p-1.5 shadow-inner ${cellSizeClass}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="img"
      aria-label="Branching reading maze"
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const type = cellGrid[r][c];
          const isBird = br === r && bc === c;
          let cellClass =
            "flex items-center justify-center rounded-md border border-slate-900/40 text-center font-black leading-none ";
          let content = "";

          if (type === "wall") {
            cellClass += "bg-slate-900";
          } else if (type === "checkpoint") {
            cellClass += "bg-orange-400 text-white";
            content = isBird ? "🐦" : "?";
          } else if (type === "deadEnd") {
            cellClass += "bg-amber-900 text-[0.45rem] text-white sm:text-[0.55rem]";
            content = isBird ? "🐦" : "BACK ↪";
          } else if (type === "finish") {
            cellClass += "bg-emerald-200";
            content = isBird ? "🐦" : "⭐";
          } else {
            cellClass += "bg-amber-50";
            content = isBird ? "🐦" : "";
          }

          return (
            <div key={`${r}-${c}`} className={cellClass}>
              <span className="select-none">{content}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

export function ReadingMaze({ logWin, logAttempt, playerLevel, activeReadingLevel, readingTheme }) {
  const sessionRef = useRef(createGameSession());
  const roundTokenRef = useRef(0);
  const layoutRef = useRef(null);
  const lastLayoutIdRef = useRef(null);

  const [layout, setLayout] = useState(() => {
    const picked = pickMazeLayoutForLevel(playerLevel, lastLayoutIdRef.current);
    lastLayoutIdRef.current = picked.id;
    const enriched = enrichMazeLayout(picked, { level: playerLevel }, sessionRef.current.getStats());
    layoutRef.current = enriched;
    return enriched;
  });

  const [birdCell, setBirdCell] = useState(layout.mainPath[0]);
  const [mainPathIndex, setMainPathIndex] = useState(0);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  /** @type {[MazePhase, React.Dispatch<React.SetStateAction<MazePhase>>]} */
  const [phase, setPhase] = useState("moving");
  const [result, setResult] = useState(null);
  const [prompt, setPrompt] = useState(layout.checkpoints[0]?.prompt ?? null);

  const cellSizeClass = cellSizeClassForTier(layout.tier);
  const tierLabel = MAZE_TIER_LABELS[layout.tier];
  const totalCheckpoints = layout.checkpoints.length;
  const busy = phase !== "waitingForAnswer" && phase !== "completed";

  const isTokenAlive = useCallback((token) => roundTokenRef.current === token, []);

  const walkCells = useCallback((cells, token, onDone, stepMs = WALK_STEP_MS) => {
    let i = 0;
    const step = () => {
      if (!isTokenAlive(token)) return;
      if (i >= cells.length) {
        onDone?.();
        return;
      }
      const [r, c] = cells[i];
      setBirdCell([r, c]);
      const pathIdx = layoutRef.current.mainPath.findIndex((p) => p[0] === r && p[1] === c);
      if (pathIdx >= 0) setMainPathIndex(pathIdx);
      i += 1;
      scheduleAudio(step, stepMs);
    };
    step();
  }, [isTokenAlive]);

  const beginCheckpoint = useCallback(
    (cpIdx, token) => {
      const cp = layoutRef.current.checkpoints[cpIdx];
      if (!cp) return;
      setCheckpointIndex(cpIdx);
      setMainPathIndex(cp.mainPathIndex);
      setBirdCell(cp.cell);
      setPrompt(cp.prompt);
      setPhase("waitingForAnswer");
      speakCheckpointClue(cp.prompt, () => {
        if (!isTokenAlive(token)) return;
      });
    },
    [isTokenAlive]
  );

  const walkToCheckpoint = useCallback(
    (cpIdx, fromIndex, token) => {
      const cp = layoutRef.current.checkpoints[cpIdx];
      if (!cp) return;
      setPhase("moving");
      const segment = mainPathSegment(layoutRef.current, fromIndex, cp.mainPathIndex);
      walkCells(segment, token, () => {
        if (!isTokenAlive(token)) return;
        beginCheckpoint(cpIdx, token);
      });
    },
    [beginCheckpoint, isTokenAlive, walkCells]
  );

  const walkToFinish = useCallback(
    (fromIndex, token) => {
      setPhase("moving");
      const last = layoutRef.current.mainPath.length - 1;
      const segment = mainPathSegment(layoutRef.current, fromIndex, last);
      walkCells(segment, token, () => {
        if (!isTokenAlive(token)) return;
        setPhase("completed");
        const praise = pickRandom(MAZE_WIN_PHRASE);
        setResult({ type: "good", text: `${praise} +1 star!` });
        logWin("maze");
        speakText(praise, 0.78);
      });
    },
    [isTokenAlive, logWin, walkCells]
  );

  const startMazeNavigation = useCallback(
    (token) => {
      const enriched = layoutRef.current;
      if (!enriched) return;
      const firstCp = enriched.checkpoints[0];
      if (!firstCp) {
        walkToFinish(0, token);
        return;
      }
      if (firstCp.mainPathIndex === 0) {
        beginCheckpoint(0, token);
      } else {
        walkToCheckpoint(0, 0, token);
      }
    },
    [beginCheckpoint, walkToCheckpoint, walkToFinish]
  );

  const resetMazeRun = useCallback(() => {
    const picked = pickMazeLayoutForLevel(playerLevel, lastLayoutIdRef.current);
    lastLayoutIdRef.current = picked.id;
    const enriched = enrichMazeLayout(picked, { level: playerLevel }, sessionRef.current.getStats());
    layoutRef.current = enriched;
    setLayout(enriched);
    setBirdCell(enriched.mainPath[0]);
    setMainPathIndex(0);
    setCheckpointIndex(0);
    setPrompt(enriched.checkpoints[0]?.prompt ?? null);
    setResult(null);
    setPhase("moving");
    return enriched;
  }, [playerLevel]);

  useEffect(() => {
    const token = ++roundTokenRef.current;
    clearScheduledTimers();
    cancelSpeech();
    resetMazeRun();
    speakText("Welcome to Reading Maze. Listen to each clue and tap the right word.", 0.72, () => {
      if (!isTokenAlive(token)) return;
      startMazeNavigation(token);
    });
    return () => clearScheduledTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when level tier changes
  }, [playerLevel]);

  useEffect(() => () => clearScheduledTimers(), []);

  const handleCorrect = (token) => {
    const cpIdx = checkpointIndex;
    const nextCpIdx = cpIdx + 1;
    setResult({ type: "good", text: "Yes! Keep going!" });

    speakText("Yes!", 0.78, () => {
      if (!isTokenAlive(token)) return;
      setResult(null);
      const currentCp = layoutRef.current.checkpoints[cpIdx];
      const fromIdx = currentCp.mainPathIndex;

      if (nextCpIdx >= layoutRef.current.checkpoints.length) {
        walkToFinish(fromIdx, token);
        return;
      }

      const nextCp = layoutRef.current.checkpoints[nextCpIdx];
      setPhase("moving");
      const segment = mainPathSegment(layoutRef.current, fromIdx, nextCp.mainPathIndex);
      walkCells(segment, token, () => {
        if (!isTokenAlive(token)) return;
        beginCheckpoint(nextCpIdx, token);
      });
    });
  };

  const handleWrong = (choice, token) => {
    const cp = layoutRef.current.checkpoints[checkpointIndex];
    const branch = cp.wrongBranchPaths[choice.wrongPathIndex] || cp.wrongBranchPaths[0];
    if (!branch?.length) {
      speakText("Try again.", 0.72, () => {
        if (!isTokenAlive(token)) return;
        speakCheckpointClue(cp.prompt);
      });
      return;
    }

    setPhase("wrongBranchMoving");
    walkCells(branch, token, () => {
      if (!isTokenAlive(token)) return;
      speakText("Try again.", 0.72, () => {
        if (!isTokenAlive(token)) return;
        scheduleAudio(() => {
          if (!isTokenAlive(token)) return;
          setPhase("returningToCheckpoint");
          const backPath = [...branch].reverse();
          walkCells(backPath, token, () => {
            if (!isTokenAlive(token)) return;
            beginCheckpoint(checkpointIndex, token);
          });
        }, WRONG_END_PAUSE_MS);
      });
    });
  };

  const choose = (choice) => {
    if (phase !== "waitingForAnswer" || !prompt) return;
    logAttempt();
    const token = roundTokenRef.current;
    cancelSpeech();
    clearScheduledTimers();

    if (choice.isCorrect || choice.word === prompt.correct) {
      sessionRef.current.recordAttempt(true);
      handleCorrect(token);
    } else {
      sessionRef.current.recordAttempt(false);
      handleWrong(choice, token);
    }
  };

  const hearClue = () => {
    if (phase !== "waitingForAnswer" || !prompt) return;
    cancelSpeech();
    clearScheduledTimers();
    speakCheckpointClue(prompt);
  };

  const newMaze = () => {
    const token = ++roundTokenRef.current;
    cancelSpeech();
    clearScheduledTimers();
    resetMazeRun();
    speakText("A new maze! Listen and tap the right word.", 0.72, () => {
      if (!isTokenAlive(token)) return;
      startMazeNavigation(token);
    });
  };

  const checkpointNum = Math.min(checkpointIndex + 1, totalCheckpoints);

  return (
    <div className="rq-page mx-auto max-w-4xl px-4 pb-10">
      {result && (
        <div
          className={`rq-pop fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-slate-900 px-5 py-3 text-lg font-black shadow-xl ${
            result.type === "good" ? "bg-emerald-200" : "bg-rose-100"
          }`}
        >
          {result.text}
        </div>
      )}

      <div className="rounded-[2rem] border-2 border-slate-900 bg-indigo-50 p-4 text-center shadow-[0_8px_0_rgba(15,23,42,1)] sm:p-5">
        <p className="text-lg font-black text-indigo-900">Reading Maze</p>
        <p className="mt-1 text-sm font-bold text-slate-600">
          {tierLabel} • Checkpoint {checkpointNum} of {totalCheckpoints}
        </p>
        <div className="maze-grid-wrap mt-4 flex justify-center">
          <BranchingMazeGrid layout={layout} birdCell={birdCell} cellSizeClass={cellSizeClass} />
        </div>
      </div>

      <div className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        {phase !== "completed" ? (
          <>
            <p className="text-xl font-black text-slate-800">
              {prompt?.displayBlank ?? "Listen to the clue…"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(prompt?.choices ?? []).map((choice) => (
                <button
                  key={choice.word}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(choice)}
                  className="rq-button rounded-2xl border-2 border-slate-900 bg-amber-50 px-3 py-4 text-2xl font-black uppercase shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
                >
                  {choice.word}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={hearClue}
              disabled={busy}
              className="rq-button mt-4 rounded-full border-2 border-slate-900 bg-sky-100 px-5 py-3 font-black shadow-[0_3px_0_rgba(15,23,42,1)] disabled:opacity-50"
            >
              🔊 Hear clue again
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className="text-3xl font-black">You reached the star! ⭐</p>
            <button
              type="button"
              onClick={newMaze}
              className="rq-button mt-4 rounded-2xl border-2 border-slate-900 bg-indigo-100 px-6 py-4 text-xl font-black shadow-[0_4px_0_rgba(15,23,42,1)]"
            >
              Play again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
