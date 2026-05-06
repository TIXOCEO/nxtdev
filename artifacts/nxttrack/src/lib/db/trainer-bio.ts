import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TrainerBioFieldType =
  | "short_text"
  | "long_text"
  | "bullet_list"
  | "number"
  | "date";

export interface TrainerBioSection {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainerBioField {
  id: string;
  tenant_id: string;
  section_id: string;
  key: string;
  label: string;
  field_type: TrainerBioFieldType;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainerBioAnswer {
  id: string;
  tenant_id: string;
  member_id: string;
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_list: string[] | null;
  updated_at: string;
}

/** Lazy-seed via Postgres function. Idempotent. */
export async function ensureTrainerBioTemplate(tenantId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("seed_trainer_bio_template", { target_tenant_id: tenantId });
}

export async function listSectionsAdmin(tenantId: string): Promise<TrainerBioSection[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trainer_bio_sections")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as TrainerBioSection[];
}

export async function listFieldsAdmin(tenantId: string): Promise<TrainerBioField[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trainer_bio_fields")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as TrainerBioField[];
}

export async function listActiveTemplate(tenantId: string): Promise<{
  sections: TrainerBioSection[];
  fields: TrainerBioField[];
}> {
  const supabase = await createClient();
  const [{ data: sections }, { data: fields }] = await Promise.all([
    supabase
      .from("trainer_bio_sections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("trainer_bio_fields")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  return {
    sections: (sections ?? []) as TrainerBioSection[],
    fields: (fields ?? []) as TrainerBioField[],
  };
}

export async function getAnswersForMember(
  tenantId: string,
  memberId: string,
): Promise<TrainerBioAnswer[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trainer_bio_answers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId);
  return (data ?? []) as TrainerBioAnswer[];
}

export async function getPublicAnswersForMember(
  tenantId: string,
  memberId: string,
): Promise<TrainerBioAnswer[]> {
  // Public read: relies on RLS (member.show_in_public + active fields).
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainer_bio_answers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId);
  return (data ?? []) as TrainerBioAnswer[];
}

/** Render-helper: returns true when an answer has any meaningful value. */
export function hasAnswerValue(a: TrainerBioAnswer | undefined): boolean {
  if (!a) return false;
  if (a.value_text && a.value_text.trim().length > 0) return true;
  if (a.value_number !== null && a.value_number !== undefined) return true;
  if (a.value_date) return true;
  if (Array.isArray(a.value_list) && a.value_list.some((s) => s && s.trim().length > 0))
    return true;
  return false;
}
