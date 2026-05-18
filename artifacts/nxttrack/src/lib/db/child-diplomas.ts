import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ChildDiploma {
  id: string;
  tenant_id: string;
  member_id: string;
  diploma_name: string;
  level: string | null;
  awarded_on: string;
  awarded_by_member_id: string | null;
  certificate_url: string | null;
  photo_url: string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listDiplomasForMembers(
  tenantId: string,
  memberIds: string[],
): Promise<ChildDiploma[]> {
  if (memberIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("child_diplomas")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("member_id", memberIds)
    .order("awarded_on", { ascending: false });
  return (data ?? []) as ChildDiploma[];
}

export async function listDiplomasForTenant(
  tenantId: string,
): Promise<ChildDiploma[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("child_diplomas")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("awarded_on", { ascending: false });
  return (data ?? []) as ChildDiploma[];
}
