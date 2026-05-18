import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TrainerTask {
  id: string;
  tenant_id: string;
  assigned_to_user_id: string;
  created_by_user_id: string | null;
  title: string;
  body: string | null;
  due_date: string | null;
  status: "open" | "done" | "cancelled";
  priority: "low" | "normal" | "high";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listTrainerTasksForUser(
  tenantId: string,
  userId: string,
): Promise<TrainerTask[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trainer_tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("assigned_to_user_id", userId)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as TrainerTask[];
}

export async function listTrainerTasksForAdmin(
  tenantId: string,
): Promise<TrainerTask[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trainer_tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as TrainerTask[];
}

export async function getTrainerTaskById(
  tenantId: string,
  id: string,
): Promise<TrainerTask | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trainer_tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as TrainerTask | null;
}
