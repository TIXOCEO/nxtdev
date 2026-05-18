import { createAdminClient } from "@/lib/supabase/admin";

export interface TrainerAthleteRow {
  member_id: string;
  full_name: string;
  email: string | null;
  groups: { id: string; name: string }[];
}

/**
 * Sprint 81 — Leerlingen-overzicht voor een trainer.
 * Vindt alle members die in dezelfde groepen zitten als de ingelogde user
 * (via member-rows van de user), gefilterd op athlete-rol, gegroepeerd per
 * leerling met hun groepen.
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

  // Stap 2: groepen waar ik in zit — tenant_id-filter via groups!inner zodat
  // de query stopt op DB-niveau bij cross-tenant group-membership-rijen.
  const { data: myGroupRows } = await admin
    .from("group_members")
    .select("group_id, groups!inner(id,tenant_id)")
    .in("member_id", myMemberIds)
    .eq("groups.tenant_id", tenantId);
  const groupIds = Array.from(
    new Set(((myGroupRows ?? []) as Array<{ group_id: string }>).map((r) => r.group_id)),
  );
  if (groupIds.length === 0) return [];

  // Stap 3: alle group_members in die groepen + group-naam — tenant_id-filter
  // op zowel groups als members als defense-in-depth bovenop Stap 2.
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

  // Stap 4: filter op athletes via member_roles
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

  // Stap 5: aggregeer per athlete + filter tenant + archived
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
