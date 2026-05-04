"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Called by the client login form right after `signInWithPassword` succeeds.
 * Re-reads the validated user on the server and ensures a `profiles` row exists.
 */
export async function ensureProfileForCurrentUser(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Not authenticated." };
  }
  try {
    await ensureProfile(data.user);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Profile sync failed." };
  }
}

/**
 * Sign the current user out and redirect to the given path (defaults to "/").
 * Safe to call from any client component or form.
 */
export async function signOutAction(redirectTo?: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/");
}
