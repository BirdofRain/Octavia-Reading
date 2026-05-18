import { warnIfMazeLayoutInvalid } from "../lib/mazeLayoutValidator.js";

/**
 * Branching reading maze layouts: hand-authored winding paths only.
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

/**
 * Build cellGrid only from mainPath + wrong branches (everything else stays wall).
 * @param {number} rows
 * @param {number} cols
 * @param {Cell[]} mainPath
 * @param {MazeCheckpointDef[]} checkpoints
 */
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
 * @param {Cell[]} mainPath
 * @param {Omit<MazeCheckpointDef, "mainPathIndex">[]} checkpoints
 */
function withPathIndices(mainPath, checkpoints) {
  return checkpoints.map((cp) => {
    const mainPathIndex = mainPath.findIndex(([r, c]) => r === cp.cell[0] && c === cp.cell[1]);
    return { ...cp, mainPathIndex };
  });
}

/**
 * @param {string} id
 * @param {MazeTier} tier
 * @param {string} label
 * @param {number} rows
 * @param {number} cols
 * @param {Cell[]} mainPath
 * @param {Omit<MazeCheckpointDef, "mainPathIndex">[]} checkpoints
 */
function finalizeLayout(id, tier, label, rows, cols, mainPath, checkpoints) {
  const checkpointsWithIndex = withPathIndices(mainPath, checkpoints);
  const layout = {
    id,
    tier,
    label,
    rows,
    cols,
    start: mainPath[0],
    finish: mainPath[mainPath.length - 1],
    mainPath,
    checkpoints: checkpointsWithIndex,
    cellGrid: buildCellGrid(rows, cols, mainPath, checkpointsWithIndex),
  };
  warnIfMazeLayoutInvalid(layout);
  return layout;
}

/** Starter 9×7 — snake: start top-left, right, down, left, down, right to finish bottom-right */
function buildStarterA() {
  const rows = 9;
  const cols = 7;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4),
    cell(0, 5), cell(0, 6),
    cell(1, 6), cell(2, 6), cell(3, 6),
    cell(4, 6), cell(5, 6), cell(5, 5), cell(5, 4), cell(5, 3), cell(5, 2), cell(5, 1),
    cell(4, 1), cell(3, 1),
    cell(3, 2), cell(3, 3), cell(4, 3), cell(5, 3), cell(6, 3), cell(7, 3), cell(8, 3),
    cell(8, 4), cell(8, 5), cell(8, 6),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(0, 4),
      wrongBranchPaths: [
        [cell(1, 4), cell(2, 4)],
        [cell(1, 4), cell(1, 5), cell(2, 5)],
        [cell(1, 4), cell(1, 3), cell(2, 3)],
      ],
    },
    {
      id: "cp2",
      cell: cell(3, 1),
      wrongBranchPaths: [
        [cell(3, 0), cell(4, 0), cell(5, 0)],
        [cell(2, 1), cell(1, 1), cell(1, 0)],
        [cell(2, 1), cell(2, 0), cell(1, 0)],
      ],
    },
  ];
  return finalizeLayout("starter-a", "starter", "Starter A", rows, cols, mainPath, checkpoints);
}

/** Starter 9×7 — alternate winding route */
function buildStarterB() {
  const rows = 9;
  const cols = 7;
  const mainPath = [
    cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0),
    cell(4, 0), cell(4, 1), cell(4, 2), cell(4, 3), cell(4, 4),
    cell(5, 4), cell(6, 4),
    cell(6, 3), cell(6, 2), cell(6, 1), cell(6, 0),
    cell(7, 0), cell(8, 0),
    cell(8, 1), cell(8, 2), cell(8, 3), cell(8, 4), cell(8, 5), cell(8, 6),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(3, 0),
      wrongBranchPaths: [
        [cell(3, 1), cell(3, 2), cell(2, 2)],
        [cell(3, 1), cell(2, 1), cell(1, 1)],
        [cell(3, 1), cell(2, 1), cell(1, 1)],
      ],
    },
    {
      id: "cp2",
      cell: cell(6, 4),
      wrongBranchPaths: [
        [cell(6, 5), cell(6, 6), cell(7, 6)],
        [cell(7, 4), cell(7, 3), cell(7, 2)],
        [cell(7, 4), cell(7, 5), cell(7, 6)],
      ],
    },
  ];
  return finalizeLayout("starter-b", "starter", "Starter B", rows, cols, mainPath, checkpoints);
}

/**
 * Explorer 13×10 — winding S-path (replaces top-row + vertical column design).
 * Route: start → right along row 0 → down east side → left across middle →
 * down west side → right along bottom to finish.
 */
function buildExplorerA() {
  const rows = 10;
  const cols = 13;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4), cell(0, 5), cell(0, 6), cell(0, 7),
    cell(1, 7), cell(2, 7), cell(3, 7), cell(4, 7), cell(5, 7),
    cell(5, 6), cell(5, 5), cell(5, 4), cell(5, 3), cell(5, 2), cell(5, 1),
    cell(6, 1), cell(7, 1), cell(8, 1), cell(9, 1),
    cell(9, 2), cell(9, 3), cell(9, 4), cell(9, 5), cell(9, 6), cell(9, 7), cell(9, 8), cell(9, 9), cell(9, 10), cell(9, 11), cell(9, 12),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(0, 4),
      wrongBranchPaths: [
        [cell(1, 4), cell(2, 4), cell(3, 4)],
        [cell(1, 4), cell(1, 5), cell(2, 5), cell(3, 5)],
        [cell(1, 4), cell(1, 3), cell(2, 3), cell(3, 3)],
      ],
    },
    {
      id: "cp2",
      cell: cell(5, 3),
      wrongBranchPaths: [
        [cell(4, 3), cell(3, 3), cell(2, 3)],
        [cell(6, 3), cell(7, 3), cell(8, 3)],
        [cell(4, 3), cell(4, 2), cell(3, 2)],
      ],
    },
    {
      id: "cp3",
      cell: cell(9, 8),
      wrongBranchPaths: [
        [cell(8, 8), cell(7, 8), cell(6, 8)],
        [cell(8, 8), cell(8, 7), cell(7, 7), cell(6, 7)],
        [cell(8, 8), cell(8, 9), cell(7, 9), cell(6, 9)],
      ],
    },
  ];
  return finalizeLayout("explorer-a", "explorer", "Explorer A", rows, cols, mainPath, checkpoints);
}

/** Explorer 13×10 — mirror winding: down left edge, across, up right, across top to finish */
function buildExplorerB() {
  const rows = 10;
  const cols = 13;
  const mainPath = [
    cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0), cell(5, 0),
    cell(5, 1), cell(5, 2), cell(5, 3), cell(5, 4), cell(5, 5), cell(5, 6),
    cell(4, 6), cell(3, 6), cell(2, 6), cell(1, 6), cell(0, 6),
    cell(0, 7), cell(0, 8), cell(0, 9), cell(0, 10),
    cell(1, 10), cell(2, 10), cell(3, 10), cell(4, 10), cell(5, 10),
    cell(6, 10), cell(7, 10), cell(8, 10), cell(9, 10), cell(9, 11), cell(9, 12),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(3, 0),
      wrongBranchPaths: [
        [cell(3, 1), cell(3, 2), cell(2, 2)],
        [cell(3, 1), cell(2, 1), cell(1, 1)],
        [cell(3, 1), cell(4, 1), cell(4, 2)],
      ],
    },
    {
      id: "cp2",
      cell: cell(5, 4),
      wrongBranchPaths: [
        [cell(4, 4), cell(3, 4), cell(2, 4)],
        [cell(6, 4), cell(7, 4), cell(8, 4)],
        [cell(4, 4), cell(4, 5), cell(3, 5)],
      ],
    },
    {
      id: "cp3",
      cell: cell(0, 10),
      wrongBranchPaths: [
        [cell(0, 11), cell(1, 11), cell(2, 11)],
        [cell(0, 11), cell(0, 12), cell(1, 12)],
        [cell(0, 11), cell(1, 11), cell(1, 12)],
      ],
    },
  ];
  return finalizeLayout("explorer-b", "explorer", "Explorer B", rows, cols, mainPath, checkpoints);
}

/** Champion 15×11 — long serpentine with four checkpoints */
function buildChampionA() {
  const rows = 11;
  const cols = 15;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4), cell(0, 5), cell(0, 6), cell(0, 7), cell(0, 8),
    cell(1, 8), cell(2, 8), cell(3, 8), cell(4, 8), cell(5, 8), cell(6, 8),
    cell(6, 7), cell(6, 6), cell(6, 5), cell(6, 4), cell(6, 3), cell(6, 2), cell(6, 1), cell(6, 0),
    cell(7, 0), cell(8, 0), cell(9, 0), cell(10, 0),
    cell(10, 1), cell(10, 2), cell(10, 3), cell(10, 4), cell(10, 5), cell(10, 6), cell(10, 7), cell(10, 8), cell(10, 9), cell(10, 10), cell(10, 11), cell(10, 12), cell(10, 13), cell(10, 14),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(0, 4),
      wrongBranchPaths: [
        [cell(1, 4), cell(2, 4), cell(3, 4)],
        [cell(1, 4), cell(1, 5), cell(2, 5), cell(3, 5)],
        [cell(1, 4), cell(1, 3), cell(2, 3), cell(3, 3)],
      ],
    },
    {
      id: "cp2",
      cell: cell(6, 4),
      wrongBranchPaths: [
        [cell(5, 4), cell(4, 4), cell(3, 4)],
        [cell(7, 4), cell(8, 4), cell(9, 4)],
        [cell(5, 4), cell(5, 3), cell(5, 2), cell(4, 2)],
      ],
    },
    {
      id: "cp3",
      cell: cell(6, 0),
      wrongBranchPaths: [
        [cell(5, 0), cell(4, 0), cell(3, 0)],
        [cell(5, 0), cell(5, 1), cell(4, 1), cell(3, 1)],
        [cell(5, 0), cell(5, 1), cell(5, 2), cell(4, 2)],
      ],
    },
    {
      id: "cp4",
      cell: cell(10, 10),
      wrongBranchPaths: [
        [cell(9, 10), cell(8, 10), cell(7, 10)],
        [cell(9, 10), cell(9, 11), cell(8, 11), cell(7, 11)],
        [cell(9, 10), cell(9, 9), cell(8, 9), cell(7, 9)],
      ],
    },
  ];
  return finalizeLayout("champion-a", "champion", "Champion", rows, cols, mainPath, checkpoints);
}

/**
 * @param {number} playerLevel
 * @returns {MazeTier}
 */
export function mazeTierForLevel(playerLevel) {
  const lv = Math.max(1, Number(playerLevel) || 1);
  if (lv >= 8) return "champion";
  if (lv >= 5) return "explorer";
  return "starter";
}

/**
 * @param {number} playerLevel
 * @param {string} [excludeId]
 * @returns {BranchingMazeLayout}
 */
export function pickMazeLayoutForLevel(playerLevel, excludeId) {
  const tier = mazeTierForLevel(playerLevel);
  const pool = MAZE_LAYOUTS_BY_TIER[tier];
  const choices = excludeId ? pool.filter((l) => l.id !== excludeId) : pool;
  const list = choices.length ? choices : pool;
  return list[Math.floor(Math.random() * list.length)];
}

/** @param {MazeTier} tier */
export function cellSizeClassForTier(tier) {
  if (tier === "starter") return "maze-cell-starter";
  if (tier === "explorer") return "maze-cell-explorer";
  return "maze-cell-champion";
}

/**
 * @param {BranchingMazeLayout} layout
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Cell[]}
 */
export function mainPathSegment(layout, fromIndex, toIndex) {
  if (fromIndex <= toIndex) return layout.mainPath.slice(fromIndex, toIndex + 1);
  return layout.mainPath.slice(toIndex, fromIndex + 1).reverse();
}

/**
 * @param {BranchingMazeLayout} layout
 * @param {number} checkpointIdx
 */
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
