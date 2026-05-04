"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ongeldig e-mailadres"),
});

/**
 * Look up an auth user by email (case-insensitive). Returns the user id
 * or null if no user exists with that email.
 */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const lower = email.toLowerCase();
  // Profiles is the cheap path.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", lower)
    .maybeSingle();
  if (profile?.id) return profile.id as string;

  // Fallback: paginate auth.users (max ~1000).
  for (let page = 1; page <= 5; page += 1) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (!list || list.users.length === 0) break;
    const found = list.users.find((u) => (u.email ?? "").toLowerCase() === lower);
    if (found) return found.id;
    if (list.users.length < 200) break;
  }
  return null;
}

/**
 * Add a platform admin by email. The user must already exist in Supabase auth
 * (i.e. they need to have signed up at least once). We do NOT auto-create
 * accounts here — platform admin is a sensitive role and the addition should
 * be intentional.
 */
export async function addPlatformAdminByEmail(
  input: z.infer<typeof addSchema>,
): Promise<ActionResult<{ user_id: string }>> {
  await requirePlatformAdmin();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  const userId = await findUserIdByEmail(parsed.data.email);
  if (!userId) {
    return {
      ok: false,
      error:
        "Geen gebruiker gevonden met dit e-mailadres. De persoon moet eerst een account aanmaken.",
    };
  }

  const admin = createAdminClient();
  // Already a platform admin?
  const { data: existing } = await admin
    .from("tenant_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .is("tenant_id", null)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "Deze gebruiker is al platformbeheerder." };
  }

  const { error } = await admin.from("tenant_memberships").insert({
    user_id: userId,
    role: "platform_admin",
    tenant_id: null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/platform/settings/admins");
  return { ok: true, data: { user_id: userId } };
}

const removeSchema = z.object({
  membership_id: z.string().uuid("Ongeldige id"),
});

/**
 * Remove a platform admin row. The caller cannot remove themselves (safety
 * net to avoid the platform losing all admins).
 */
export async function removePlatformAdmin(
  input: z.infer<typeof removeSchema>,
): Promise<ActionResult<void>> {
  const me = await requirePlatformAdmin();
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const admin = createAdminClient();
  const { data: row, error: rowErr } = await admin
    .from("tenant_memberships")
    .select("id, user_id, role, tenant_id")
    .eq("id", parsed.data.membership_id)
    .maybeSingle();
  if (rowErr) return { ok: false, error: rowErr.message };
  if (!row) return { ok: false, error: "Beheerder niet gevonden." };
  if (row.role !== "platform_admin" || row.tenant_id !== null) {
    return { ok: false, error: "Dit is geen platformbeheerder." };
  }
  if (row.user_id === me.id) {
    return {
      ok: false,
      error: "Je kunt jezelf niet verwijderen als platformbeheerder.",
    };
  }

  const { error } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("id", parsed.data.membership_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/platform/settings/admins");
  return { ok: true, data: undefined };
}
