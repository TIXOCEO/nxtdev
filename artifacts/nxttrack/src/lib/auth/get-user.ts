import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Fetch the authenticated user from Supabase.
 * Uses getUser() which validates the JWT against the Supabase Auth server —
 * safe to use for authorization checks.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}
