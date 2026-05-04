"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import {
  trainingSettingsSchema,
  type TrainingSettingsInput,
} from "@/lib/validation/trainings";
import type { TenantTrainingSettings } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export async function saveTrainingSettings(
  input: TrainingSettingsInput,
): Promise<ActionResult<TenantTrainingSettings>> {
  const parsed = trainingSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenant_training_settings")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        reminder_hours_before: parsed.data.reminder_hours_before,
        late_response_hours: parsed.data.late_response_hours,
        notify_trainer_on_late: parsed.data.notify_trainer_on_late,
      },
      { onConflict: "tenant_id" },
    )
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon instellingen niet opslaan.");

  revalidatePath("/tenant/settings/training");
  return { ok: true, data: data as TenantTrainingSettings };
}
