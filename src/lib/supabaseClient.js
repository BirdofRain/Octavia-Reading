import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn("Missing Supabase env vars. Cloud sync will not work.");
}

// Valid-looking placeholders so createClient never throws when env is absent (offline/local-only).
const safeUrl = supabaseUrl || "https://placeholder.supabase.co";
const safeKey = supabaseAnonKey || "sb-publishable-placeholder-key-not-used";

export const supabase = createClient(safeUrl, safeKey);
