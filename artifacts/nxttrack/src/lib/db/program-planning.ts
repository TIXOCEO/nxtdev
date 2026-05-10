import { createClient } from "@/lib/supabase/server";

export interface ProgramInstructorRow {
  member_id: string;
  member_name: string;
  assignment_type: "primary" | "assistant";
  sort_order: number;
}

export interface ProgramResourceRow {
  resource_id: string;
  resource_name: string;
  resource_kind: string | null;
  max_participants: number | null;
  notes: string | null;
  sort_order: number;
}

export interface AvailableTrainerRow {
  id: string;
  full_name: string;
}

export interface AvailableResourceRow {
  id: string;
  name: string;
  kind: string | null;
  capacity: number | null;
}

type MaybeArray<T> = T | T[] | null;
function flat<T>(v: MaybeArray<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Default-instructeurs van een program (Sprint 61). */
export async function listProgramInstructors(
  tenantId: string,
  programId: string,
): Promise<ProgramInstructorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_instructors")
    .select(
      "member_id, assignment_type, sort_order, members!inner(id, full_name, tenant_id)",
    )
    .eq("tenant_id", tenantId)
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listProgramInstructors: ${error.message}`);

  return ((data ?? []) as Array<{
    member_id: string;
    assignment_type: "primary" | "assistant";
    sort_order: number;
    members: MaybeArray<{ id: string; full_name: string; tenant_id: string }>;
  }>)
    .map((r) => {
      const m = flat(r.members);
      if (!m || m.tenant_id !== tenantId) return null;
      return {
        member_id: r.member_id,
        member_name: m.full_name,
        assignment_type: r.assignment_type,
        sort_order: r.sort_order,
      };
    })
    .filter((x): x is ProgramInstructorRow => x !== null)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.member_name.localeCompare(b.member_name, "nl"),
    );
}

/**
 * Trainers binnen de tenant die nog niet op dit program staan. Een member
 * kwalificeert als trainer wanneer (a) er een member_roles-rij role='trainer'
 * bestaat of (b) een tenant_member_roles-koppeling met
 * tenant_roles.is_trainer_role=true.
 */
export async function listAvailableTrainersForProgram(
  tenantId: string,
  programId: string,
): Promise<AvailableTrainerRow[]> {
  const supabase = await createClient();
  const [{ data: existing }, { data: directRoles }, { data: tenantRoles }] =
    await Promise.all([
      supabase
        .from("program_instructors")
        .select("member_id")
        .eq("tenant_id", tenantId)
        .eq("program_id", programId),
      supabase
        .from("member_roles")
        .select("member_id, members!inner(id, full_name, tenant_id, member_status)")
        .eq("role", "trainer")
        .eq("members.tenant_id", tenantId),
      supabase
        .from("tenant_member_roles")
        .select(
          "member_id, members!inner(id, full_name, tenant_id, member_status), tenant_roles!inner(is_trainer_role)",
        )
        .eq("tenant_id", tenantId)
        .eq("tenant_roles.is_trainer_role", true),
    ]);

  const taken = new Set(
    ((existing ?? []) as Array<{ member_id: string }>).map((r) => r.member_id),
  );
  const candidates = new Map<string, AvailableTrainerRow>();

  for (const r of (directRoles ?? []) as Array<{
    member_id: string;
    members: MaybeArray<{ id: string; full_name: string; tenant_id: string; member_status: string | null }>;
  }>) {
    const m = flat(r.members);
    if (!m || m.tenant_id !== tenantId || taken.has(m.id)) continue;
    if (m.member_status === "archived") continue;
    candidates.set(m.id, { id: m.id, full_name: m.full_name });
  }
  for (const r of (tenantRoles ?? []) as Array<{
    member_id: string;
    members: MaybeArray<{ id: string; full_name: string; tenant_id: string; member_status: string | null }>;
  }>) {
    const m = flat(r.members);
    if (!m || m.tenant_id !== tenantId || taken.has(m.id)) continue;
    if (m.member_status === "archived") continue;
    if (!candidates.has(m.id)) candidates.set(m.id, { id: m.id, full_name: m.full_name });
  }

  return Array.from(candidates.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "nl"),
  );
}

/** Default-resources van een program (Sprint 61). */
export async function listProgramResources(
  tenantId: string,
  programId: string,
): Promise<ProgramResourceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_resources")
    .select(
      "resource_id, max_participants, notes, sort_order, capacity_resources!inner(id, name, kind, tenant_id)",
    )
    .eq("tenant_id", tenantId)
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listProgramResources: ${error.message}`);

  return ((data ?? []) as Array<{
    resource_id: string;
    max_participants: number | null;
    notes: string | null;
    sort_order: number;
    capacity_resources: MaybeArray<{
      id: string;
      name: string;
      kind: string | null;
      tenant_id: string;
    }>;
  }>)
    .map((r) => {
      const res = flat(r.capacity_resources);
      if (!res || res.tenant_id !== tenantId) return null;
      return {
        resource_id: r.resource_id,
        resource_name: res.name,
        resource_kind: res.kind,
        max_participants: r.max_participants,
        notes: r.notes,
        sort_order: r.sort_order,
      };
    })
    .filter((x): x is ProgramResourceRow => x !== null)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.resource_name.localeCompare(b.resource_name, "nl"),
    );
}

export async function listAvailableResourcesForProgram(
  tenantId: string,
  programId: string,
): Promise<AvailableResourceRow[]> {
  const supabase = await createClient();
  const [{ data: resources, error }, { data: existing }] = await Promise.all([
    supabase
      .from("capacity_resources")
      .select("id, name, kind, capacity, is_active")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true }),
    supabase
      .from("program_resources")
      .select("resource_id")
      .eq("tenant_id", tenantId)
      .eq("program_id", programId),
  ]);
  if (error) throw new Error(`listAvailableResourcesForProgram: ${error.message}`);

  const taken = new Set(
    ((existing ?? []) as Array<{ resource_id: string }>).map((r) => r.resource_id),
  );
  return ((resources ?? []) as Array<{
    id: string;
    name: string;
    kind: string | null;
    capacity: number | null;
    is_active: boolean;
  }>)
    .filter((r) => r.is_active !== false && !taken.has(r.id))
    .map((r) => ({ id: r.id, name: r.name, kind: r.kind, capacity: r.capacity }));
}

// ═══════════════════════════════════════════════════════════════════
// Cascade-helpers (Sprint 61) — sessie → groep → programma.
// Geserveerd via gewone Supabase reads zodat RLS blijft werken.
// ═══════════════════════════════════════════════════════════════════

export interface SessionCascadeContext {
  session_min_instructors: number | null;
  group_default_min_instructors: number | null;
  program_default_min_instructors: number | null;
}

export interface SessionCapacityContext {
  group_max_members: number | null;
  group_max_athletes: number | null;
  program_default_capacity: number | null;
  program_default_flex_capacity: number | null;
}

async function loadSessionContext(
  tenantId: string,
  sessionId: string,
): Promise<{
  group_id: string;
  program_id: string | null;
  min_instructors: number | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_sessions")
    .select("group_id, program_id, min_instructors")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as {
    group_id: string;
    program_id: string | null;
    min_instructors: number | null;
  } | null) ?? null;
}

/**
 * Effectieve minimum-instructors cascade voor één sessie.
 * Volgorde: session.min_instructors → group.default_min_instructors →
 * program.default_min_instructors → 1 (RPC-default).
 */
export async function getEffectiveMinInstructors(
  tenantId: string,
  sessionId: string,
): Promise<{ value: number; source: "session" | "group" | "program" | "fallback"; ctx: SessionCascadeContext }> {
  const supabase = await createClient();
  const session = await loadSessionContext(tenantId, sessionId);
  if (!session) {
    return {
      value: 1,
      source: "fallback",
      ctx: {
        session_min_instructors: null,
        group_default_min_instructors: null,
        program_default_min_instructors: null,
      },
    };
  }
  const [{ data: group }, programResp] = await Promise.all([
    supabase
      .from("groups")
      .select("default_min_instructors")
      .eq("id", session.group_id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    session.program_id
      ? supabase
          .from("programs")
          .select("default_min_instructors")
          .eq("id", session.program_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ctx: SessionCascadeContext = {
    session_min_instructors: session.min_instructors,
    group_default_min_instructors:
      (group as { default_min_instructors: number | null } | null)?.default_min_instructors ?? null,
    program_default_min_instructors:
      (programResp.data as { default_min_instructors: number | null } | null)?.default_min_instructors ??
      null,
  };

  if (ctx.session_min_instructors != null)
    return { value: ctx.session_min_instructors, source: "session", ctx };
  if (ctx.group_default_min_instructors != null)
    return { value: ctx.group_default_min_instructors, source: "group", ctx };
  if (ctx.program_default_min_instructors != null)
    return { value: ctx.program_default_min_instructors, source: "program", ctx };
  return { value: 1, source: "fallback", ctx };
}

/**
 * Effectieve capaciteit-cascade (informatief — handhaving blijft op
 * groups.max_members via Sprint 42-trigger).
 */
export async function getEffectiveCapacity(
  tenantId: string,
  sessionId: string,
): Promise<{
  capacity: number | null;
  flex_capacity: number | null;
  source: "group" | "program" | "none";
  ctx: SessionCapacityContext;
}> {
  const supabase = await createClient();
  const session = await loadSessionContext(tenantId, sessionId);
  if (!session) {
    return {
      capacity: null,
      flex_capacity: null,
      source: "none",
      ctx: {
        group_max_members: null,
        group_max_athletes: null,
        program_default_capacity: null,
        program_default_flex_capacity: null,
      },
    };
  }
  const [{ data: group }, programResp] = await Promise.all([
    supabase
      .from("groups")
      .select("max_members, max_athletes")
      .eq("id", session.group_id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    session.program_id
      ? supabase
          .from("programs")
          .select("default_capacity, default_flex_capacity")
          .eq("id", session.program_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const groupRow = group as { max_members: number | null; max_athletes: number | null } | null;
  const programRow = programResp.data as {
    default_capacity: number | null;
    default_flex_capacity: number | null;
  } | null;

  const ctx: SessionCapacityContext = {
    group_max_members: groupRow?.max_members ?? null,
    group_max_athletes: groupRow?.max_athletes ?? null,
    program_default_capacity: programRow?.default_capacity ?? null,
    program_default_flex_capacity: programRow?.default_flex_capacity ?? null,
  };

  if (ctx.group_max_members != null) {
    return { capacity: ctx.group_max_members, flex_capacity: null, source: "group", ctx };
  }
  if (ctx.program_default_capacity != null) {
    return {
      capacity: ctx.program_default_capacity,
      flex_capacity: ctx.program_default_flex_capacity,
      source: "program",
      ctx,
    };
  }
  return { capacity: null, flex_capacity: null, source: "none", ctx };
}
