"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { requireAuth } from "@/lib/auth/require-auth";
import type {
  ProfilePictureTemplate,
  TenantProfilePictureSettings,
  MemberProfilePicture,
} from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

const tenantTemplateSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  image_url: z.string().url(),
});

export async function createTenantTemplate(
  input: z.infer<typeof tenantTemplateSchema>,
): Promise<ActionResult<ProfilePictureTemplate>> {
  const parsed = tenantTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profile_picture_templates")
    .insert({
      tenant_id: parsed.data.tenant_id,
      name: parsed.data.name,
      image_url: parsed.data.image_url,
      created_by: user.id,
    })
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon template niet aanmaken.");

  revalidatePath("/tenant/settings/profile-pictures");
  return { ok: true, data: data as ProfilePictureTemplate };
}

export async function deleteTenantTemplate(input: {
  tenant_id: string;
  template_id: string;
}): Promise<ActionResult<{ id: string }>> {
  if (
    !input ||
    typeof input.tenant_id !== "string" ||
    typeof input.template_id !== "string"
  ) {
    return fail("Ongeldige invoer");
  }
  await assertTenantAccess(input.tenant_id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_picture_templates")
    .delete()
    .eq("id", input.template_id)
    .eq("tenant_id", input.tenant_id);
  if (error) return fail(error.message);
  revalidatePath("/tenant/settings/profile-pictures");
  return { ok: true, data: { id: input.template_id } };
}

const settingsSchema = z.object({
  tenant_id: z.string().uuid(),
  default_template_id: z.string().uuid().nullable(),
  allow_member_choose: z.boolean(),
});

export async function saveTenantPictureSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<ActionResult<TenantProfilePictureSettings>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenant_profile_picture_settings")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        default_template_id: parsed.data.default_template_id,
        allow_member_choose: parsed.data.allow_member_choose,
      },
      { onConflict: "tenant_id" },
    )
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon instellingen niet opslaan.");

  revalidatePath("/tenant/settings/profile-pictures");
  return { ok: true, data: data as TenantProfilePictureSettings };
}

const setMemberPictureSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  template_id: z.string().uuid().nullable(),
});

/**
 * Tenant-admin or the member themself can set a member's picture.
 * (`mpp_self_update` covers the member case via RLS; admin path uses the
 * service-role client.)
 */
export async function setMemberPicture(
  input: z.infer<typeof setMemberPictureSchema>,
): Promise<ActionResult<MemberProfilePicture>> {
  const parsed = setMemberPictureSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const admin = createAdminClient();
  const user = await requireAuth();

  // Authorize: either tenant access OR the user owns this member row.
  const { data: m } = await admin
    .from("members")
    .select("id, tenant_id, user_id")
    .eq("id", parsed.data.member_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!m) return fail("Lid niet gevonden.");

  const isOwner = (m as { user_id: string | null }).user_id === user.id;
  if (!isOwner) {
    // Falls back to assertTenantAccess for non-owner.
    await assertTenantAccess(parsed.data.tenant_id);
  }

  // Validate template availability (platform default OR same tenant).
  if (parsed.data.template_id) {
    const { data: tmpl } = await admin
      .from("profile_picture_templates")
      .select("id, tenant_id")
      .eq("id", parsed.data.template_id)
      .maybeSingle();
    if (!tmpl) return fail("Template niet gevonden.");
    const tRow = tmpl as { tenant_id: string | null };
    if (tRow.tenant_id !== null && tRow.tenant_id !== parsed.data.tenant_id) {
      return fail("Template hoort niet bij deze club.");
    }
  }

  const { data, error } = await admin
    .from("member_profile_pictures")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        member_id: parsed.data.member_id,
        template_id: parsed.data.template_id,
      },
      { onConflict: "member_id" },
    )
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon profielafbeelding niet opslaan.");

  revalidatePath(`/tenant/members/${parsed.data.member_id}`);
  return { ok: true, data: data as MemberProfilePicture };
}
