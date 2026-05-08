import { supabase, supabaseConfigured } from "./supabaseClient";

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

export async function loadCloudProgress() {
  if (!supabaseConfigured) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("reading_progress")
    .select("progress")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.progress ?? null;
}

export async function saveCloudProgress(progress) {
  if (!supabaseConfigured) return { skipped: true, reason: "not_configured" };
  const user = await getCurrentUser();
  if (!user) return { skipped: true, reason: "not_signed_in" };

  const { error } = await supabase
    .from("reading_progress")
    .upsert(
      {
        user_id: user.id,
        child_name: progress?.childName || "Octavia",
        progress,
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return { saved: true };
}

export function mergeProgress(localProgress, cloudProgress) {
  if (!cloudProgress) return localProgress;
  if (!localProgress) return cloudProgress;

  return {
    ...localProgress,
    ...cloudProgress,
    stars: Math.max(localProgress.stars || 0, cloudProgress.stars || 0),
    lifetimeStars: Math.max(localProgress.lifetimeStars || 0, cloudProgress.lifetimeStars || 0),
    correct: Math.max(localProgress.correct || 0, cloudProgress.correct || 0),
    attempts: Math.max(localProgress.attempts || 0, cloudProgress.attempts || 0),
    badges: Array.from(new Set([...(localProgress.badges || []), ...(cloudProgress.badges || [])])),
    rewardClaims: [...(cloudProgress.rewardClaims || []), ...(localProgress.rewardClaims || [])].slice(0, 50),
    totals: {
      ...(localProgress.totals || {}),
      ...(cloudProgress.totals || {}),
      soundsCorrect: Math.max(localProgress.totals?.soundsCorrect || 0, cloudProgress.totals?.soundsCorrect || 0),
      wordsBuilt: Math.max(localProgress.totals?.wordsBuilt || 0, cloudProgress.totals?.wordsBuilt || 0),
      sentencesRead: Math.max(localProgress.totals?.sentencesRead || 0, cloudProgress.totals?.sentencesRead || 0),
      countingCorrect: Math.max(localProgress.totals?.countingCorrect || 0, cloudProgress.totals?.countingCorrect || 0),
      mathCorrect: Math.max(localProgress.totals?.mathCorrect || 0, cloudProgress.totals?.mathCorrect || 0),
      parentMinutes: Math.max(localProgress.totals?.parentMinutes || 0, cloudProgress.totals?.parentMinutes || 0),
    },
    dailyLog: {
      ...(cloudProgress.dailyLog || {}),
      ...(localProgress.dailyLog || {}),
    },
  };
}

/** Console-only checks for merge + offline behavior (runs once per tab). */
export function runCloudSyncSelfTests() {
  const hiLocal = { lifetimeStars: 3, badges: ["a", "b"] };
  const hiCloud = { lifetimeStars: 11, badges: ["b", "c"] };
  const mergedStars = mergeProgress(hiLocal, hiCloud);
  console.assert(mergedStars.lifetimeStars === 11, "mergeProgress keeps highest lifetimeStars");

  const badgeMerged = mergeProgress({ badges: ["x"] }, { badges: ["x", "y"] });
  console.assert(badgeMerged.badges.length === 2 && new Set(badgeMerged.badges).size === 2, "mergeProgress combines badges uniquely");

  console.assert(typeof supabase?.auth?.signOut === "function", "app loads without Supabase env vars (client exists)");
  console.assert(typeof supabaseConfigured === "boolean", "supabaseConfigured is defined");

  void saveCloudProgress({ childName: "Test" }).then((r) => {
    console.assert(r?.skipped === true, "saveCloudProgress skips when not signed in");
  });
}
