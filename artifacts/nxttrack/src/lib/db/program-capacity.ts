import { createClient } from "@/lib/supabase/server";

export interface CapacityOverviewRow {
  tenant_id: string;
  session_id: string;
  session_title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  group_id: string;
  group_name: string | null;
  program_id: string | null;
  program_name: string | null;
  program_visibility: "public" | "internal" | "archived" | null;
  fixed_capacity: number | null;
  fixed_capacity_source: "session_resources" | "group" | "program" | null;
  flex_capacity: number;
  used_count: number;
  purpose_breakdown_json: Record<string, unknown>;
}

/**
 * Capaciteit-overzicht voor de komende `windowDays` dagen
 * (default 90). RLS via security_invoker=true op de view.
 */
export async function listCapacityOverview(
  tenantId: string,
  windowDays = 90,
): Promise<CapacityOverviewRow[]> {
  const supabase = await createClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("program_capacity_overview")
    .select(
      "tenant_id, session_id, session_title, starts_at, ends_at, status, group_id, group_name, program_id, program_name, program_visibility, fixed_capacity, fixed_capacity_source, flex_capacity, used_count, purpose_breakdown_json",
    )
    .eq("tenant_id", tenantId)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString())
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`listCapacityOverview: ${error.message}`);
  return (data ?? []) as CapacityOverviewRow[];
}

/**
 * Per programma de meest "kritieke" komende sessie — voor de
 * kleurband op /tenant/programmas. Returnt een Map<program_id, row>.
 *
 * Selectie-regel: hoogste used/fixed-ratio binnen 60 dagen, met
 * voorrang voor sessies waarvan fixed_capacity bekend is. Sessies
 * zonder fixed_capacity (onbeperkt) tellen alleen mee als er geen
 * sessie-met-cap is.
 */
export async function listProgramCapacityHighlights(
  tenantId: string,
): Promise<Map<string, CapacityOverviewRow>> {
  const supabase = await createClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("program_capacity_overview")
    .select(
      "tenant_id, session_id, session_title, starts_at, ends_at, status, group_id, group_name, program_id, program_name, program_visibility, fixed_capacity, fixed_capacity_source, flex_capacity, used_count, purpose_breakdown_json",
    )
    .eq("tenant_id", tenantId)
    .not("program_id", "is", null)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString())
    .limit(2000);
  if (error) throw new Error(`listProgramCapacityHighlights: ${error.message}`);

  const out = new Map<string, CapacityOverviewRow>();
  for (const r of (data ?? []) as CapacityOverviewRow[]) {
    if (!r.program_id) continue;
    const cur = out.get(r.program_id);
    if (!cur) {
      out.set(r.program_id, r);
      continue;
    }
    const ratio = (row: CapacityOverviewRow) =>
      row.fixed_capacity && row.fixed_capacity > 0
        ? row.used_count / row.fixed_capacity
        : -1;
    if (ratio(r) > ratio(cur)) out.set(r.program_id, r);
  }
  return out;
}
