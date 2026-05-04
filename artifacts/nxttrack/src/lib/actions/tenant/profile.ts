"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import type { Tenant } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const optionalUrl = z
  .string()
  .trim()
  .url()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalEmail = z
  .string()
  .trim()
  .email()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalText = z
  .string()
  .trim()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const tenantProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  logo_url: optionalUrl,
  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #b6d83b")
    .default("#b6d83b"),
  contact_email: optionalEmail,
  domain: optionalText,
});

export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;

/**
 * Tenant-admin-scoped tenant profile update. Tenant admins can only edit
 * fields they own (no slug/status changes — those stay platform-admin only
 * via the platform action).
 */
export async function updateTenantProfile(
  input: TenantProfileInput,
): Promise<ActionResult<Tenant>> {
  const parsed = tenantProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await assertTenantAccess(parsed.data.id);

  const supabase = await createClient();
  const { id, ...patch } = parsed.data;
  const { data, error } = await supabase
    .from("tenants")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update profile." };
  }

  revalidatePath("/tenant");
  revalidatePath("/tenant/profile");
  return { ok: true, data: data as Tenant };
}
