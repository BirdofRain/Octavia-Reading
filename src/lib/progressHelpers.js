/**
 * Barrel for progression + unlock + difficulty helpers.
 */

export {
  computeXp,
  levelFromXp,
  xpForLevel,
  levelTitleForLevel,
  syncProgression,
  LEVEL_TITLES,
} from "./progression.js";

export { resolveDifficultyBand, filterByDifficultyBand, clampContentTier, createGameSession } from "./difficulty.js";

export {
  getPlayerLevel,
  getProgressSnapshot,
  isGameUnlocked,
  isModeUnlocked,
  getGameUnlockState,
  listCoreGames,
  listUnlockableGames,
  listBonusGames,
  computeUnlockedModeIds,
  selectDifficultyBand,
  isAdvancedContentLevel,
  UNLOCKABLE_GAMES,
} from "./unlocks.js";
