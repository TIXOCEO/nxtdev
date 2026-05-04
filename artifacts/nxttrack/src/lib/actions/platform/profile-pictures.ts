"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import type { ProfilePictureTemplate } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

const platformTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  image_url: z.string().url(),
});

export async function createPlatformTemplate(
  input: z.infer<typeof platformTemplateSchema>,
): Promise<ActionResult<ProfilePictureTemplate>> {
  const parsed = platformTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await requirePlatformAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profile_picture_templates")
    .insert({
      tenant_id: null,
      name: parsed.data.name,
      image_url: parsed.data.image_url,
      created_by: user.id,
    })
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon template niet aanmaken.");

  revalidatePath("/platform/profile-pictures");
  return { ok: true, data: data as ProfilePictureTemplate };
}

export async function deletePlatformTemplate(input: {
  template_id: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!input || typeof input.template_id !== "string") return fail("Ongeldige invoer");
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_picture_templates")
    .delete()
    .eq("id", input.template_id)
    .is("tenant_id", null);
  if (error) return fail(error.message);
  revalidatePath("/platform/profile-pictures");
  return { ok: true, data: { id: input.template_id } };
}
