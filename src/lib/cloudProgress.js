import { supabase, supabaseConfigured } from "./supabaseClient";
import { sanitizeRewardClaims } from "./rewardClaims.js";
import { reconcileProgress, touchProgressUpdatedAt } from "./progressSync.js";

export { reconcileProgress, touchProgressUpdatedAt } from "./progressSync.js";
export { supabase, supabaseConfigured } from "./supabaseClient";

export async function getCurrentUser() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user ?? null;
}

export async function signUpWithEmail(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * @returns {Promise<{ progress: object, serverUpdatedAt?: string }|null>}
 */
export async function loadCloudProgress() {
  if (!supabaseConfigured) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  let data;
  let error;
  ({ data, error } = await supabase
    .from("reading_progress")
    .select("progress, updated_at")
    .eq("user_id", user.id)
    .maybeSingle());

  if (error?.code === "42703" || /updated_at/i.test(error?.message || "")) {
    ({ data, error } = await supabase
      .from("reading_progress")
      .select("progress")
      .eq("user_id", user.id)
      .maybeSingle());
  }

  if (error) throw error;
  if (!data?.progress) return null;

  return {
    progress: data.progress,
    serverUpdatedAt: data.updated_at ?? undefined,
  };
}

export async function saveCloudProgress(progress) {
  if (!supabaseConfigured) return { skipped: true, reason: "not_configured" };
  const user = await getCurrentUser();
  if (!user) return { skipped: true, reason: "not_signed_in" };

  const stamped = touchProgressUpdatedAt(progress);

  const { error } = await supabase
    .from("reading_progress")
    .upsert(
      {
        user_id: user.id,
        child_name: stamped?.childName || "Octavia",
        progress: stamped,
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return { saved: true, progress: stamped };
}

/** @deprecated Use reconcileProgress — kept for existing imports/tests. */
export function mergeProgress(localProgress, cloudProgress, serverUpdatedAt) {
  return reconcileProgress(localProgress, cloudProgress, serverUpdatedAt);
}

/** Console-only checks for merge + offline behavior (runs once per tab). */
export function runCloudSyncSelfTests() {
  const hiLocal = { lifetimeStars: 3, badges: ["a", "b"] };
  const hiCloud = { lifetimeStars: 11, badges: ["b", "c"] };
  const mergedStars = reconcileProgress(hiLocal, hiCloud);
  console.assert(mergedStars.lifetimeStars === 11, "reconcileProgress keeps highest lifetimeStars");

  const badgeMerged = reconcileProgress({ badges: ["x"] }, { badges: ["x", "y"] });
  console.assert(badgeMerged.badges.length === 2 && new Set(badgeMerged.badges).size === 2, "reconcileProgress combines badges uniquely");

  console.assert(typeof supabase?.auth?.signOut === "function", "app loads without Supabase env vars (client exists)");
  console.assert(typeof supabaseConfigured === "boolean", "supabaseConfigured is defined");

  void saveCloudProgress({ childName: "Test" }).then((r) => {
    console.assert(r?.skipped === true, "saveCloudProgress skips when not signed in");
  });

  const duped = sanitizeRewardClaims([
    { id: "story", title: "Pick bedtime story", cost: 5, claimedAt: "2026-01-01T12:00:00.000Z" },
    { id: "story", title: "Pick bedtime story", cost: 5, claimedAt: "2026-01-01T12:00:00.000Z" },
  ]);
  console.assert(duped.length === 1, "sanitizeRewardClaims removes exact duplicate claims");

  const mergedProg = reconcileProgress({ lifetimeStars: 5, correct: 5 }, { lifetimeStars: 20, correct: 18 });
  console.assert(mergedProg.xp >= 20 && mergedProg.level >= 2, "reconcileProgress should sync progression from max XP sources");

  const cloudNewer = reconcileProgress(
    { updatedAt: "2026-01-01T10:00:00.000Z", dailyLog: { "2026-05-15": { sentencesRead: 0, lastPlayedAt: "2026-01-01T10:00:00.000Z" } } },
    { updatedAt: "2026-05-15T18:00:00.000Z", dailyLog: { "2026-05-15": { sentencesRead: 4, lastPlayedAt: "2026-05-15T18:00:00.000Z" } } }
  );
  console.assert(
    cloudNewer.dailyLog["2026-05-15"].sentencesRead === 4,
    "when cloud is newer, today's log should not be overwritten by stale local"
  );

  const mazeMerge = mergeProgress(
    { totals: { mazeCompleted: 2 }, dailyLog: { "2026-05-01": { mazeCompleted: 1 } } },
    { totals: { mazeCompleted: 5 }, dailyLog: { "2026-05-01": { mazeCompleted: 3 } } }
  );
  console.assert(mazeMerge.totals.mazeCompleted === 5, "mergeProgress should max mazeCompleted totals");
  console.assert(mazeMerge.dailyLog["2026-05-01"].mazeCompleted === 3, "mergeProgress should max mazeCompleted per day");
}
