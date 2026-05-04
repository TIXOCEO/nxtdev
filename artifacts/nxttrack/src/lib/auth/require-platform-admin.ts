import { redirect } from "next/navigation";
import { requireAuth } from "./require-auth";
import { getMemberships } from "./get-memberships";
import { isPlatformAdmin } from "@/lib/permissions";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side platform admin guard.
 * Redirects to / if the user is authenticated but not a platform admin.
 * Redirects to /login if not authenticated at all.
 */
export async function requirePlatformAdmin(): Promise<User> {
  const user = await requireAuth();
  const memberships = await getMemberships(user.id);

  if (!isPlatformAdmin(memberships)) {
    redirect("/");
  }

  return user;
}
