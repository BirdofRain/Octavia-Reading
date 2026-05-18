import { warnIfMazeLayoutInvalid } from "../lib/mazeLayoutValidator.js";

/**
 * Branching reading maze layouts: hand-authored zigzag main paths.
 * Wrong branches are generated perpendicular side paths (never long lanes).
 * @typedef {"wall"|"path"|"start"|"checkpoint"|"deadEnd"|"finish"} MazeCellType
 * @typedef {[number, number]} Cell
 */

/** @typedef {"starter"|"explorer"|"champion"} MazeTier */

/**
 * @typedef {object} MazeCheckpointDef
 * @property {string} id
 * @property {Cell} cell
 * @property {number} mainPathIndex
 * @property {Cell[][]} wrongBranchPaths
 */

/**
 * @typedef {object} BranchingMazeLayout
 * @property {string} id
 * @property {MazeTier} tier
 * @property {string} label
 * @property {number} rows
 * @property {number} cols
 * @property {Cell} start
 * @property {Cell} finish
 * @property {Cell[]} mainPath
 * @property {MazeCheckpointDef[]} checkpoints
 * @property {MazeCellType[][]} cellGrid
 */

export const MAZE_TIER_LABELS = {
  starter: "Starter",
  explorer: "Explorer",
  champion: "Champion",
};

/** @type {Record<MazeTier, BranchingMazeLayout[]>} */
export const MAZE_LAYOUTS_BY_TIER = {
  starter: [buildStarterA(), buildStarterB()],
  explorer: [buildExplorerA(), buildExplorerB()],
  champion: [buildChampionA()],
};

function cell(r, c) {
  return [r, c];
}

function cellKey(r, c) {
  return `${r},${c}`;
}

/** @param {number} r @param {number} c @param {number} rows @param {number} cols */
function neighborsInBounds(r, c, rows, cols) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < rows && nc < cols);
}

/**
 * Build up to three short wrong branches from free cells beside a checkpoint.
 * @param {Cell} cpCell
 * @param {Cell[]} mainPath
 * @param {number} rows
 * @param {number} cols
 * @returns {Cell[][]}
 */
function generateWrongBranches(cpCell, mainPath, rows, cols) {
  const mainSet = new Set(mainPath.map(([r, c]) => cellKey(r, c)));
  const starters = neighborsInBounds(cpCell[0], cpCell[1], rows, cols).filter(
    ([r, c]) => !mainSet.has(cellKey(r, c))
  );

  /** @type {Cell[][]} */
  const branches = [];
  const used = new Set();

  const tryBranch = (startIdx, turnBias) => {
    const start = starters[startIdx % starters.length];
    if (!start) return;
    const sk = cellKey(start[0], start[1]);
    if (used.has(sk)) return;
    used.add(sk);

    const branch = [start];
    let [r, c] = start;
    let prev = cpCell;

    for (let step = 0; step < 2; step += 1) {
      const opts = neighborsInBounds(r, c, rows, cols).filter(([nr, nc]) => {
        const k = cellKey(nr, nc);
        if (mainSet.has(k)) return false;
        if (cellKey(prev[0], prev[1]) === k) return false;
        if (branch.some(([br, bc]) => br === nr && bc === nc)) return false;
        return true;
      });
      if (!opts.length) break;
      const scored = opts.map((opt) => {
        const dr = opt[0] - r;
        const dc = opt[1] - c;
        const score = dr === turnBias[0] && dc === turnBias[1] ? 2 : 1;
        return { opt, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const next = scored[0].opt;
      branch.push(next);
      prev = [r, c];
      [r, c] = next;
    }

    if (branch.length >= 1) branches.push(branch);
  };

  tryBranch(0, [0, 1]);
  tryBranch(1, [1, 0]);
  tryBranch(2, [0, -1]);
  tryBranch(0, [-1, 0]);

  return branches.slice(0, 3);
}

function buildCellGrid(rows, cols, mainPath, checkpoints) {
  const cellGrid = Array.from({ length: rows }, () => Array(cols).fill("wall"));
  for (const [r, c] of mainPath) {
    cellGrid[r][c] = "path";
  }
  const start = mainPath[0];
  const finish = mainPath[mainPath.length - 1];
  cellGrid[start[0]][start[1]] = "start";
  cellGrid[finish[0]][finish[1]] = "finish";

  for (const cp of checkpoints) {
    cellGrid[cp.cell[0]][cp.cell[1]] = "checkpoint";
    for (const branch of cp.wrongBranchPaths) {
      for (let i = 0; i < branch.length; i += 1) {
        const [r, c] = branch[i];
        const isDead = i === branch.length - 1;
        if (cellGrid[r][c] === "checkpoint") continue;
        cellGrid[r][c] = isDead ? "deadEnd" : "path";
      }
    }
  }
  return cellGrid;
}

/**
 * @param {string} id
 * @param {MazeTier} tier
 * @param {string} label
 * @param {number} rows
 * @param {number} cols
 * @param {Cell[]} mainPath
 * @param {{ id: string, cell: Cell }[]} checkpointDefs
 */
function finalizeLayout(id, tier, label, rows, cols, mainPath, checkpointDefs) {
  const checkpoints = checkpointDefs.map((def) => ({
    id: def.id,
    cell: def.cell,
    mainPathIndex: mainPath.findIndex(([r, c]) => r === def.cell[0] && c === def.cell[1]),
    wrongBranchPaths: generateWrongBranches(def.cell, mainPath, rows, cols),
  }));
  const layout = {
    id,
    tier,
    label,
    rows,
    cols,
    start: mainPath[0],
    finish: mainPath[mainPath.length - 1],
    mainPath,
    checkpoints,
    cellGrid: buildCellGrid(rows, cols, mainPath, checkpoints),
  };
  warnIfMazeLayoutInvalid(layout);
  return layout;
}

/** Starter 9×7 — S-curve */
function buildStarterA() {
  const rows = 9;
  const cols = 7;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2),
    cell(1, 2), cell(2, 2), cell(3, 2),
    cell(3, 3), cell(3, 4), cell(3, 5),
    cell(3, 4), cell(3, 3), cell(3, 2), cell(3, 1),
    cell(4, 1), cell(5, 1), cell(6, 1), cell(7, 1),
    cell(7, 2), cell(8, 2), cell(8, 3), cell(8, 4), cell(8, 5), cell(8, 6),
  ];
  return finalizeLayout("starter-a", "starter", "Starter A", rows, cols, mainPath, [
    { id: "cp1", cell: cell(0, 2) },
    { id: "cp2", cell: cell(3, 1) },
  ]);
}

/** Starter 9×7 — reverse S */
function buildStarterB() {
  const rows = 9;
  const cols = 7;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3),
    cell(1, 3), cell(2, 3), cell(3, 3),
    cell(3, 4), cell(3, 5), cell(3, 6),
    cell(4, 6), cell(5, 6), cell(6, 6),
    cell(6, 5), cell(6, 4), cell(6, 3),
    cell(7, 3), cell(8, 3),
    cell(8, 4), cell(8, 5), cell(8, 6),
  ];
  return finalizeLayout("starter-b", "starter", "Starter B", rows, cols, mainPath, [
    { id: "cp1", cell: cell(0, 3) },
    { id: "cp2", cell: cell(6, 3) },
  ]);
}

/**
 * Explorer 13×10 — serpentine through center (not border columns).
 * → ↓ ← ↓ → ↓ ← → to finish.
 */
function buildExplorerA() {
  const rows = 10;
  const cols = 13;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3),
    cell(1, 3), cell(2, 3), cell(3, 3),
    cell(3, 4), cell(4, 4), cell(5, 4),
    cell(5, 5), cell(5, 6), cell(5, 7),
    cell(6, 7), cell(7, 7), cell(8, 7),
    cell(8, 6), cell(8, 5), cell(8, 4),
    cell(9, 4), cell(9, 5), cell(9, 6), cell(9, 7),
    cell(9, 8), cell(8, 8), cell(8, 9), cell(9, 9), cell(9, 10), cell(9, 11), cell(9, 12),
  ];
  return finalizeLayout("explorer-a", "explorer", "Explorer A", rows, cols, mainPath, [
    { id: "cp1", cell: cell(0, 3) },
    { id: "cp2", cell: cell(5, 4) },
    { id: "cp3", cell: cell(9, 7) },
  ]);
}

/** Explorer 13×10 — alternate serpentine (rows 4–6 corridor) */
function buildExplorerB() {
  const rows = 10;
  const cols = 13;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3),
    cell(1, 3), cell(2, 3), cell(3, 3),
    cell(3, 4), cell(3, 5), cell(3, 6), cell(3, 7),
    cell(4, 7), cell(5, 7), cell(6, 7),
    cell(6, 6), cell(6, 5), cell(6, 4),
    cell(7, 4), cell(8, 4), cell(9, 4),
    cell(9, 5), cell(9, 6), cell(9, 7),
    cell(8, 7), cell(8, 8), cell(9, 8), cell(9, 9), cell(9, 10), cell(9, 11), cell(9, 12),
  ];
  return finalizeLayout("explorer-b", "explorer", "Explorer B", rows, cols, mainPath, [
    { id: "cp1", cell: cell(0, 3) },
    { id: "cp2", cell: cell(6, 7) },
    { id: "cp3", cell: cell(9, 7) },
  ]);
}

/** Champion 15×11 — wide serpentine */
function buildChampionA() {
  const rows = 11;
  const cols = 15;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3),
    cell(1, 3), cell(2, 3), cell(3, 3),
    cell(3, 4), cell(4, 4), cell(5, 4), cell(6, 4),
    cell(6, 5), cell(6, 6), cell(6, 7), cell(6, 8),
    cell(7, 8), cell(8, 8), cell(9, 8),
    cell(9, 7), cell(9, 6), cell(9, 5),
    cell(10, 5), cell(10, 6), cell(10, 7), cell(10, 8), cell(10, 9),
    cell(9, 9), cell(9, 10), cell(9, 11),
    cell(10, 11), cell(10, 12), cell(10, 13), cell(10, 14),
  ];
  return finalizeLayout("champion-a", "champion", "Champion", rows, cols, mainPath, [
    { id: "cp1", cell: cell(0, 3) },
    { id: "cp2", cell: cell(6, 8) },
    { id: "cp3", cell: cell(6, 4) },
    { id: "cp4", cell: cell(10, 9) },
  ]);
}

export function mazeTierForLevel(playerLevel) {
  const lv = Math.max(1, Number(playerLevel) || 1);
  if (lv >= 8) return "champion";
  if (lv >= 5) return "explorer";
  return "starter";
}

export function pickMazeLayoutForLevel(playerLevel, excludeId) {
  const tier = mazeTierForLevel(playerLevel);
  const pool = MAZE_LAYOUTS_BY_TIER[tier];
  const choices = excludeId ? pool.filter((l) => l.id !== excludeId) : pool;
  const list = choices.length ? choices : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function cellSizeClassForTier(tier) {
  if (tier === "starter") return "maze-cell-starter";
  if (tier === "explorer") return "maze-cell-explorer";
  return "maze-cell-champion";
}

export function mainPathSegment(layout, fromIndex, toIndex) {
  if (fromIndex <= toIndex) return layout.mainPath.slice(fromIndex, toIndex + 1);
  return layout.mainPath.slice(toIndex, fromIndex + 1).reverse();
}

export function getCheckpointAt(layout, checkpointIdx) {
  return layout.checkpoints[checkpointIdx];
}

export function totalCheckpoints(layout) {
  return layout.checkpoints.length;
}

/** @deprecated Use pickMazeLayoutForLevel */
export function mazeLayoutForLevel(playerLevel, excludeId) {
  return pickMazeLayoutForLevel(playerLevel, excludeId);
}

/** @deprecated */
export function buildMazeWallGrid() {
  return [];
}
