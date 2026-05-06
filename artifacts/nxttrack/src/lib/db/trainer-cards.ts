import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TrainerCard {
  id: string;
  full_name: string;
  birth_date: string | null;
  photo_url: string | null;
  role_label: string | null;
}

/**
 * Returns members marked show_in_public who are recognised as trainers either
 * via the system role 'trainer' OR via a tenant_role flagged is_trainer_role.
 */
export async function getTrainerCardsForTenant(
  tenantId: string,
  limit?: number,
): Promise<TrainerCard[]> {
  const admin = createAdminClient();

  // 1. Public members in tenant.
  const { data: members } = await admin
    .from("members")
    .select("id, full_name, birth_date")
    .eq("tenant_id", tenantId)
    .eq("show_in_public", true);
  const memberRows = (members ?? []) as Array<{
    id: string;
    full_name: string;
    birth_date: string | null;
  }>;
  if (memberRows.length === 0) return [];
  const memberIds = memberRows.map((m) => m.id);

  // 2. System-role 'trainer' assignments.
  const { data: sysRoles } = await admin
    .from("member_roles")
    .select("member_id, role")
    .in("member_id", memberIds);
  const sysTrainerIds = new Set(
    ((sysRoles ?? []) as Array<{ member_id: string; role: string }>)
      .filter((r) => r.role === "trainer")
      .map((r) => r.member_id),
  );

  // 3. Tenant-role assignments + is_trainer_role flag.
  const { data: tmRoles } = await admin
    .from("tenant_member_roles")
    .select("member_id, tenant_roles!inner(name, is_trainer_role)")
    .eq("tenant_id", tenantId)
    .in("member_id", memberIds);
  type TmRow = {
    member_id: string;
    tenant_roles:
      | { name: string; is_trainer_role: boolean }
      | { name: string; is_trainer_role: boolean }[]
      | null;
  };
  const customRoleByMember = new Map<string, string>();
  const customTrainerIds = new Set<string>();
  for (const r of (tmRoles ?? []) as TmRow[]) {
    const roles = Array.isArray(r.tenant_roles)
      ? r.tenant_roles
      : r.tenant_roles
        ? [r.tenant_roles]
        : [];
    for (const role of roles) {
      if (role.is_trainer_role) {
        customTrainerIds.add(r.member_id);
        if (!customRoleByMember.has(r.member_id))
          customRoleByMember.set(r.member_id, role.name);
      }
    }
  }

  const trainerIds = memberRows
    .map((m) => m.id)
    .filter((id) => sysTrainerIds.has(id) || customTrainerIds.has(id));
  if (trainerIds.length === 0) return [];

  // 4. Profile pictures — resolve template_id -> profile_picture_templates.image_url.
  const { data: pics } = await admin
    .from("member_profile_pictures")
    .select("member_id, template_id")
    .in("member_id", trainerIds);
  const picRows = (pics ?? []) as Array<{
    member_id: string;
    template_id: string | null;
  }>;
  const templateIds = Array.from(
    new Set(picRows.map((p) => p.template_id).filter((t): t is string => !!t)),
  );
  const urlByTemplate = new Map<string, string>();
  if (templateIds.length > 0) {
    const { data: tmpls } = await admin
      .from("profile_picture_templates")
      .select("id, image_url")
      .in("id", templateIds);
    for (const t of (tmpls ?? []) as Array<{ id: string; image_url: string }>) {
      urlByTemplate.set(t.id, t.image_url);
    }
  }
  const picByMember = new Map<string, string | null>();
  for (const p of picRows) {
    const url = p.template_id ? (urlByTemplate.get(p.template_id) ?? null) : null;
    picByMember.set(p.member_id, url);
  }

  const cards: TrainerCard[] = trainerIds.map((id) => {
    const m = memberRows.find((row) => row.id === id)!;
    const customLabel = customRoleByMember.get(id) ?? null;
    const role_label =
      customLabel ?? (sysTrainerIds.has(id) ? "Trainer" : null);
    return {
      id,
      full_name: m.full_name,
      birth_date: m.birth_date,
      photo_url: picByMember.get(id) ?? null,
      role_label,
    };
  });

  cards.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return typeof limit === "number" ? cards.slice(0, limit) : cards;
}
