import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Alert,
  MediaWallItem,
  ModuleCatalog,
  PublicTrainer,
  Sponsor,
  Tenant,
  TenantModule,
} from "@/types/database";

export async function getModuleCatalog(): Promise<ModuleCatalog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("modules_catalog")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data ?? []) as ModuleCatalog[];
}

export async function getTenantHomepageModules(
  tenantId: string,
): Promise<TenantModule[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_modules")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });
  return (data ?? []) as TenantModule[];
}

export async function getPublicTenantHomepageModules(
  tenantId: string,
  isAuthenticated: boolean,
): Promise<TenantModule[]> {
  const supabase = await createClient();
  let q = supabase
    .from("tenant_modules")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });
  if (!isAuthenticated) q = q.eq("visible_for", "public");
  const { data } = await q;
  return (data ?? []) as TenantModule[];
}

export interface PublicHomepageData {
  tenant: Tenant;
  modules: TenantModule[];
}

export async function getPublicHomepageData(
  slug: string,
  isAuthenticated: boolean,
): Promise<PublicHomepageData | null> {
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tenant) return null;
  const modules = await getPublicTenantHomepageModules(
    (tenant as Tenant).id,
    isAuthenticated,
  );
  return { tenant: tenant as Tenant, modules };
}

export async function getActiveAlerts(tenantId: string): Promise<Alert[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .or(`start_at.is.null,start_at.lte.${nowIso}`)
    .or(`end_at.is.null,end_at.gte.${nowIso}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as Alert[];
}

export async function listAlertsAdmin(tenantId: string): Promise<Alert[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("alerts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Alert[];
}

export async function getMediaWallItems(
  tenantId: string,
  limit?: number,
): Promise<MediaWallItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("media_wall_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("position", { ascending: true });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return (data ?? []) as MediaWallItem[];
}

export async function listMediaWallItemsAdmin(
  tenantId: string,
): Promise<MediaWallItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("media_wall_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });
  return (data ?? []) as MediaWallItem[];
}

export async function getSponsors(
  tenantId: string,
  limit?: number,
): Promise<Sponsor[]> {
  const supabase = await createClient();
  let q = supabase
    .from("sponsors")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("position", { ascending: true });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return (data ?? []) as Sponsor[];
}

export async function listSponsorsAdmin(tenantId: string): Promise<Sponsor[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sponsors")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });
  return (data ?? []) as Sponsor[];
}

export async function getPublicTrainers(
  tenantId: string,
  limit?: number,
): Promise<PublicTrainer[]> {
  const supabase = await createClient();
  let q = supabase
    .from("public_trainers")
    .select("*")
    .eq("tenant_id", tenantId);
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return (data ?? []) as PublicTrainer[];
}
