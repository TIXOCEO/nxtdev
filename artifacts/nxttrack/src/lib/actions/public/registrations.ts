"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  publicMembershipRegistrationSchema,
  publicOnboardingSchema,
  publicRegistrationSchema,
  publicTryoutSchema,
  type PublicAccountType,
  type PublicMembershipRegistrationInput,
  type PublicOnboardingInput,
  type PublicRegistrationInput,
  type PublicTryoutInput,
} from "@/lib/validation/public-registration";
import { notifyPlatformOfRegistration } from "@/lib/email/platform-notify";
import { generateInviteToken } from "@/lib/invites/generate-token";
import { generateInviteCode } from "@/lib/invites/generate-code";
import { dispatchInvite } from "@/lib/actions/tenant/invites";
import type { MemberInvite } from "@/types/database";

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
// Sprint 23 / Sprint C — Publieke onboarding-wizard.
//
// Schrijft direct naar `members` (+ `member_links` voor parent→child
// of koppelcode-links) en verstuurt per parent/athleet/staff/trainer
// een account-invite zodat de inschrijver later een wachtwoord kan
// instellen. Trainer/staff alleen wanneer
// `tenants.settings_json.public_staff_registration_enabled === true`.
// ──────────────────────────────────────────────────────────────────

const ACCOUNT_INVITE_TYPE: Record<
  PublicAccountType,
  "parent_account" | "adult_athlete_account" | "trainer_account" | "staff_account"
> = {
  parent: "parent_account",
  adult_athlete: "adult_athlete_account",
  trainer: "trainer_account",
  staff: "staff_account",
};

const ACCOUNT_TYPE_TO_MEMBER: Record<PublicAccountType, string> = {
  parent: "parent",
  adult_athlete: "athlete",
  trainer: "trainer",
  staff: "staff",
};

const ACCOUNT_TYPE_TO_ROLE: Record<PublicAccountType, string> = {
  parent: "parent",
  adult_athlete: "athlete",
  trainer: "trainer",
  staff: "staff",
};

const ACCOUNT_TYPE_STATUS: Record<PublicAccountType, "aspirant" | "pending"> = {
  parent: "aspirant",
  adult_athlete: "aspirant",
  trainer: "pending",
  staff: "pending",
};

interface PublicTenantContext {
  id: string;
  slug: string;
  settings_json: Record<string, unknown>;
}

async function resolveActiveTenantContext(
  slug: string,
): Promise<PublicTenantContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, settings_json")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: (data as { id: string }).id,
    slug: (data as { slug: string }).slug,
    settings_json:
      ((data as { settings_json: Record<string, unknown> | null })
        .settings_json as Record<string, unknown> | null) ?? {},
  };
}

function expiryFromNowDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Inline koppelcode lookup (gebruikt door de publieke registratie-wizard).
 * Geeft de child-naam terug zodat de ouder direct ziet welk kind hij koppelt.
 * Tenant-scoped: we doen alle checks server-side; de anonieme caller krijgt
 * alleen ok|error + (bij ok) een first-name terug — geen member-id of e-mail.
 */
export async function lookupKoppelCode(
  tenantSlug: string,
  rawCode: string,
): Promise<
  | { ok: true; child_first_name: string }
  | { ok: false; error: string }
> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}(-[A-Z0-9]{2,8})?$/.test(code)) {
    return { ok: false, error: "Voer een geldige koppelcode in." };
  }
  const tenant = await resolveActiveTenantContext(tenantSlug);
  if (!tenant) return { ok: false, error: "Onbekende vereniging." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("member_invites")
    .select("child_member_id, status, expires_at")
    .eq("tenant_id", tenant.id)
    .eq("invite_code", code)
    .maybeSingle();

  if (
    !invite ||
    !invite.child_member_id ||
    invite.status === "revoked" ||
    invite.status === "expired" ||
    new Date(invite.expires_at as string).getTime() < Date.now()
  ) {
    return { ok: false, error: "Koppelcode is ongeldig of verlopen." };
  }

  const { data: child } = await admin
    .from("members")
    .select("first_name, full_name")
    .eq("id", invite.child_member_id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const name =
    (child?.first_name as string | undefined) ??
    ((child?.full_name as string | undefined) ?? "").split(" ")[0] ??
    "";
  return { ok: true, child_first_name: name };
}

async function loadInviteExpiryDays(tenantId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_email_settings")
    .select("invite_expiry_days")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data?.invite_expiry_days as number | undefined) ?? 7;
}

export async function submitPublicRegistration(
  input: PublicOnboardingInput,
): Promise<PublicActionResult<{ member_id: string; account_type: PublicAccountType }>> {
  const parsed = publicOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }

  const v = parsed.data;
  const tenant = await resolveActiveTenantContext(v.tenant_slug);
  if (!tenant) return fail("Deze pagina is niet langer beschikbaar.");

  if (v.account_type === "trainer" || v.account_type === "staff") {
    const allowed = tenant.settings_json["public_staff_registration_enabled"];
    if (allowed !== true) {
      return fail("Dit type aanmelding is voor deze vereniging niet beschikbaar.");
    }
  }

  const admin = createAdminClient();
  const fullName = `${v.first_name.trim()} ${v.last_name.trim()}`.trim();
  const status = ACCOUNT_TYPE_STATUS[v.account_type];

  // 1. Atomic write (parent + children + roles + links) via Postgres-RPC.
  //    De RPC `public.create_public_registration` voert alles binnen één
  //    transactie uit; bij failure rolt alles terug zodat we geen
  //    half-aangemaakte members/links achterlaten.
  const childrenPayload =
    v.account_type === "parent"
      ? v.children.map((c) =>
          c.mode === "new"
            ? {
                mode: "new" as const,
                first_name: c.first_name.trim(),
                last_name: c.last_name.trim(),
                birth_date: c.birth_date,
                player_type: c.player_type ?? null,
              }
            : {
                mode: "link" as const,
                koppel_code: (c.koppel_code ?? "").toUpperCase(),
              },
        )
      : [];

  const { data: rpcId, error: rpcErr } = await admin.rpc(
    "create_public_registration",
    {
      p_tenant_id: tenant.id,
      p_account_type: v.account_type,
      p_first_name: v.first_name.trim(),
      p_last_name: v.last_name.trim(),
      p_email: v.email,
      p_phone: v.phone,
      p_birth_date: v.account_type === "adult_athlete" ? v.birth_date : null,
      p_player_type:
        v.account_type === "adult_athlete" ? v.player_type ?? null : null,
      p_status: status,
      p_role: ACCOUNT_TYPE_TO_ROLE[v.account_type],
      p_children: childrenPayload,
    },
  );

  if (rpcErr || !rpcId) {
    const msg = rpcErr?.message ?? "Aanmelding kon niet worden opgeslagen.";
    if (msg.includes("invalid_koppel_code")) {
      return fail("Koppelcode is ongeldig of verlopen.", {
        children: ["Controleer de koppelcode en probeer opnieuw."],
      });
    }
    return fail(msg);
  }
  const primaryId = rpcId as unknown as string;

  // 3. Account-invite zodat de inschrijver een wachtwoord kan instellen.
  const expiryDays = await loadInviteExpiryDays(tenant.id);
  const token = generateInviteToken();
  const code = generateInviteCode();
  const { data: invRow, error: invErr } = await admin
    .from("member_invites")
    .insert({
      tenant_id: tenant.id,
      member_id: primaryId,
      invite_type: ACCOUNT_INVITE_TYPE[v.account_type],
      email: v.email,
      full_name: fullName,
      token,
      invite_code: code,
      status: "pending",
      expires_at: expiryFromNowDays(expiryDays),
      created_by: null,
    })
    .select()
    .single();
  if (invErr || !invRow) {
    // Member is al aangemaakt — invite kon niet worden geplaatst. Niet fataal:
    // de tenant-admin kan handmatig opnieuw uitnodigen.
    // eslint-disable-next-line no-console
    console.error(
      "[public-registration] invite insert failed:",
      invErr?.message,
    );
  } else {
    // Fire-and-forget: stuur de account-activatie-mail. Mocht het versturen
    // mislukken (bv. SMTP down) dan blijft de invite-rij in 'pending' staan
    // en kan een admin opnieuw versturen vanuit het uitnodigingenoverzicht.
    try {
      const sent = await dispatchInvite(
        tenant.id,
        invRow as MemberInvite,
        "public_registration",
      );
      if (!sent.ok) {
        // eslint-disable-next-line no-console
        console.error("[public-registration] invite dispatch failed:", sent.error);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[public-registration] invite dispatch threw:", err);
    }
  }

  return {
    ok: true,
    data: { member_id: primaryId, account_type: v.account_type },
  };
}

// ──────────────────────────────────────────────────────────────────
// Legacy (sprint-6) — behouden zodat oude imports niet breken.
// Schrijft naar de oude `registrations`-queue.
// ──────────────────────────────────────────────────────────────────
export async function submitLegacyPublicRegistration(
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
