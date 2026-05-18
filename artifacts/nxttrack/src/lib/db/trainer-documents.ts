import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TrainerDocument {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  category: "handleiding" | "protocol" | "formulier" | "overig";
  uploaded_by_user_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export async function listTrainerDocuments(
  tenantId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<TrainerDocument[]> {
  const admin = createAdminClient();
  let q = admin
    .from("trainer_documents")
    .select("*")
    .eq("tenant_id", tenantId);
  if (!opts.includeArchived) q = q.eq("is_archived", false);
  const { data } = await q
    .order("category", { ascending: true })
    .order("title", { ascending: true });
  return (data ?? []) as TrainerDocument[];
}

export async function getTrainerDocumentById(
  tenantId: string,
  id: string,
): Promise<TrainerDocument | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trainer_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as TrainerDocument | null;
}
