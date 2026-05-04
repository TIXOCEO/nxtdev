import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ProfilePictureTemplate,
  TenantProfilePictureSettings,
  MemberProfilePicture,
} from "@/types/database";

/** Platform-default templates (tenant_id IS NULL). */
export async function getPlatformTemplates(): Promise<ProfilePictureTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_picture_templates")
    .select("*")
    .is("tenant_id", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProfilePictureTemplate[];
}

/** Tenant-specific templates only. */
export async function getTenantTemplates(
  tenantId: string,
): Promise<ProfilePictureTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_picture_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProfilePictureTemplate[];
}

/** All available templates for a tenant: platform-defaults + own. */
export async function getAvailableTemplates(
  tenantId: string,
): Promise<ProfilePictureTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_picture_templates")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProfilePictureTemplate[];
}

export async function getTenantPictureSettings(
  tenantId: string,
): Promise<TenantProfilePictureSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_profile_picture_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantProfilePictureSettings | null) ?? null;
}

export async function getMemberPicture(
  tenantId: string,
  memberId: string,
): Promise<{
  picture: MemberProfilePicture | null;
  template: ProfilePictureTemplate | null;
}> {
  const admin = createAdminClient();
  const { data: pic } = await admin
    .from("member_profile_pictures")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!pic) return { picture: null, template: null };
  const { data: tmpl } = await admin
    .from("profile_picture_templates")
    .select("*")
    .eq("id", (pic as MemberProfilePicture).template_id ?? "")
    .maybeSingle();
  return {
    picture: pic as MemberProfilePicture,
    template: (tmpl as ProfilePictureTemplate | null) ?? null,
  };
}
