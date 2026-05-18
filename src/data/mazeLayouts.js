/**
 * Branching reading maze layouts: main path, checkpoints, wrong branches, dead ends.
 * @typedef {"wall"|"path"|"start"|"checkpoint"|"deadEnd"|"finish"} MazeCellType
 * @typedef {[number, number]} Cell
 */

/** @typedef {"starter"|"explorer"|"champion"} MazeTier */

/**
 * @typedef {object} MazeCheckpointDef
 * @property {string} id
 * @property {Cell} cell
 * @property {number} mainPathIndex index on mainPath where bird stops
 * @property {Cell[][]} wrongBranchPaths three wrong routes (one per distractor)
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
  starter: [
    buildStarterA(),
    buildStarterB(),
  ],
  explorer: [
    buildExplorerA(),
    buildExplorerB(),
  ],
  champion: [
    buildChampionA(),
  ],
};

function key(r, c) {
  return `${r},${c}`;
}

function cell(r, c) {
  return [r, c];
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Record<string, MazeCellType>} sparse
 * @param {Cell[]} mainPath
 * @param {MazeCheckpointDef[]} checkpoints
 */
function finalizeLayout(id, tier, label, rows, cols, sparse, mainPath, checkpoints) {
  const cellGrid = Array.from({ length: rows }, () => Array(cols).fill("wall"));
  for (const [k, type] of Object.entries(sparse)) {
    const [r, c] = k.split(",").map(Number);
    if (r >= 0 && r < rows && c >= 0 && c < cols) cellGrid[r][c] = type;
  }
  const start = mainPath[0];
  const finish = mainPath[mainPath.length - 1];
  cellGrid[start[0]][start[1]] = "start";
  cellGrid[finish[0]][finish[1]] = "finish";
  for (const cp of checkpoints) {
    cellGrid[cp.cell[0]][cp.cell[1]] = "checkpoint";
  }
  return { id, tier, label, rows, cols, start, finish, mainPath, checkpoints, cellGrid };
}

function buildStarterA() {
  const rows = 10;
  const cols = 7;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4), cell(0, 5), cell(0, 6),
    cell(1, 6), cell(2, 6), cell(3, 6), cell(4, 6), cell(5, 6), cell(6, 6), cell(7, 6), cell(8, 6), cell(9, 6),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(0, 4),
      mainPathIndex: 4,
      wrongBranchPaths: [
        [cell(1, 4), cell(2, 4), cell(3, 4)],
        [cell(1, 3), cell(2, 3), cell(3, 3)],
        [cell(1, 5), cell(2, 5), cell(3, 5)],
      ],
    },
    {
      id: "cp2",
      cell: cell(4, 6),
      mainPathIndex: 10,
      wrongBranchPaths: [
        [cell(4, 5), cell(5, 5), cell(6, 5)],
        [cell(3, 5), cell(3, 4), cell(4, 4)],
        [cell(5, 4), cell(6, 4), cell(7, 4)],
      ],
    },
  ];
  const sparse = {
    [key(0, 0)]: "start",
    [key(0, 1)]: "path",
    [key(0, 2)]: "path",
    [key(0, 3)]: "path",
    [key(0, 4)]: "checkpoint",
    [key(0, 5)]: "path",
    [key(0, 6)]: "path",
    [key(1, 6)]: "path",
    [key(2, 6)]: "path",
    [key(3, 6)]: "path",
    [key(4, 6)]: "checkpoint",
    [key(5, 6)]: "path",
    [key(6, 6)]: "path",
    [key(7, 6)]: "path",
    [key(8, 6)]: "path",
    [key(9, 6)]: "finish",
    [key(1, 4)]: "path",
    [key(2, 4)]: "path",
    [key(3, 4)]: "deadEnd",
    [key(1, 3)]: "path",
    [key(2, 3)]: "path",
    [key(3, 3)]: "deadEnd",
    [key(1, 5)]: "path",
    [key(2, 5)]: "path",
    [key(3, 5)]: "deadEnd",
    [key(4, 5)]: "path",
    [key(5, 5)]: "path",
    [key(6, 5)]: "deadEnd",
    [key(3, 5)]: "deadEnd",
    [key(3, 4)]: "deadEnd",
    [key(4, 4)]: "path",
    [key(5, 4)]: "path",
    [key(6, 4)]: "path",
    [key(7, 4)]: "deadEnd",
  };
  return finalizeLayout("starter-a", "starter", "Starter A", rows, cols, sparse, mainPath, checkpoints);
}

function buildStarterB() {
  const rows = 9;
  const cols = 7;
  const mainPath = [
    cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0), cell(4, 1), cell(4, 2),
    cell(4, 3), cell(4, 4), cell(5, 4), cell(6, 4), cell(7, 4), cell(8, 4),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(2, 0),
      mainPathIndex: 2,
      wrongBranchPaths: [
        [cell(2, 1), cell(2, 2), cell(2, 3)],
        [cell(1, 1), cell(1, 2), cell(1, 3)],
        [cell(3, 1), cell(3, 2), cell(3, 3)],
      ],
    },
    {
      id: "cp2",
      cell: cell(4, 3),
      mainPathIndex: 7,
      wrongBranchPaths: [
        [cell(3, 3), cell(2, 3), cell(1, 3)],
        [cell(5, 3), cell(6, 3), cell(7, 3)],
        [cell(4, 5), cell(5, 5), cell(6, 5)],
      ],
    },
  ];
  const sparse = {
    [key(0, 0)]: "start",
    [key(1, 0)]: "path",
    [key(2, 0)]: "checkpoint",
    [key(3, 0)]: "path",
    [key(4, 0)]: "path",
    [key(4, 1)]: "path",
    [key(4, 2)]: "path",
    [key(4, 3)]: "checkpoint",
    [key(4, 4)]: "path",
    [key(5, 4)]: "path",
    [key(6, 4)]: "path",
    [key(7, 4)]: "path",
    [key(8, 4)]: "finish",
    [key(2, 1)]: "path",
    [key(2, 2)]: "path",
    [key(2, 3)]: "deadEnd",
    [key(1, 1)]: "path",
    [key(1, 2)]: "path",
    [key(1, 3)]: "deadEnd",
    [key(3, 1)]: "path",
    [key(3, 2)]: "path",
    [key(3, 3)]: "deadEnd",
    [key(3, 3)]: "deadEnd",
    [key(2, 3)]: "deadEnd",
    [key(5, 3)]: "path",
    [key(6, 3)]: "path",
    [key(7, 3)]: "deadEnd",
    [key(4, 5)]: "path",
    [key(5, 5)]: "path",
    [key(6, 5)]: "deadEnd",
  };
  return finalizeLayout("starter-b", "starter", "Starter B", rows, cols, sparse, mainPath, checkpoints);
}

function buildExplorerA() {
  const rows = 10;
  const cols = 13;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4), cell(0, 5), cell(0, 6), cell(0, 7), cell(0, 8), cell(0, 9), cell(0, 10),
    cell(1, 10), cell(2, 10), cell(3, 10), cell(4, 10), cell(5, 10), cell(6, 10), cell(7, 10), cell(8, 10), cell(9, 10), cell(9, 11), cell(9, 12),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(0, 4),
      mainPathIndex: 4,
      wrongBranchPaths: [
        [cell(1, 4), cell(2, 4), cell(3, 4), cell(4, 4)],
        [cell(1, 3), cell(2, 3), cell(3, 3), cell(4, 3)],
        [cell(1, 5), cell(2, 5), cell(3, 5), cell(4, 5)],
      ],
    },
    {
      id: "cp2",
      cell: cell(0, 8),
      mainPathIndex: 8,
      wrongBranchPaths: [
        [cell(1, 8), cell(2, 8), cell(3, 8), cell(4, 8)],
        [cell(1, 7), cell(2, 7), cell(3, 7), cell(4, 7)],
        [cell(1, 9), cell(2, 9), cell(3, 9), cell(4, 9)],
      ],
    },
    {
      id: "cp3",
      cell: cell(5, 10),
      mainPathIndex: 15,
      wrongBranchPaths: [
        [cell(5, 9), cell(5, 8), cell(5, 7), cell(5, 6)],
        [cell(4, 9), cell(3, 9), cell(2, 9), cell(1, 9)],
        [cell(6, 9), cell(7, 9), cell(8, 9), cell(8, 8)],
      ],
    },
  ];
  const sparse = {};
  for (const p of mainPath) sparse[key(p[0], p[1])] = "path";
  sparse[key(0, 0)] = "start";
  sparse[key(9, 12)] = "finish";
  for (const cp of checkpoints) sparse[key(cp.cell[0], cp.cell[1])] = "checkpoint";
  for (const cp of checkpoints) {
    for (const branch of cp.wrongBranchPaths) {
      for (let i = 0; i < branch.length; i += 1) {
        const [r, c] = branch[i];
        sparse[key(r, c)] = i === branch.length - 1 ? "deadEnd" : "path";
      }
    }
  }
  return finalizeLayout("explorer-a", "explorer", "Explorer A", rows, cols, sparse, mainPath, checkpoints);
}

function buildExplorerB() {
  const rows = 10;
  const cols = 13;
  const mainPath = [
    cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0), cell(5, 0), cell(6, 0),
    cell(6, 1), cell(6, 2), cell(6, 3), cell(6, 4), cell(6, 5), cell(6, 6), cell(6, 7), cell(6, 8),
    cell(7, 8), cell(8, 8), cell(9, 8), cell(9, 9), cell(9, 10), cell(9, 11), cell(9, 12),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(3, 0),
      mainPathIndex: 3,
      wrongBranchPaths: [
        [cell(3, 1), cell(3, 2), cell(2, 2), cell(1, 2)],
        [cell(4, 1), cell(5, 1), cell(5, 2), cell(5, 3)],
        [cell(2, 1), cell(1, 1), cell(0, 1), cell(0, 2)],
      ],
    },
    {
      id: "cp2",
      cell: cell(6, 4),
      mainPathIndex: 10,
      wrongBranchPaths: [
        [cell(5, 4), cell(4, 4), cell(3, 4), cell(2, 4)],
        [cell(7, 4), cell(8, 4), cell(8, 5), cell(8, 6)],
        [cell(5, 5), cell(4, 5), cell(3, 5), cell(2, 5)],
      ],
    },
    {
      id: "cp3",
      cell: cell(9, 10),
      mainPathIndex: 18,
      wrongBranchPaths: [
        [cell(8, 10), cell(7, 10), cell(7, 11), cell(7, 12)],
        [cell(8, 9), cell(7, 9), cell(6, 9), cell(5, 9)],
        [cell(9, 9), cell(9, 7), cell(8, 7), cell(7, 7)],
      ],
    },
  ];
  const sparse = {};
  for (const p of mainPath) sparse[key(p[0], p[1])] = "path";
  sparse[key(0, 0)] = "start";
  sparse[key(9, 12)] = "finish";
  for (const cp of checkpoints) sparse[key(cp.cell[0], cp.cell[1])] = "checkpoint";
  for (const cp of checkpoints) {
    for (const branch of cp.wrongBranchPaths) {
      for (let i = 0; i < branch.length; i += 1) {
        const [r, c] = branch[i];
        sparse[key(r, c)] = i === branch.length - 1 ? "deadEnd" : "path";
      }
    }
  }
  return finalizeLayout("explorer-b", "explorer", "Explorer B", rows, cols, sparse, mainPath, checkpoints);
}

function buildChampionA() {
  const rows = 11;
  const cols = 15;
  const mainPath = [
    cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4), cell(0, 5), cell(0, 6), cell(0, 7), cell(0, 8), cell(0, 9), cell(0, 10),
    cell(1, 10), cell(2, 10), cell(3, 10), cell(4, 10), cell(5, 10), cell(6, 10), cell(7, 10), cell(8, 10),
    cell(8, 11), cell(8, 12), cell(8, 13), cell(9, 13), cell(10, 13), cell(10, 14),
  ];
  const checkpoints = [
    {
      id: "cp1",
      cell: cell(0, 4),
      mainPathIndex: 4,
      wrongBranchPaths: [
        [cell(1, 4), cell(2, 4), cell(3, 4), cell(4, 4), cell(5, 4)],
        [cell(1, 3), cell(2, 3), cell(3, 3), cell(4, 3), cell(5, 3)],
        [cell(1, 5), cell(2, 5), cell(3, 5), cell(4, 5), cell(5, 5)],
      ],
    },
    {
      id: "cp2",
      cell: cell(0, 8),
      mainPathIndex: 8,
      wrongBranchPaths: [
        [cell(1, 8), cell(2, 8), cell(3, 8), cell(4, 8), cell(5, 8)],
        [cell(1, 7), cell(2, 7), cell(3, 7), cell(4, 7), cell(5, 7)],
        [cell(1, 9), cell(2, 9), cell(3, 9), cell(4, 9), cell(5, 9)],
      ],
    },
    {
      id: "cp3",
      cell: cell(4, 10),
      mainPathIndex: 13,
      wrongBranchPaths: [
        [cell(4, 9), cell(4, 8), cell(3, 8), cell(2, 8), cell(1, 8)],
        [cell(5, 9), cell(6, 9), cell(7, 9), cell(8, 9), cell(8, 8)],
        [cell(3, 9), cell(2, 9), cell(1, 9), cell(0, 9), cell(0, 8)],
      ],
    },
    {
      id: "cp4",
      cell: cell(8, 12),
      mainPathIndex: 19,
      wrongBranchPaths: [
        [cell(7, 12), cell(6, 12), cell(5, 12), cell(4, 12), cell(3, 12)],
        [cell(8, 11), cell(7, 11), cell(6, 11), cell(5, 11), cell(4, 11)],
        [cell(9, 12), cell(9, 11), cell(9, 10), cell(8, 10), cell(7, 10)],
      ],
    },
  ];
  const sparse = {};
  for (const p of mainPath) sparse[key(p[0], p[1])] = "path";
  sparse[key(0, 0)] = "start";
  sparse[key(10, 14)] = "finish";
  for (const cp of checkpoints) sparse[key(cp.cell[0], cp.cell[1])] = "checkpoint";
  for (const cp of checkpoints) {
    for (const branch of cp.wrongBranchPaths) {
      for (let i = 0; i < branch.length; i += 1) {
        const [r, c] = branch[i];
        sparse[key(r, c)] = i === branch.length - 1 ? "deadEnd" : "path";
      }
    }
  }
  return finalizeLayout("champion-a", "champion", "Champion", rows, cols, sparse, mainPath, checkpoints);
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
