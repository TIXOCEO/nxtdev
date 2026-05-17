import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { CapacityEventCard } from "@/components/tenant/intake/CapacityEventCard";

/**
 * Sprint 76 — /tenant/intake/vrijgekomen-plekken
 *
 * Toont alle open capacity_available_events met top-N wachtlijst-
 * kandidaten per event. Admin-only (geen staff-toegang); zonder
 * dynamic_intake_enabled tonen we een uitleg-card. Houtrust-veilig:
 * zonder events blijft de lijst leeg.
 */

export const dynamic = "force-dynamic";

interface CapacityEventRow {
  id: string;
  group_id: string;
  trigger_source: string;
  freed_seats: number;
  candidate_count: number;
  created_at: string;
  meta: Record<string, unknown> | null;
}

interface WaitlistCandidate {
  submission_id: string;
  contact_name: string | null;
  contact_email: string | null;
  program_id: string | null;
  program_name: string | null;
  created_at: string;
  status: string;
}

export default async function CapacityAvailablePage() {
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/login");

  const user = await requireAuth();
  const [memberships, adminRoleTenants] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const isAdmin = hasTenantAccess(memberships, tenantId, adminRoleTenants);
  if (!isAdmin) redirect("/tenant/intake");

  const admin = createAdminClient();

  const { data: tRow } = await admin
    .from("tenants")
    .select("settings_json")
    .eq("id", tenantId)
    .maybeSingle();
  const settings = (tRow?.settings_json ?? {}) as Record<string, unknown>;
  const dynamicIntakeEnabled = settings.dynamic_intake_enabled === true;

  const { data: eventRows } = await admin
    .from("capacity_available_events")
    .select("id, group_id, trigger_source, freed_seats, candidate_count, created_at, meta")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  const events = (eventRows ?? []) as CapacityEventRow[];

  // Groep-namen ophalen voor alle events
  const groupIds = Array.from(new Set(events.map((e) => e.group_id)));
  const groupNames: Record<string, string> = {};
  if (groupIds.length > 0) {
    const { data: groups } = await admin
      .from("groups")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", groupIds);
    for (const g of groups ?? []) {
      groupNames[g.id as string] = (g.name as string) ?? "—";
    }
  }

  // Top-5 wachtlijst-kandidaten per groep (RPC). Best-effort.
  const candidatesByGroup: Record<string, WaitlistCandidate[]> = {};
  await Promise.all(
    groupIds.map(async (gid) => {
      try {
        const { data, error } = await admin.rpc("find_waitlist_candidates_for", {
          p_group_id: gid,
          p_limit: 5,
        });
        if (!error && Array.isArray(data)) {
          candidatesByGroup[gid] = data as WaitlistCandidate[];
        }
      } catch {
        /* swallow */
      }
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeading
        title="Vrijgekomen plekken"
        description="Automatische signalen wanneer er ergens een plek vrijkomt — met top-wachtlijst-kandidaten en een directe link naar de placement-assistent."
      />

      <p className="text-sm">
        <Link href="/tenant/intake" className="underline" style={{ color: "var(--text-secondary)" }}>
          ← Terug naar intake-overzicht
        </Link>
      </p>

      {!dynamicIntakeEnabled ? (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Dynamic intake is uit voor deze tenant. Vrijgekomen-plek-signalen
            werken alleen wanneer er een wachtlijst kan ontstaan via dynamic
            intake. Vraag een platform-admin om{" "}
            <code>settings_json.dynamic_intake_enabled = true</code> te zetten.
          </p>
        </div>
      ) : null}

      {events.length === 0 ? (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Op dit moment zijn er geen openstaande signalen. Zodra ergens een
            plek vrijkomt (lid verlaat groep, capaciteit wordt verhoogd) en er
            zijn wachtende kandidaten, verschijnt het signaal hier.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((ev) => (
            <CapacityEventCard
              key={ev.id}
              eventId={ev.id}
              groupId={ev.group_id}
              groupName={groupNames[ev.group_id] ?? "—"}
              triggerSource={ev.trigger_source}
              freedSeats={ev.freed_seats}
              candidateCount={ev.candidate_count}
              createdAt={ev.created_at}
              candidates={candidatesByGroup[ev.group_id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
