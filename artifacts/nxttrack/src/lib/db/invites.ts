import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberInvite, Member } from "@/types/database";

export interface InviteListRow extends MemberInvite {
  member_name: string | null;
  child_name: string | null;
}

export async function getInvitesByTenant(
  tenantId: string,
): Promise<InviteListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_invites")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch invites: ${error.message}`);

  const rows = (data ?? []) as MemberInvite[];
  if (rows.length === 0) return [];

  const memberIds = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.member_id, r.child_member_id])
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const nameById = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: ms } = await supabase
      .from("members")
      .select("id, full_name")
      .in("id", memberIds)
      .eq("tenant_id", tenantId);
    for (const m of (ms ?? []) as Array<Pick<Member, "id" | "full_name">>) {
      nameById.set(m.id, m.full_name);
    }
  }

  return rows.map((r) => ({
    ...r,
    member_name: r.member_id ? nameById.get(r.member_id) ?? null : null,
    child_name: r.child_member_id ? nameById.get(r.child_member_id) ?? null : null,
  }));
}

/**
 * Public/unauthenticated invite lookup by token. Uses the service-role
 * admin client to bypass RLS — callers must NOT trust any returned data
 * beyond what's needed to render the acceptance page.
 *
 * Returns the raw invite row + tenant slug (for branding/redirects).
 * Returns null when missing.
 */
export async function getPublicInviteByToken(token: string): Promise<
  | (MemberInvite & {
      tenant_name: string;
      tenant_slug: string;
      tenant_primary_color: string | null;
      member_full_name: string | null;
      child_full_name: string | null;
    })
  | null
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_invites")
    .select(
      "*, tenant:tenants(name, slug, primary_color), member:members!member_invites_member_id_fkey(full_name), child:members!member_invites_child_member_id_fkey(full_name)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as MemberInvite & {
    tenant: { name: string; slug: string; primary_color: string | null } | null;
    member: { full_name: string } | null;
    child: { full_name: string } | null;
  };
  if (!row.tenant) return null;
  return {
    ...row,
    tenant_name: row.tenant.name,
    tenant_slug: row.tenant.slug,
    tenant_primary_color: row.tenant.primary_color,
    member_full_name: row.member?.full_name ?? null,
    child_full_name: row.child?.full_name ?? null,
  };
}

/** Look up an invite by its short human code (admin client, public flow). */
export async function getPublicInviteByCode(
  tenantId: string,
  code: string,
): Promise<MemberInvite | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_invites")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("invite_code", code.trim().toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as MemberInvite;
}
