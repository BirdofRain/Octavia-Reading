/** Reward claim records: create, dedupe, and atomic progress updates. */

export const MAX_REWARD_CLAIMS = 50;

let claimSeq = 0;

function nextClaimId(prefix) {
  claimSeq += 1;
  return `${prefix}-${Date.now()}-${claimSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {{ id: string, title: string, cost: number, type?: string }} params
 */
export function createRewardClaim({ id, title, cost, type }) {
  const claim = {
    claimId: nextClaimId(id),
    id,
    title: title || id,
    cost: Number(cost) || 0,
    claimedAt: new Date().toISOString(),
  };
  if (type) claim.type = type;
  return claim;
}

/** Exact duplicate key (same id, cost, title, and timestamp). */
export function rewardClaimFingerprint(claim) {
  if (!claim) return "";
  return `${claim.id}|${claim.cost}|${claim.title}|${claim.claimedAt}`;
}

export function normalizeRewardClaim(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const claim = {
    claimId: raw.claimId || nextClaimId(raw.id),
    id: raw.id,
    title: raw.title || raw.id,
    cost: Number(raw.cost) || 0,
    claimedAt: raw.claimedAt || new Date().toISOString(),
  };
  if (raw.type) claim.type = raw.type;
  return claim;
}

/** Remove records that are identical on id + cost + title + claimedAt. */
export function dedupeExactRewardClaims(claims) {
  const seen = new Set();
  const out = [];
  for (const raw of claims || []) {
    const claim = normalizeRewardClaim(raw);
    if (!claim) continue;
    const fp = rewardClaimFingerprint(claim);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(claim);
  }
  return out;
}

/** Keep one row per claimId (newest first if duplicates somehow share an id). */
export function dedupeRewardClaimsByClaimId(claims) {
  const seen = new Set();
  const out = [];
  for (const raw of claims || []) {
    const claim = normalizeRewardClaim(raw);
    if (!claim) continue;
    if (seen.has(claim.claimId)) continue;
    seen.add(claim.claimId);
    out.push(claim);
  }
  return out;
}

export function sanitizeRewardClaims(claims) {
  return dedupeRewardClaimsByClaimId(dedupeExactRewardClaims(claims)).slice(0, MAX_REWARD_CLAIMS);
}

export function mergeRewardClaims(localClaims, cloudClaims) {
  return sanitizeRewardClaims([...(cloudClaims || []), ...(localClaims || [])]);
}

/**
 * Apply one reward claim inside a functional progress updater.
 * @param {object} progress
 * @param {{ id: string, title: string, cost: number, type?: string, claimId?: string }} draft
 * @param {{ skipStarCost?: boolean }} options
 * @returns {object|null} Updated progress, or null if stars insufficient / duplicate claimId
 */
export function applyRewardClaim(progress, draft, options = {}) {
  const { skipStarCost = false } = options;
  const cost = Number(draft.cost) || 0;
  const stars = Number(progress?.stars) || 0;
  if (!skipStarCost && cost > stars) return null;

  const claimId = draft.claimId || nextClaimId(draft.id);
  const existing = sanitizeRewardClaims(progress?.rewardClaims);
  if (existing.some((c) => c.claimId === claimId)) return null;

  const claim = {
    claimId,
    id: draft.id,
    title: draft.title || draft.id,
    cost,
    claimedAt: new Date().toISOString(),
  };
  if (draft.type) claim.type = draft.type;

  const nextStars = skipStarCost ? stars : Math.max(0, stars - cost);

  return {
    ...progress,
    stars: nextStars,
    rewardClaims: [claim, ...existing].slice(0, MAX_REWARD_CLAIMS),
  };
}
