/**
 * Grid maze paths for Reading Maze (row, col) on a rectangular grid.
 * Walls are every cell not on the path.
 */

/** @typedef {{ rows: number, cols: number, path: [number, number][], label: string }} MazeLayout */

/** @type {MazeLayout[]} */
export const MAZE_LAYOUTS = [
  {
    label: "Starter",
    rows: 4,
    cols: 4,
    path: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [2, 3],
      [3, 3],
    ],
  },
  {
    label: "Explorer",
    rows: 5,
    cols: 5,
    path: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [3, 2],
      [3, 3],
      [4, 3],
      [4, 4],
    ],
  },
  {
    label: "Champion",
    rows: 6,
    cols: 6,
    path: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
      [2, 3],
      [3, 3],
      [4, 3],
      [4, 4],
      [5, 4],
      [5, 5],
    ],
  },
];

/**
 * @param {number} playerLevel
 * @returns {MazeLayout}
 */
export function mazeLayoutForLevel(playerLevel) {
  const lv = Math.max(1, Number(playerLevel) || 1);
  if (lv >= 8) return MAZE_LAYOUTS[2];
  if (lv >= 5) return MAZE_LAYOUTS[1];
  return MAZE_LAYOUTS[0];
}

/**
 * @param {MazeLayout} layout
 * @returns {boolean[][]}
 */
export function buildMazeWallGrid(layout) {
  const { rows, cols, path } = layout;
  const pathSet = new Set(path.map(([r, c]) => `${r},${c}`));
  const grid = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      row.push(!pathSet.has(`${r},${c}`));
    }
    grid.push(row);
  }
  return grid;
}
