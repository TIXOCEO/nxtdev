import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * True when the user owns a member in the tenant that is in the same group
 * as the given session AND that member carries a trainer role.
 *
 * Returns the trainer member_id when authorized, else null.
 */
export async function trainerInSessionGroup(
  tenantId: string,
  userId: string,
  sessionId: string,
): Promise<{ groupId: string; trainerMemberId: string } | null> {
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("training_sessions")
    .select("id, group_id")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!session) return null;
  const groupId = (session as { group_id: string }).group_id;

  const { data: own } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  const ownIds = ((own ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (ownIds.length === 0) return null;

  // Member must be in the group.
  const { data: gm } = await admin
    .from("group_members")
    .select("member_id")
    .eq("group_id", groupId)
    .in("member_id", ownIds);
  const memberIdsInGroup = ((gm ?? []) as Array<{ member_id: string }>).map(
    (r) => r.member_id,
  );
  if (memberIdsInGroup.length === 0) return null;

  // Trainer role check (member_roles or tenant trainer-role).
  const [{ data: roleRows }, { data: tmrRows }] = await Promise.all([
    admin
      .from("member_roles")
      .select("member_id, role")
      .in("member_id", memberIdsInGroup)
      .eq("role", "trainer"),
    admin
      .from("tenant_member_roles")
      .select("member_id, tenant_roles!inner(is_trainer_role)")
      .eq("tenant_id", tenantId)
      .in("member_id", memberIdsInGroup),
  ]);

  const trainerSet = new Set<string>();
  for (const r of (roleRows ?? []) as Array<{ member_id: string }>) {
    trainerSet.add(r.member_id);
  }
  type TmrRow = {
    member_id: string;
    tenant_roles:
      | { is_trainer_role: boolean }
      | { is_trainer_role: boolean }[]
      | null;
  };
  for (const r of (tmrRows ?? []) as TmrRow[]) {
    const list = Array.isArray(r.tenant_roles)
      ? r.tenant_roles
      : r.tenant_roles
        ? [r.tenant_roles]
        : [];
    if (list.some((tr) => tr.is_trainer_role)) {
      trainerSet.add(r.member_id);
    }
  }
  const trainerMemberId = memberIdsInGroup.find((id) => trainerSet.has(id));
  if (!trainerMemberId) return null;
  return { groupId, trainerMemberId };
}
