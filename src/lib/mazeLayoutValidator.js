/** @typedef {[number, number]} Cell */

/**
 * @param {Cell} a
 * @param {Cell} b
 */
export function cellsAdjacent(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

/**
 * @param {Cell[]} path
 * @param {string} label
 * @returns {string[]}
 */
function validateAdjacentPath(path, label) {
  const errors = [];
  for (let i = 1; i < path.length; i += 1) {
    if (!cellsAdjacent(path[i - 1], path[i])) {
      errors.push(`${label} step ${i - 1}→${i} is not orthogonally adjacent: [${path[i - 1]}] → [${path[i]}]`);
    }
  }
  return errors;
}

/**
 * @param {import("../data/mazeLayouts.js").BranchingMazeLayout} layout
 * @returns {string[]}
 */
export function validateMazeLayout(layout) {
  const errors = [];
  const { rows, cols, mainPath, checkpoints, finish, id } = layout;

  errors.push(...validateAdjacentPath(mainPath, `${id} mainPath`));

  if (mainPath.length < 2) {
    errors.push(`${id}: mainPath must have at least start and finish`);
  }

  const mainKeys = new Set(mainPath.map(([r, c]) => `${r},${c}`));
  const finishKey = `${finish[0]},${finish[1]}`;
  const lastMain = mainPath[mainPath.length - 1];
  if (lastMain[0] !== finish[0] || lastMain[1] !== finish[1]) {
    errors.push(`${id}: finish ${JSON.stringify(finish)} must equal last mainPath cell ${JSON.stringify(lastMain)}`);
  }

  for (const cp of checkpoints) {
    const cpKey = `${cp.cell[0]},${cp.cell[1]}`;
    if (!mainKeys.has(cpKey)) {
      errors.push(`${id} checkpoint ${cp.id}: cell ${JSON.stringify(cp.cell)} is not on mainPath`);
    }

    if (typeof cp.mainPathIndex === "number" && mainPath[cp.mainPathIndex]) {
      const atIdx = mainPath[cp.mainPathIndex];
      if (atIdx[0] !== cp.cell[0] || atIdx[1] !== cp.cell[1]) {
        errors.push(`${id} checkpoint ${cp.id}: mainPathIndex ${cp.mainPathIndex} does not match cell`);
      }
    }

    for (let b = 0; b < cp.wrongBranchPaths.length; b += 1) {
      const branch = cp.wrongBranchPaths[b];
      errors.push(...validateAdjacentPath(branch, `${id} ${cp.id} wrongBranch[${b}]`));

      if (!branch.length) {
        errors.push(`${id} ${cp.id} wrongBranch[${b}]: must not be empty`);
        continue;
      }

      const first = branch[0];
      if (!cellsAdjacent(cp.cell, first)) {
        errors.push(
          `${id} ${cp.id} wrongBranch[${b}]: must start adjacent to checkpoint ${JSON.stringify(cp.cell)}, first cell is ${JSON.stringify(first)}`
        );
      }

      for (const [r, c] of branch) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) {
          errors.push(`${id} ${cp.id} wrongBranch[${b}]: cell [${r},${c}] out of bounds ${rows}x${cols}`);
        }
        const k = `${r},${c}`;
        if (mainKeys.has(k) && k !== cpKey) {
          errors.push(`${id} ${cp.id} wrongBranch[${b}]: [${r},${c}] overlaps mainPath (not checkpoint)`);
        }
      }
    }
  }

  for (const [r, c] of mainPath) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) {
      errors.push(`${id}: mainPath cell [${r},${c}] out of bounds ${rows}x${cols}`);
    }
  }

  return errors;
}

/**
 * @param {import("../data/mazeLayouts.js").BranchingMazeLayout} layout
 */
export function warnIfMazeLayoutInvalid(layout) {
  const errors = validateMazeLayout(layout);
  if (errors.length) {
    console.warn(`[Reading Maze] Invalid layout "${layout.id}":`, errors);
  }
}
