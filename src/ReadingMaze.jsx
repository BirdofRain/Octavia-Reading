import React, { useEffect, useMemo, useRef, useState } from "react";
import { createGameSession } from "./lib/difficulty.js";
import { buildMazePrompt } from "./lib/mazePrompts.js";
import { mazeLayoutForLevel, buildMazeWallGrid } from "./data/mazeLayouts.js";
import {
  cancelSpeech,
  clearScheduledTimers,
  scheduleAudio,
  speakText,
  TTS_AFTER_PHRASE_GAP_MS,
} from "./lib/questAudio.js";

const MAZE_ENCOURAGEMENT = ["Great try!", "You can do it!", "Almost — listen again.", "Good effort!"];

const MAZE_WIN_PHRASE = ["You finished the maze!", "Amazing reading path!", "Maze champion!"];

function pickRandom(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function MazeGrid({ layout, stepIndex, walls }) {
  const { path, rows, cols } = layout;
  const player = path[Math.min(stepIndex, path.length - 1)];
  const goal = path[path.length - 1];

  return (
    <div
      className="mx-auto inline-grid gap-1 rounded-2xl border-2 border-slate-900 bg-slate-800 p-2 shadow-inner"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.5rem, 1fr))` }}
      role="img"
      aria-label="Reading maze path"
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const isWall = walls[r][c];
          const isPlayer = player && player[0] === r && player[1] === c;
          const isGoal = goal[0] === r && goal[1] === c;
          let content = "";
          let cellClass = "aspect-square rounded-lg ";
          if (isWall) {
            cellClass += "bg-slate-700";
          } else if (isPlayer) {
            cellClass += "bg-amber-200 rq-bounce text-2xl";
            content = "🐦";
          } else if (isGoal && stepIndex >= path.length - 1) {
            cellClass += "bg-emerald-300 text-xl";
            content = "⭐";
          } else if (isGoal) {
            cellClass += "bg-emerald-100/80 text-lg opacity-80";
            content = "🏁";
          } else {
            cellClass += "bg-amber-50/90";
          }
          return (
            <div key={`${r}-${c}`} className={cellClass}>
              <span className="grid h-full w-full place-items-center">{content}</span>
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
  const [sessionTick, setSessionTick] = useState(0);

  const progressSlice = useMemo(
    () => ({ level: playerLevel, settings: { activeReadingLevel, readingTheme } }),
    [playerLevel, activeReadingLevel, readingTheme]
  );
  const sessionStats = useMemo(() => sessionRef.current.getStats(), [sessionTick]);
  const layout = useMemo(() => mazeLayoutForLevel(playerLevel), [playerLevel]);
  const walls = useMemo(() => buildMazeWallGrid(layout), [layout]);

  const [stepIndex, setStepIndex] = useState(0);
  const [prompt, setPrompt] = useState(() => buildMazePrompt(progressSlice, sessionStats, 0));
  const [result, setResult] = useState(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);

  const totalSteps = layout.path.length;
  const atGoal = stepIndex >= totalSteps - 1;

  const recordSession = (ok) => {
    sessionRef.current.recordAttempt(ok);
    setSessionTick((t) => t + 1);
  };

  const loadPrompt = (step) => {
    const nextPrompt = buildMazePrompt(progressSlice, sessionRef.current.getStats(), step);
    setPrompt(nextPrompt);
    return nextPrompt;
  };

  useEffect(() => {
    const token = ++roundTokenRef.current;
    clearScheduledTimers();
    setStepIndex(0);
    setFinished(false);
    setResult(null);
    setBusy(false);
    loadPrompt(0);
    scheduleAudio(() => {
      if (roundTokenRef.current !== token) return;
      speakText("Welcome to Reading Maze. Answer each clue to move forward.", 0.72);
    }, 400);
    return () => clearScheduledTimers();
  }, [layout.label, playerLevel]);

  useEffect(() => () => clearScheduledTimers(), []);

  const choose = (word) => {
    if (busy || finished || atGoal) return;
    logAttempt();
    setBusy(true);
    const tokenAt = roundTokenRef.current;

    if (word === prompt.correct) {
      recordSession(true);
      const next = stepIndex + 1;
      setResult({ type: "good", text: "Yes! Step forward!" });

      if (next >= totalSteps - 1) {
        setStepIndex(totalSteps - 1);
        setFinished(true);
        const praise = pickRandom(MAZE_WIN_PHRASE);
        logWin("maze");
        speakText(praise, 0.78, () => {
          if (roundTokenRef.current !== tokenAt) return;
          setBusy(false);
          setResult({ type: "good", text: `${praise} +1 star!` });
        });
        return;
      }

      speakText("Yes!", 0.78, () => {
        if (roundTokenRef.current !== tokenAt) return;
        setStepIndex(next);
        const nextPrompt = loadPrompt(next);
        setBusy(false);
        setResult(null);
        scheduleAudio(() => {
          if (roundTokenRef.current !== tokenAt) return;
          speakText(nextPrompt.speakHint || nextPrompt.correct, 0.7);
        }, TTS_AFTER_PHRASE_GAP_MS);
      });
    } else {
      recordSession(false);
      const gentle = pickRandom(MAZE_ENCOURAGEMENT);
      setResult({ type: "try", text: gentle });
      speakText(gentle, 0.72, () => {
        if (roundTokenRef.current !== tokenAt) return;
        setBusy(false);
        scheduleAudio(() => setResult(null), 1200);
      });
    }
  };

  const hearClue = () => {
    if (busy) return;
    clearScheduledTimers();
    cancelSpeech();
    if (prompt.sentenceText) {
      speakText(prompt.sentenceText, 0.68);
    } else {
      speakText(prompt.speakHint || prompt.correct, 0.72);
    }
  };

  const newMaze = () => {
    const token = ++roundTokenRef.current;
    clearScheduledTimers();
    cancelSpeech();
    setStepIndex(0);
    setFinished(false);
    setResult(null);
    setBusy(false);
    loadPrompt(0);
    scheduleAudio(() => {
      if (roundTokenRef.current !== token) return;
      speakText("A new maze! Listen and tap the right word.", 0.72);
    }, TTS_AFTER_PHRASE_GAP_MS);
  };

  return (
    <div className="rq-page mx-auto max-w-3xl px-4 pb-10">
      {result && (
        <div
          className={`rq-pop fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-slate-900 px-5 py-3 text-lg font-black shadow-xl ${
            result.type === "good" ? "bg-emerald-200" : "bg-rose-100"
          }`}
        >
          {result.text}
        </div>
      )}

      <div className="rounded-[2rem] border-2 border-slate-900 bg-indigo-50 p-5 text-center shadow-[0_8px_0_rgba(15,23,42,1)]">
        <p className="text-lg font-black text-indigo-900">Reading Maze</p>
        <p className="mt-1 text-sm font-bold text-slate-600">
          {layout.label} path • Step {Math.min(stepIndex + 1, totalSteps)} of {totalSteps}
        </p>
        <div className="mt-4 overflow-x-auto">
          <MazeGrid layout={layout} stepIndex={stepIndex} walls={walls} />
        </div>
      </div>

      <div className="mt-6 rounded-[2rem] border-2 border-slate-900 bg-white p-5 shadow-[0_6px_0_rgba(15,23,42,1)]">
        {!finished ? (
          <>
            <p className="text-xl font-black text-slate-800">{prompt.prompt}</p>
            {prompt.emoji && (
              <p className="mt-2 text-5xl" aria-hidden>
                {prompt.emoji}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {prompt.choices.map((w) => (
                <button
                  key={w}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(w)}
                  className="rq-button rounded-2xl border-2 border-slate-900 bg-amber-50 px-3 py-4 text-2xl font-black uppercase shadow-[0_4px_0_rgba(15,23,42,1)] disabled:opacity-50"
                >
                  {w}
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
