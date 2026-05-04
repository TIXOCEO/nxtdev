"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/get-user";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const schema = z.object({
  tenant_id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  mode_preference: z.enum(["auto", "light", "dark"]),
  light_theme_id: z.string().uuid().nullable().optional(),
  dark_theme_id: z.string().uuid().nullable().optional(),
});

export async function setUserThemePreference(
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_theme_preferences")
    .upsert(
      {
        user_id: user.id,
        tenant_id: parsed.data.tenant_id,
        mode_preference: parsed.data.mode_preference,
        light_theme_id: parsed.data.light_theme_id ?? null,
        dark_theme_id: parsed.data.dark_theme_id ?? null,
      },
      { onConflict: "user_id,tenant_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/t/${parsed.data.slug}/instellingen`);
  revalidatePath(`/t/${parsed.data.slug}`, "layout");
  return { ok: true, data: undefined };
}
