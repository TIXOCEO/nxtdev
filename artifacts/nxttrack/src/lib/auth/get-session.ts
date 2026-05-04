import { createClient } from "@/lib/supabase/server";
import type { Session } from "@supabase/supabase-js";

/**
 * Retrieve the current server-side session.
 * Use getUser() for security-sensitive checks — getSession() alone
 * does not re-validate the JWT against Supabase servers.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}
