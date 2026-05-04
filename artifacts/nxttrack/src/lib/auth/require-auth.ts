import { redirect } from "next/navigation";
import { getUser } from "./get-user";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side auth guard.
 * Call at the top of any Server Component or Route Handler that requires a logged-in user.
 * Redirects to /login if no valid session exists.
 */
export async function requireAuth(): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
