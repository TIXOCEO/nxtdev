"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import type { Registration } from "@/types/database";
import { ALL_MEMBERSHIP_STATUSES } from "./registration-statuses";

// NOTE: Constants/types/enums for membership statuses live in the sibling
// `./registration-statuses` module on purpose. Next.js only allows async
// function exports from a "use server" file — anything else is stripped
// from the production bundle and resolves to `undefined` at runtime,
// which previously surfaced as `i.map is not a function` in the admin
// registrations page. Do not re-export them from here.

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const setRegistrationStatusSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  status: z.enum(ALL_MEMBERSHIP_STATUSES),
});

export async function setRegistrationStatus(
  input: z.infer<typeof setRegistrationStatusSchema>,
): Promise<ActionResult<Registration>> {
  const parsed = setRegistrationStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  // Sprint 7 persists the workflow state in `membership_status`. We also
  // write the legacy `status` column to keep older views consistent.
  const { data, error } = await supabase
    .from("registrations")
    .update({
      membership_status: parsed.data.status,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update registration." };
  }

  revalidatePath("/tenant");
  revalidatePath("/tenant/registrations");
  return { ok: true, data: data as Registration };
}
