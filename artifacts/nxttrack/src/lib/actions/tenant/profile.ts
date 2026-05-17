"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
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

// Sprint 78b — Welcome-CTA mag een interne (/foo) of externe (https://...) URL zijn.
const optionalRelOrAbsUrl = z
  .string()
  .trim()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || /^(https?:\/\/|\/)/.test(v),
    "Moet beginnen met http(s):// of /",
  );

const optionalLatitude = z
  .union([
    z.coerce.number().refine((n) => n >= -90 && n <= 90, "Tussen -90 en 90"),
    z.literal(""),
    z.null(),
  ])
  .nullish()
  .transform((v) => (typeof v === "number" ? v : null));

const optionalLongitude = z
  .union([
    z.coerce.number().refine((n) => n >= -180 && n <= 180, "Tussen -180 en 180"),
    z.literal(""),
    z.null(),
  ])
  .nullish()
  .transform((v) => (typeof v === "number" ? v : null));

const optionalShortText = z
  .string()
  .trim()
  .max(120)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalWelcomeText = z
  .string()
  .trim()
  .max(2000, "Max 2000 tekens")
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
  // Sprint 78b — Welkom-kaart
  welcome_text: optionalWelcomeText,
  welcome_more_url: optionalRelOrAbsUrl,
  // Sprint 78b — Locatie-kaart
  location_name: optionalShortText,
  address_line1: optionalShortText,
  postal_code: optionalShortText,
  city: optionalShortText,
  country: optionalShortText,
  latitude: optionalLatitude,
  longitude: optionalLongitude,
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

  const user = await assertTenantAccess(parsed.data.id);

  const supabase = await createClient();
  const { id, ...patch } = parsed.data;

  // Snapshot prior values for change-diff in the audit-log.
  const { data: priorRow } = await supabase
    .from("tenants")
    .select(
      "name, logo_url, primary_color, contact_email, domain, welcome_text, welcome_more_url, location_name, address_line1, postal_code, city, country, latitude, longitude",
    )
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("tenants")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update profile." };
  }

  const prior = (priorRow ?? {}) as Partial<Record<keyof typeof patch, unknown>>;
  const changedKeys = (Object.keys(patch) as Array<keyof typeof patch>).filter(
    (k) => (prior[k] ?? null) !== (patch[k] ?? null),
  );
  if (changedKeys.length > 0) {
    const meta: Record<string, string | number | boolean | null> = {
      changed: changedKeys.join(","),
    };
    if (changedKeys.includes("primary_color")) {
      meta.primary_color = patch.primary_color ?? null;
    }
    if (changedKeys.includes("logo_url")) {
      meta.logo_url_set = patch.logo_url !== null;
    }
    if (changedKeys.includes("name")) {
      meta.name = patch.name;
    }
    await recordAudit({
      tenant_id: id,
      actor_user_id: user.id,
      action: "tenant_profile.update",
      meta,
    });
  }

  revalidatePath("/tenant");
  revalidatePath("/tenant/profile");
  return { ok: true, data: data as Tenant };
}
