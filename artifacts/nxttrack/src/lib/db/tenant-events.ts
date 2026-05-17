import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantEvent {
  id: string;
  tenant_id: string;
  title: string;
  body: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cta_label: string | null;
  cta_url: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  status: "draft" | "published" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listTenantEvents(tenantId: string): Promise<TenantEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch events: ${error.message}`);
  return (data ?? []) as TenantEvent[];
}

export async function getTenantEventById(
  id: string,
  tenantId: string,
): Promise<TenantEvent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_events")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as TenantEvent;
}

/**
 * Publieke read: eerstvolgende featured event (status='published', starts_at
 * in toekomst óf vandaag). Gebruikt admin-client zodat anon-bezoekers het
 * event kunnen zien — RLS-policy `tenant_events_public_read` whitelist'd
 * dezelfde rows, maar admin-client omzeilt RLS-edge-cases bij anon-sessions.
 */
export async function getFeaturedTenantEvent(
  tenantId: string,
): Promise<TenantEvent | null> {
  const admin = createAdminClient();
  const nowIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Sprint 79 — strict: ALLEEN events met is_featured=true. Wanneer geen
  // event uitgelicht is, retourneert deze functie null (i.p.v. willekeurig
  // gepubliceerd event te tonen).
  const { data } = await admin
    .from("tenant_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .eq("is_featured", true)
    .or(`starts_at.is.null,starts_at.gte.${nowIso}`)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data as TenantEvent | null) ?? null;
}

export interface PublicUpcomingSession {
  session_id: string;
  tenant_id: string;
  starts_at: string;
  ends_at: string;
  title: string | null;
  location: string | null;
  group_id: string | null;
  group_name: string | null;
}

/**
 * Publieke read: aankomende sessies-view. Gebruikt admin-client omdat anon
 * geen `select` op de onderliggende tabellen heeft (alleen op de view zelf
 * via grant) en RLS dit blokkeert. View toont géén PII.
 */
export async function listPublicUpcomingSessions(
  tenantId: string,
  limit = 5,
): Promise<PublicUpcomingSession[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("public_upcoming_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as PublicUpcomingSession[];
}
