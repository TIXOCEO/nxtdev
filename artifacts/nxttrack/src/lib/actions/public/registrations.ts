"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  publicMembershipRegistrationSchema,
  publicRegistrationSchema,
  publicTryoutSchema,
  type PublicMembershipRegistrationInput,
  type PublicRegistrationInput,
  type PublicTryoutInput,
} from "@/lib/validation/public-registration";
import { notifyPlatformOfRegistration } from "@/lib/email/platform-notify";

async function fetchTenantNameAndSlug(
  tenantId: string,
): Promise<{ name: string; slug: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantId)
    .maybeSingle();
  return {
    name: (data?.name as string | undefined) ?? "(onbekende tenant)",
    slug: (data?.slug as string | undefined) ?? "",
  };
}

/**
 * Stuur fire-and-forget een notificatie naar de platform admins.
 * Faalt stilletjes — de gebruiker van het formulier mag hier nooit
 * door geblokkeerd worden.
 */
async function dispatchPlatformNotice(
  tenantId: string,
  registrationId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const [{ name, slug }, { data: reg }] = await Promise.all([
      fetchTenantNameAndSlug(tenantId),
      admin
        .from("registrations")
        .select(
          "id, type, registration_target, parent_name, parent_email, parent_phone, child_name, date_of_birth, player_type, address, postal_code, city, extra_details, athletes_json",
        )
        .eq("id", registrationId)
        .maybeSingle(),
    ]);
    if (!reg) return;
    await notifyPlatformOfRegistration({
      tenantName: name,
      tenantSlug: slug,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registration: reg as any,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[registrations] platform notify failed:", err);
  }
}

export type PublicActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): PublicActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Resolve a tenant id from a public-facing slug, only if the tenant is
 * active. Uses the anon-keyed client so RLS is the source of truth.
 */
async function resolveActiveTenantId(slug: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

// ──────────────────────────────────────────────────────────────────
// Sprint 7 — Proefles (tryout) submission.
// ──────────────────────────────────────────────────────────────────
export async function submitTryoutRegistration(
  input: PublicTryoutInput,
): Promise<PublicActionResult<{ id: string }>> {
  const parsed = publicTryoutSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }

  const tenantId = await resolveActiveTenantId(parsed.data.tenant_slug);
  if (!tenantId) {
    return fail("Deze pagina is niet langer beschikbaar.");
  }

  // Service-role insert — public RLS may not be enabled in every env;
  // input is fully Zod-validated and tenant id is server-resolved.
  const admin = createAdminClient();
  const v = parsed.data;
  const { data: created, error: insErr } = await admin
    .from("registrations")
    .insert({
      tenant_id: tenantId,
      type: "tryout",
      membership_status: "new",
      status: "new",
      registration_target: v.registration_target,
      // For child-target, full_name belongs to the parent/guardian; for
      // self-target, full_name IS the player — store it under child_name so
      // the admin list (which prefers parent_name ?? child_name) shows the
      // player's name instead of mis-labelling them as a guardian.
      parent_name: v.registration_target === "child" ? v.full_name : null,
      parent_email: v.email,
      parent_phone: v.phone,
      child_name:
        v.registration_target === "child" ? v.child_name : v.full_name,
      date_of_birth: v.date_of_birth,
      player_type: v.player_type,
      extra_details: v.extra_details,
      agreed_terms: v.agreed_terms,
      athletes_json: [],
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return fail(
      insErr?.message ??
        "Aanmelding kon niet worden verwerkt. Probeer het opnieuw.",
    );
  }
  // Fire-and-forget notificatie naar platform admins.
  void dispatchPlatformNotice(tenantId, created.id);
  return { ok: true, data: { id: created.id } };
}

// ──────────────────────────────────────────────────────────────────
// Sprint 7 — Inschrijving (aspirant membership) submission.
// ──────────────────────────────────────────────────────────────────
export async function submitMembershipRegistration(
  input: PublicMembershipRegistrationInput,
): Promise<PublicActionResult<{ id: string }>> {
  const parsed = publicMembershipRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }

  const tenantId = await resolveActiveTenantId(parsed.data.tenant_slug);
  if (!tenantId) {
    return fail("Deze pagina is niet langer beschikbaar.");
  }

  const v = parsed.data;
  const admin = createAdminClient();
  const { data: created, error: insErr } = await admin
    .from("registrations")
    .insert({
      tenant_id: tenantId,
      type: "registration",
      membership_status: "aspirant",
      status: "new",
      registration_target: v.registration_target,
      parent_name: v.full_name,
      parent_email: v.email,
      parent_phone: v.phone,
      address: v.address,
      postal_code: v.postal_code,
      city: v.city,
      date_of_birth: v.registration_target === "self" ? v.date_of_birth : null,
      player_type: v.registration_target === "self" ? v.player_type : null,
      child_name:
        v.registration_target === "child" && v.athletes[0]
          ? v.athletes[0].full_name
          : null,
      extra_details: v.extra_details,
      agreed_terms: v.agreed_terms,
      athletes_json: v.registration_target === "child" ? v.athletes : [],
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return fail(
      insErr?.message ??
        "Inschrijving kon niet worden verwerkt. Probeer het opnieuw.",
    );
  }
  void dispatchPlatformNotice(tenantId, created.id);
  return { ok: true, data: { id: created.id } };
}

// ──────────────────────────────────────────────────────────────────
// Legacy (sprint-6) — kept for the /register → /inschrijven redirect
// transition window. Inserts as a 'registration' with aspirant status.
// ──────────────────────────────────────────────────────────────────
export async function submitPublicRegistration(
  input: PublicRegistrationInput,
): Promise<PublicActionResult<{ id: string }>> {
  const parsed = publicRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }

  const tenantId = await resolveActiveTenantId(parsed.data.tenant_slug);
  if (!tenantId) return fail("Deze pagina is niet langer beschikbaar.");

  const admin = createAdminClient();
  const v = parsed.data;
  const { data: created, error: insErr } = await admin
    .from("registrations")
    .insert({
      tenant_id: tenantId,
      type: "registration",
      membership_status: "aspirant",
      status: "new",
      registration_target: "child",
      parent_name: v.parent_name,
      parent_email: v.parent_email,
      parent_phone: v.parent_phone,
      child_name: v.child_name,
      child_age: v.child_age,
      message: v.message,
      athletes_json: [],
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return fail(insErr?.message ?? "Aanmelding mislukt. Probeer het opnieuw.");
  }
  void dispatchPlatformNotice(tenantId, created.id);
  return { ok: true, data: { id: created.id } };
}
