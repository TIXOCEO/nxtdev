import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import type { Tenant, TenantMembership, Profile } from "@/types/database";

export async function getAllTenants(): Promise<Tenant[]> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch tenants: ${error.message}`);
  return (data ?? []) as Tenant[];
}

export interface TenantStats {
  total: number;
  active: number;
  inactive: number;
}

export async function getTenantStats(): Promise<TenantStats> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [totalRes, activeRes, inactiveRes] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "inactive"),
  ]);
  return {
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    inactive: inactiveRes.count ?? 0,
  };
}

export interface PlatformOverviewStats extends TenantStats {
  registrations: number;
}

export async function getPlatformOverviewStats(): Promise<PlatformOverviewStats> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const tenantStats = await getTenantStats();
  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true });
  return { ...tenantStats, registrations: count ?? 0 };
}

export interface TenantMembershipWithProfile extends TenantMembership {
  profile: Pick<Profile, "id" | "email" | "full_name"> | null;
}

export interface TenantWithMemberships {
  tenant: Tenant;
  memberships: TenantMembershipWithProfile[];
}

export async function getTenantWithMemberships(
  id: string,
): Promise<TenantWithMemberships | null> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !tenant) return null;

  const { data: rows, error: memErr } = await supabase
    .from("tenant_memberships")
    .select("*, profile:profiles(id,email,full_name)")
    .eq("tenant_id", id);

  if (memErr) throw new Error(`Failed to fetch memberships: ${memErr.message}`);

  const memberships = ((rows ?? []) as unknown as Array<
    TenantMembership & {
      profile: Pick<Profile, "id" | "email" | "full_name"> | Pick<Profile, "id" | "email" | "full_name">[] | null;
    }
  >).map((row) => ({
    ...row,
    profile: Array.isArray(row.profile) ? (row.profile[0] ?? null) : row.profile,
  }));

  return { tenant: tenant as Tenant, memberships };
}
