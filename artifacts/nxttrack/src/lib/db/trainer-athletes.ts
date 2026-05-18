import { createAdminClient } from "@/lib/supabase/admin";

export interface TrainerAthleteRow {
  member_id: string;
  full_name: string;
  email: string | null;
  groups: { id: string; name: string }[];
}

/**
 * Sprint 81 — Leerlingen-overzicht voor een trainer.
 *
 * Authorization-pad (instructor-bound, niet alleen "lid van groep"):
 *  1. Mijn member-rows in deze tenant (members.user_id = userId).
 *  2. Sessies waar ik officieel instructeur ben (session_instructors.member_id = mijn-id,
 *     tenant_id = tenant). Dit is de canonical bron van "ben jij hier trainer?".
 *  3. Uit die sessies → unieke group_ids (training_sessions.group_id), tenant-gefilterd.
 *  4. Group_members van die groepen → kandidaat-members (excl. mijzelf).
 *  5. Filter op member_roles.role='athlete' + archived_at IS NULL.
 *
 * Alle reads via admin-client met expliciete tenant_id-filters via !inner JOINs zodat
 * cross-tenant rijen op DB-niveau wegvallen.
 */
export async function listAthletesForTrainer(
  tenantId: string,
  userId: string,
): Promise<TrainerAthleteRow[]> {
  const admin = createAdminClient();

  // Stap 1: mijn member-rows in deze tenant
  const { data: myMembers } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  const myMemberIds = ((myMembers ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (myMemberIds.length === 0) return [];

  // Stap 2: sessies waar ik officieel als instructeur is toegewezen
  const { data: instructorRows } = await admin
    .from("session_instructors")
    .select("session_id, tenant_id")
    .eq("tenant_id", tenantId)
    .in("member_id", myMemberIds);
  const sessionIds = Array.from(
    new Set(
      ((instructorRows ?? []) as Array<{ session_id: string }>).map(
        (r) => r.session_id,
      ),
    ),
  );
  if (sessionIds.length === 0) return [];

  // Stap 3: group_ids uit die sessies (tenant-gefilterd via inner-join)
  const { data: sessionRows } = await admin
    .from("training_sessions")
    .select("id, group_id, tenant_id")
    .eq("tenant_id", tenantId)
    .in("id", sessionIds);
  const groupIds = Array.from(
    new Set(
      ((sessionRows ?? []) as Array<{ group_id: string | null }>)
        .map((r) => r.group_id)
        .filter((id): id is string => !!id),
    ),
  );
  if (groupIds.length === 0) return [];

  // Stap 4: group_members in die groepen — tenant_id-filter via groups!inner +
  // members!inner als defense-in-depth bovenop de admin-client (geen RLS).
  const { data: rows } = await admin
    .from("group_members")
    .select("member_id, group_id, groups!inner(id,name,tenant_id), members!inner(id,full_name,email,tenant_id,archived_at)")
    .in("group_id", groupIds)
    .eq("groups.tenant_id", tenantId)
    .eq("members.tenant_id", tenantId);

  type Row = {
    member_id: string;
    group_id: string;
    groups:
      | { id: string; name: string; tenant_id: string }
      | { id: string; name: string; tenant_id: string }[]
      | null;
    members:
      | { id: string; full_name: string; email: string | null; tenant_id: string; archived_at: string | null }
      | { id: string; full_name: string; email: string | null; tenant_id: string; archived_at: string | null }[]
      | null;
  };
  function flat<T>(v: T | T[] | null): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  }

  // Stap 5: filter op athletes via member_roles, sluit mijzelf uit
  const candidateMemberIds = Array.from(
    new Set(
      ((rows ?? []) as Row[])
        .map((r) => r.member_id)
        .filter((id) => !myMemberIds.includes(id)),
    ),
  );
  if (candidateMemberIds.length === 0) return [];

  const { data: roleRows } = await admin
    .from("member_roles")
    .select("member_id, role")
    .in("member_id", candidateMemberIds)
    .eq("role", "athlete");
  const athleteIds = new Set(
    ((roleRows ?? []) as Array<{ member_id: string }>).map((r) => r.member_id),
  );
  if (athleteIds.size === 0) return [];

  // Stap 6: aggregeer per athlete + filter tenant + archived
  const byMember = new Map<string, TrainerAthleteRow>();
  for (const r of (rows ?? []) as Row[]) {
    if (!athleteIds.has(r.member_id)) continue;
    const m = flat(r.members);
    if (!m || m.tenant_id !== tenantId || m.archived_at) continue;
    const g = flat(r.groups);
    if (!g || g.tenant_id !== tenantId) continue;

    let entry = byMember.get(r.member_id);
    if (!entry) {
      entry = {
        member_id: m.id,
        full_name: m.full_name,
        email: m.email,
        groups: [],
      };
      byMember.set(r.member_id, entry);
    }
    if (!entry.groups.some((x) => x.id === g.id)) {
      entry.groups.push({ id: g.id, name: g.name });
    }
  }

  return Array.from(byMember.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "nl"),
  );
}
