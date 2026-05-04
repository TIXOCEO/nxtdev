import { createClient } from "@/lib/supabase/server";
import type { TenantTrainingSettings } from "@/types/database";

export interface TrainingSettingsResolved {
  reminder_hours_before: number;
  late_response_hours: number;
  notify_trainer_on_late: boolean;
}

const DEFAULTS: TrainingSettingsResolved = {
  reminder_hours_before: 24,
  late_response_hours: 12,
  notify_trainer_on_late: true,
};

export async function getTrainingSettings(
  tenantId: string,
): Promise<TenantTrainingSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_training_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantTrainingSettings | null) ?? null;
}

export async function getTrainingSettingsResolved(
  tenantId: string,
): Promise<TrainingSettingsResolved> {
  const row = await getTrainingSettings(tenantId);
  if (!row) return DEFAULTS;
  return {
    reminder_hours_before: row.reminder_hours_before,
    late_response_hours: row.late_response_hours,
    notify_trainer_on_late: row.notify_trainer_on_late,
  };
}
