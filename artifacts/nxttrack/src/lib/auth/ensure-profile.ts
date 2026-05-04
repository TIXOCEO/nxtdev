import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ensure a profile row exists for the given Supabase Auth user.
 * Called after login — creates the profile if one does not exist.
 *
 * Inserts only `id` and `email` (per spec). Optional columns like
 * full_name / avatar_url are populated by the user later via settings.
 */
export async function ensureProfile(user: User): Promise<Profile> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing && !fetchError) {
    return existing as Profile;
  }

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: (user.email ?? "").toLowerCase(),
    })
    .select()
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to create profile: ${insertError?.message ?? "unknown error"}`);
  }

  return created as Profile;
}
