"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import {
  newMemberWithInviteSchema,
  inviteIdSchema,
  acceptAdultInviteSchema,
  acceptMinorLinkSchema,
  acceptMinorParentSchema,
  linkMinorByCodeSchema,
  convertRegistrationSchema,
  generateMinorCodeSchema,
  type NewMemberWithInviteInput,
  type AcceptAdultInviteInput,
  type AcceptMinorLinkInput,
  type AcceptMinorParentInput,
  type LinkMinorByCodeInput,
  type ConvertRegistrationInput,
  type GenerateMinorCodeInput,
} from "@/lib/validation/invites";
import { generateInviteToken } from "@/lib/invites/generate-token";
import { generateInviteCode } from "@/lib/invites/generate-code";
import { detectDuplicateAdult, type DuplicateCandidate } from "@/lib/members/detect-duplicate";
import { sendEmail } from "@/lib/email/send-email";
import { DEFAULT_TEMPLATES } from "@/lib/email/default-templates";
import {
  INVITE_TEMPLATE_KEY,
  STAFF_INVITE_TYPES,
  type InviteTypeLiteral,
} from "./invite-statuses";
import { requireAuth } from "@/lib/auth/require-auth";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import type {
  MemberInvite,
  Member,
  Registration,
  RegistrationAthleteEntry,
} from "@/types/database";
import { tenantUrl, type TenantHostInfo } from "@/lib/url";
import type { SupabaseClient } from "@supabase/supabase-js";

// NOTE: per the Sprint-7 lesson, only async functions are exported here.
// Constants/types live in ./invite-statuses.ts and validation/invites.ts.

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// ── helpers ────────────────────────────────────────────────

interface TenantInviteSettings {
  invite_expiry_days: number;
  max_resend_count: number;
  resend_cooldown_days: number;
}

async function loadInviteSettings(tenantId: string): Promise<TenantInviteSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_email_settings")
    .select("invite_expiry_days, max_resend_count, resend_cooldown_days")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return {
    invite_expiry_days: (data?.invite_expiry_days as number | undefined) ?? 2,
    max_resend_count: (data?.max_resend_count as number | undefined) ?? 3,
    resend_cooldown_days:
      (data?.resend_cooldown_days as number | undefined) ?? 1,
  };
}

function expiryFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Validate that a member id belongs to the given tenant. Closes the
 * cross-tenant reference gap on `member_invites` / `member_links` FKs
 * (which only enforce existence, not tenant equality).
 */
async function assertMemberInTenant(
  memberId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Lid niet gevonden in deze club." };
  return { ok: true };
}

/**
 * Pageinated lookup van een Supabase auth-user op email-adres.
 * Supabase admin API biedt geen direct getUserByEmail, dus we paginene
 * door listUsers tot we de gebruiker vinden of de pagina's op zijn.
 */
async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === target,
    );
    if (found) return { id: found.id, email: found.email ?? target };
    if (data.users.length < perPage) return null;
  }
  return null;
}

function inviteLink(tenant: TenantHostInfo, token: string): string {
  // Tenant-aware: gebruikt custom domain als dat is ingesteld, anders
  // het subdomein onder onze apex. In dev/local valt het terug op een
  // pad-gebaseerde URL onder /t/<slug>/...
  return tenantUrl(tenant, `/invite/${token}`);
}

export async function dispatchInvite(
  tenantId: string,
  invite: MemberInvite,
  triggerSource: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("name, slug, domain, contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Tenant niet gevonden." };

  const link = inviteLink(
    { slug: tenant.slug as string, domain: tenant.domain as string | null },
    invite.token,
  );
  const expiry = new Date(invite.expires_at).toLocaleDateString("nl-NL");

  const variables: Record<string, string> = {
    tenant_name: tenant.name as string,
    tenant_contact_email: (tenant.contact_email as string | null) ?? "",
    member_name: invite.full_name ?? "",
    parent_name: invite.full_name ?? "",
    athlete_name: "",
    function_label: "",
    invite_link: link,
    invite_code: invite.invite_code,
    complete_registration_link: link,
    minor_link_url: link,
    expiry_date: expiry,
  };

  // For minor_parent_link, fetch the child's name.
  if (invite.child_member_id) {
    const { data: child } = await admin
      .from("members")
      .select("full_name")
      .eq("id", invite.child_member_id)
      .maybeSingle();
    variables.athlete_name = (child?.full_name as string | null) ?? "";
  }

  // For staff/trainer invites, derive the `function_label` variable from
  // the member's assigned roles so the email reads "trainer" / "staf"
  // instead of a generic salutation.
  if (
    invite.member_id &&
    STAFF_INVITE_TYPES.has(invite.invite_type as InviteTypeLiteral)
  ) {
    variables.function_label = await resolveFunctionLabel(
      invite.member_id,
      invite.invite_type as InviteTypeLiteral,
    );
  }

  const templateKey = INVITE_TEMPLATE_KEY[invite.invite_type as InviteTypeLiteral];
  if (!templateKey) {
    return { ok: false, error: `Onbekend uitnodigingstype: ${invite.invite_type}` };
  }

  // Backward-compat (sprint 21): tenants seeded before `staff_invite` was
  // introduced won't have a row for it yet. Lazily seed the missing default
  // so trainer/staff invites don't hard-fail on first send. Idempotent —
  // does nothing if the row already exists.
  await ensureTenantTemplate(tenantId, templateKey);

  const res = await sendEmail({
    tenantId,
    templateKey,
    to: invite.email,
    variables,
    triggerSource,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await admin
    .from("member_invites")
    .update({
      status: "sent",
      last_sent_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  return { ok: true };
}

/**
 * Smart dispatcher voor de "ouder koppel kind via code"-flow.
 * - Heeft de ouder al een auth-account? → mail met code + login-link
 *   (template: parent_link_with_code, event: parent_link_existing_account)
 * - Nog geen account? → maak ook een account_invite voor de ouder en
 *   stuur een gecombineerde mail met registratie-link + code
 *   (template: parent_register_then_link, event: parent_link_no_account)
 */
async function dispatchParentLinkCode(params: {
  tenantId: string;
  invite: MemberInvite;
  parentEmail: string;
  parentName: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, slug, domain, contact_email")
    .eq("id", params.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Tenant niet gevonden." };

  const tenantHost = {
    slug: tenant.slug as string,
    domain: tenant.domain as string | null,
  };

  let athleteName = "";
  if (params.invite.child_member_id) {
    const { data: child } = await admin
      .from("members")
      .select("full_name")
      .eq("id", params.invite.child_member_id)
      .maybeSingle();
    athleteName = (child?.full_name as string | null) ?? "";
  }

  const expiry = new Date(params.invite.expires_at).toLocaleDateString("nl-NL");
  const loginLink = tenantUrl(tenantHost, `/login?next=/t/${tenant.slug}/profile`);

  const existingAuth = await findAuthUserByEmail(admin, params.parentEmail);

  if (existingAuth) {
    // Ouder heeft al een account → simpele mail met code + login-link.
    const variables: Record<string, string> = {
      tenant_name: tenant.name as string,
      tenant_contact_email: (tenant.contact_email as string | null) ?? "",
      parent_name: params.parentName ?? params.parentEmail,
      member_name: params.parentName ?? params.parentEmail,
      athlete_name: athleteName,
      invite_code: params.invite.invite_code,
      login_link: loginLink,
      expiry_date: expiry,
    };
    await ensureTenantTemplate(params.tenantId, "parent_link_with_code");
    const res = await sendEmail({
      tenantId: params.tenantId,
      templateKey: "parent_link_with_code",
      to: params.invite.email,
      variables,
      triggerSource: "parent_link_existing_account",
    });
    if (res.ok) {
      await admin
        .from("member_invites")
        .update({ status: "sent", last_sent_at: new Date().toISOString() })
        .eq("id", params.invite.id);
    }
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }

  // Ouder heeft nog geen account → maak een account_invite zodat er een
  // registratie-link bestaat. We hergebruiken `insertInvite` + de bestaande
  // /invite/<token>-flow voor wachtwoord-set en account-aanmaak.
  const settings = await loadInviteSettings(params.tenantId);
  const accountInviteRes = await insertInvite({
    tenantId: params.tenantId,
    memberId: null,
    inviteType: "parent_account",
    email: params.parentEmail,
    fullName: params.parentName,
    createdBy: params.invite.created_by,
    settings,
  });
  if ("error" in accountInviteRes) {
    return { ok: false, error: accountInviteRes.error };
  }
  const registerLink = inviteLink(tenantHost, accountInviteRes.invite.token);

  const variables: Record<string, string> = {
    tenant_name: tenant.name as string,
    tenant_contact_email: (tenant.contact_email as string | null) ?? "",
    parent_name: params.parentName ?? params.parentEmail,
    member_name: params.parentName ?? params.parentEmail,
    athlete_name: athleteName,
    invite_code: params.invite.invite_code,
    register_link: registerLink,
    login_link: loginLink,
    expiry_date: expiry,
  };
  await ensureTenantTemplate(params.tenantId, "parent_register_then_link");
  const res = await sendEmail({
    tenantId: params.tenantId,
    templateKey: "parent_register_then_link",
    to: params.invite.email,
    variables,
    triggerSource: "parent_link_no_account",
  });
  if (res.ok) {
    await admin
      .from("member_invites")
      .update({ status: "sent", last_sent_at: new Date().toISOString() })
      .eq("id", params.invite.id);
  }
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

async function insertInvite(params: {
  tenantId: string;
  memberId: string | null;
  inviteType: InviteTypeLiteral;
  email: string;
  fullName: string | null;
  childMemberId?: string | null;
  createdBy: string | null;
  settings: TenantInviteSettings;
}): Promise<{ invite: MemberInvite } | { error: string }> {
  const supabase = await createClient();
  const token = generateInviteToken();
  const code = generateInviteCode();
  const expires_at = expiryFromNow(params.settings.invite_expiry_days);

  const { data, error } = await supabase
    .from("member_invites")
    .insert({
      tenant_id: params.tenantId,
      member_id: params.memberId,
      invite_type: params.inviteType,
      email: params.email.trim().toLowerCase(),
      full_name: params.fullName,
      child_member_id: params.childMemberId ?? null,
      token,
      invite_code: code,
      status: "pending",
      expires_at,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error || !data) return { error: error?.message ?? "Kon uitnodiging niet aanmaken." };
  return { invite: data as MemberInvite };
}

// ── 1. Manual member + optional invite ────────────────────

export async function createMemberWithInvite(
  input: NewMemberWithInviteInput,
): Promise<
  ActionResult<{
    member_id: string;
    invite_id: string | null;
    duplicates?: DuplicateCandidate[];
  }>
> {
  const parsed = newMemberWithInviteSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const v = parsed.data;

  const user = await assertTenantAccess(v.tenant_id);
  const supabase = await createClient();

  const email = (v.email ?? "").trim().toLowerCase();

  // Duplicate detection (adults only).
  if (email && !v.confirm_duplicate) {
    const dupes = await detectDuplicateAdult({
      tenantId: v.tenant_id,
      email,
      candidateRoles: v.roles,
    });
    if (dupes.length > 0) {
      return {
        ok: false,
        error:
          "Mogelijke dubbele lid gevonden. Bevestig dat je toch wil aanmaken.",
        fieldErrors: { email: ["Dubbele e-mail bij bestaand lid."] },
        // duplicates returned through ActionResult.data on failure isn't
        // possible — surface via fieldErrors above and a sentinel cast
        // through error message. The form re-runs with confirm_duplicate.
      };
    }
  }

  // Insert member.
  const { data: created, error: memberErr } = await supabase
    .from("members")
    .insert({
      tenant_id: v.tenant_id,
      full_name: v.full_name,
      email: email || null,
      phone: v.phone,
      member_status: v.mode === "manual" ? "prospect" : "aspirant",
    })
    .select("id")
    .single();
  if (memberErr || !created) {
    return fail(memberErr?.message ?? "Kon lid niet aanmaken.");
  }

  if (v.roles.length > 0) {
    const rows = v.roles.map((r) => ({ member_id: created.id, role: r }));
    const { error: roleErr } = await supabase.from("member_roles").insert(rows);
    if (roleErr) return fail(roleErr.message);
  }

  // Mode-specific follow-up.
  let inviteId: string | null = null;

  if (v.mode === "minor") {
    // Link to existing parent OR send invite to a parent email.
    if (v.parent_member_id) {
      const parentCheck = await assertMemberInTenant(
        v.parent_member_id,
        v.tenant_id,
      );
      if (!parentCheck.ok) return fail(parentCheck.error);
      const { error: linkErr } = await supabase.from("member_links").insert({
        tenant_id: v.tenant_id,
        parent_member_id: v.parent_member_id,
        child_member_id: created.id,
      });
      if (linkErr && linkErr.code !== "23505") return fail(linkErr.message);
    } else if (v.parent_email) {
      const settings = await loadInviteSettings(v.tenant_id);
      const ins = await insertInvite({
        tenantId: v.tenant_id,
        memberId: null,
        inviteType: "minor_parent_link",
        email: v.parent_email,
        fullName: null,
        childMemberId: created.id,
        createdBy: user.id,
        settings,
      });
      if ("error" in ins) return fail(ins.error);
      inviteId = ins.invite.id;
      const sent = await dispatchInvite(v.tenant_id, ins.invite, "manual_minor_invite");
      if (!sent.ok) return fail(sent.error ?? "Kon uitnodiging niet versturen.");
    }
  } else if (v.mode === "invite" && v.invite_type) {
    const settings = await loadInviteSettings(v.tenant_id);
    const ins = await insertInvite({
      tenantId: v.tenant_id,
      memberId: created.id,
      inviteType: v.invite_type,
      email,
      fullName: v.full_name,
      createdBy: user.id,
      settings,
    });
    if ("error" in ins) return fail(ins.error);
    inviteId = ins.invite.id;
    const sent = await dispatchInvite(v.tenant_id, ins.invite, "manual_member_invite");
    if (!sent.ok) return fail(sent.error ?? "Kon uitnodiging niet versturen.");
  }

  revalidatePath("/tenant/members");
  revalidatePath("/tenant/invites");
  return { ok: true, data: { member_id: created.id, invite_id: inviteId } };
}

// ── 2. Resend invite ──────────────────────────────────────

export async function resendInvite(
  input: z.infer<typeof inviteIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = inviteIdSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("member_invites")
    .select("*")
    .eq("id", parsed.data.invite_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!inv) return fail("Uitnodiging niet gevonden.");

  const invite = inv as MemberInvite;
  if (invite.status === "accepted") return fail("Deze uitnodiging is al geaccepteerd.");
  if (invite.status === "revoked") return fail("Deze uitnodiging is ingetrokken.");

  const settings = await loadInviteSettings(parsed.data.tenant_id);
  if (invite.resend_count >= settings.max_resend_count) {
    return fail(
      `Maximaal aantal herzendingen bereikt (${settings.max_resend_count}).`,
    );
  }
  if (invite.last_sent_at) {
    const cooldownMs = settings.resend_cooldown_days * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(invite.last_sent_at).getTime();
    if (elapsed < cooldownMs) {
      const waitDays = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
      return fail(`Wacht nog ${waitDays} dag(en) voor opnieuw versturen.`);
    }
  }

  // Refresh expiry on resend so the link stays valid.
  const newExpiry = expiryFromNow(settings.invite_expiry_days);
  const { data: updated, error: updErr } = await admin
    .from("member_invites")
    .update({
      resend_count: invite.resend_count + 1,
      expires_at: newExpiry,
      status: invite.status === "expired" ? "pending" : invite.status,
    })
    .eq("id", invite.id)
    .select()
    .single();
  if (updErr || !updated) return fail(updErr?.message ?? "Kon uitnodiging niet bijwerken.");

  const sent = await dispatchInvite(
    parsed.data.tenant_id,
    updated as MemberInvite,
    "manual_resend",
  );
  if (!sent.ok) return fail(sent.error ?? "Kon uitnodiging niet versturen.");

  revalidatePath("/tenant/invites");
  return { ok: true, data: { id: invite.id } };
}

// ── 3. Revoke invite ──────────────────────────────────────

export async function revokeInvite(
  input: z.infer<typeof inviteIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = inviteIdSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("member_invites")
    .update({ status: "revoked" })
    .eq("id", parsed.data.invite_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Kon uitnodiging niet intrekken.");

  revalidatePath("/tenant/invites");
  return { ok: true, data: { id: data.id } };
}

// ── 4. Accept invite — adult account creation ─────────────

/**
 * Accept an adult-account invite (parent/trainer/adult_athlete_account
 * or complete_registration). Creates an auth user with the given
 * password, links to the member row, and marks the invite accepted.
 */
export async function acceptAdultInvite(
  input: AcceptAdultInviteInput,
): Promise<ActionResult<{ tenant_slug: string; email: string }>> {
  const parsed = acceptAdultInviteSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const admin = createAdminClient();
  const { data: invRow } = await admin
    .from("member_invites")
    .select("*, tenants(slug)")
    .eq("token", parsed.data.token)
    .maybeSingle();
  if (!invRow) return fail("Uitnodiging niet gevonden.");
  const invite = invRow as MemberInvite & { tenants: { slug: string } | null };

  if (invite.status === "accepted") return fail("Deze uitnodiging is al geaccepteerd.");
  if (invite.status === "revoked") return fail("Deze uitnodiging is ingetrokken.");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin
      .from("member_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return fail("Deze uitnodiging is verlopen.");
  }

  const allowedTypes: ReadonlySet<string> = new Set([
    "parent_account",
    "trainer_account",
    "staff_account",
    "adult_athlete_account",
    "complete_registration",
  ]);
  if (!allowedTypes.has(invite.invite_type)) {
    return fail("Dit uitnodigingstype kan niet via dit formulier worden afgerond.");
  }

  // Find-or-create de auth-user.
  //
  // Voorheen probeerden we eerst `createUser` en herkenden we een bestaande
  // user via een regex op de error-message. Newer Supabase versies geven
  // andere errors (`User already registered`, `email_exists`, of zelfs een
  // generieke 422), waardoor de fallback faalde en de eindgebruiker
  // "email bestaat al" zag. Robuuster: doe ALTIJD eerst een lookup en
  // beslis dan of we maken of bijwerken.
  const targetEmail = invite.email.toLowerCase();
  let userId: string | null = null;

  const existing = await findAuthUserByEmail(admin, targetEmail);
  if (existing) {
    userId = existing.id;
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: parsed.data.password,
      user_metadata: { full_name: parsed.data.full_name },
      email_confirm: true,
    });
    if (updErr) return fail(updErr.message);
  } else {
    const { data: created, error: userErr } =
      await admin.auth.admin.createUser({
        email: targetEmail,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { full_name: parsed.data.full_name },
      });
    if (created?.user) {
      userId = created.user.id;
    } else if (
      userErr &&
      /already (registered|exists)|duplicate|email[_ ]exists/i.test(
        userErr.message,
      )
    ) {
      // Race-conditie: tussen lookup en create is de user toch aangemaakt.
      // Probeer opnieuw te vinden en dan bij te werken.
      const retry = await findAuthUserByEmail(admin, targetEmail);
      if (!retry) return fail("Bestaand account kon niet worden geladen.");
      userId = retry.id;
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: parsed.data.password,
        user_metadata: { full_name: parsed.data.full_name },
        email_confirm: true,
      });
      if (updErr) return fail(updErr.message);
    } else {
      return fail(userErr?.message ?? "Kon account niet aanmaken.");
    }
  }

  // Ensure profile row.
  await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: invite.email.toLowerCase(),
        full_name: parsed.data.full_name,
      },
      { onConflict: "id" },
    );

  // Link the member to this auth user (and update name if blank).
  if (invite.member_id) {
    await admin
      .from("members")
      .update({
        user_id: userId,
        member_status: "active",
        full_name: parsed.data.full_name,
      })
      .eq("id", invite.member_id)
      .eq("tenant_id", invite.tenant_id);
  }

  await admin
    .from("member_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: userId,
    })
    .eq("id", invite.id);

  // Sprint 12 — invite_accepted trigger (notify tenant admins).
  try {
    const { getNotificationEvent } = await import("@/lib/db/notifications");
    const { sendNotification } = await import("@/lib/notifications/send-notification");
    const evt = await getNotificationEvent(invite.tenant_id, "invite_accepted");
    if (!evt || evt.template_enabled) {
      await sendNotification({
        tenantId: invite.tenant_id,
        title: `Uitnodiging geaccepteerd: ${parsed.data.full_name}`,
        contentText: `${parsed.data.full_name} (${invite.email}) heeft de uitnodiging geaccepteerd.`,
        targets: [{ target_type: "role", target_id: "admin" }],
        sendEmail: evt?.email_enabled ?? false,
        source: "invite_accepted",
        sourceRef: invite.id,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[invites:invite_accepted] notification failed:", err);
  }

  return {
    ok: true,
    data: { tenant_slug: invite.tenants?.slug ?? "", email: invite.email },
  };
}

// ── 5. Accept minor-link invite (authenticated parent) ───

export async function acceptMinorLinkInvite(
  input: AcceptMinorLinkInput,
): Promise<ActionResult<{ child_member_id: string; tenant_slug: string }>> {
  const parsed = acceptMinorLinkSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await requireAuth();
  await ensureProfile(user);

  const admin = createAdminClient();
  const { data: invRow } = await admin
    .from("member_invites")
    .select("*, tenants(slug)")
    .eq("token", parsed.data.token)
    .maybeSingle();
  if (!invRow) return fail("Uitnodiging niet gevonden.");
  const invite = invRow as MemberInvite & { tenants: { slug: string } | null };

  if (invite.invite_type !== "minor_parent_link") {
    return fail("Onverwacht uitnodigingstype.");
  }
  if (invite.status === "accepted") return fail("Deze uitnodiging is al geaccepteerd.");
  if (invite.status === "revoked") return fail("Deze uitnodiging is ingetrokken.");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin
      .from("member_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return fail("Deze uitnodiging is verlopen.");
  }
  if (!invite.child_member_id) return fail("Geen kind gekoppeld aan deze uitnodiging.");

  // Find or create a parent member row in this tenant for the current user.
  const parentMemberId = await ensureParentMember({
    tenantId: invite.tenant_id,
    userId: user.id,
    email: user.email ?? invite.email,
  });
  if (!parentMemberId) return fail("Kon ouder-lid niet aanmaken.");

  // Link parent → child (ignore unique-violation on re-link).
  const { error: linkErr } = await admin.from("member_links").insert({
    tenant_id: invite.tenant_id,
    parent_member_id: parentMemberId,
    child_member_id: invite.child_member_id,
  });
  if (linkErr && linkErr.code !== "23505") return fail(linkErr.message);

  await admin
    .from("member_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: user.id,
    })
    .eq("id", invite.id);

  // Fire-and-forget confirmation email.
  await sendEmail({
    tenantId: invite.tenant_id,
    templateKey: "minor_added",
    to: invite.email,
    variables: {
      parent_name: user.email ?? "",
      athlete_name: "",
    },
    triggerSource: "minor_link_accepted",
  });

  return {
    ok: true,
    data: {
      child_member_id: invite.child_member_id,
      tenant_slug: invite.tenants?.slug ?? "",
    },
  };
}

/**
 * Idempotently insert a default email template row for the tenant if it's
 * missing. Used to backfill new template keys (e.g. `staff_invite`) for
 * tenants that were seeded before the key existed in `DEFAULT_TEMPLATES`.
 *
 * Safe to call before every dispatch — the cost is one indexed lookup,
 * and the insert path only runs once per (tenant, key).
 */
async function ensureTenantTemplate(
  tenantId: string,
  templateKey: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("email_templates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("key", templateKey)
    .maybeSingle();
  if (existing) return;

  const def = DEFAULT_TEMPLATES.find((t) => t.key === templateKey);
  if (!def) return; // Unknown key — nothing to seed; let send-email surface the error.

  await admin.from("email_templates").insert({
    tenant_id: tenantId,
    key: def.key,
    name: def.name,
    subject: def.subject,
    content_html: def.content_html,
    content_text: def.content_text,
    is_enabled: true,
  });
}

/**
 * Derive a human-readable function label ("trainer", "staf", "trainer / staf"…)
 * for a staff/trainer invite based on the member's assigned roles. Falls back
 * to a generic label tied to the invite type so the email never reads
 * "een -account" with an empty placeholder.
 */
async function resolveFunctionLabel(
  memberId: string,
  inviteType: InviteTypeLiteral,
): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("member_roles")
    .select("role")
    .eq("member_id", memberId);

  const roles = new Set(
    (data ?? []).map((r: { role: string }) => r.role),
  );

  const parts: string[] = [];
  if (roles.has("trainer")) parts.push("trainer");
  if (roles.has("staff")) parts.push("staf");

  if (parts.length > 0) return parts.join(" / ");
  return inviteType === "trainer_account" ? "trainer" : "staf";
}

async function ensureParentMember(params: {
  tenantId: string;
  userId: string;
  email: string;
}): Promise<string | null> {
  const admin = createAdminClient();

  // Already linked?
  const { data: existing } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (existing) return existing.id as string;

  // Match by email?
  const { data: byEmail } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .ilike("email", params.email.toLowerCase())
    .maybeSingle();

  let memberId: string;
  if (byEmail) {
    memberId = byEmail.id as string;
    await admin
      .from("members")
      .update({ user_id: params.userId, member_status: "active" })
      .eq("id", memberId);
  } else {
    const { data: created, error } = await admin
      .from("members")
      .insert({
        tenant_id: params.tenantId,
        full_name: params.email.split("@")[0],
        email: params.email.toLowerCase(),
        user_id: params.userId,
        member_status: "active",
      })
      .select("id")
      .single();
    if (error || !created) return null;
    memberId = created.id as string;
  }

  // Ensure 'parent' role.
  await admin
    .from("member_roles")
    .upsert(
      { member_id: memberId, role: "parent" },
      { onConflict: "member_id,role" },
    );

  return memberId;
}

// ── 5b. Accept minor-parent invite — direct (no separate login step)
//
// Sprint 23 (B): wanneer een `minor_parent_link`-invite een
// `child_member_id` draagt, mag de ouder direct via naam+wachtwoord
// een account aanmaken EN gelijk gekoppeld worden aan het kind.
// De fallback uit `acceptMinorLinkInvite` (login → klik) blijft
// bestaan voor invites zonder child_member_id of voor ouders die
// al ingelogd zijn.

export async function acceptMinorParentInvite(
  input: AcceptMinorParentInput,
): Promise<
  ActionResult<{
    tenant_slug: string;
    email: string;
    child_member_id: string;
    child_full_name: string | null;
  }>
> {
  const parsed = acceptMinorParentSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const admin = createAdminClient();
  const { data: invRow } = await admin
    .from("member_invites")
    .select("*, tenants(slug)")
    .eq("token", parsed.data.token)
    .maybeSingle();
  if (!invRow) return fail("Uitnodiging niet gevonden.");
  const invite = invRow as MemberInvite & { tenants: { slug: string } | null };

  if (invite.invite_type !== "minor_parent_link") {
    return fail("Dit uitnodigingstype kan niet via dit formulier worden afgerond.");
  }
  if (invite.status === "accepted") return fail("Deze uitnodiging is al geaccepteerd.");
  if (invite.status === "revoked") return fail("Deze uitnodiging is ingetrokken.");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin
      .from("member_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return fail("Deze uitnodiging is verlopen.");
  }
  if (!invite.child_member_id) {
    return fail("Geen kind aan deze uitnodiging gekoppeld.");
  }

  // Belt-and-braces: het kind moet bij dezelfde tenant horen voordat
  // we de link aanmaken (sluit cross-tenant misbruik via geknoeide
  // invite-rijen uit, mocht RLS/admin-pad ooit lekken).
  const childCheck = await assertMemberInTenant(invite.child_member_id, invite.tenant_id);
  if (!childCheck.ok) return fail(childCheck.error);

  // Find-or-create de auth-user — zelfde robuuste flow als acceptAdultInvite.
  const targetEmail = invite.email.toLowerCase();
  let userId: string | null = null;
  const existing = await findAuthUserByEmail(admin, targetEmail);
  if (existing) {
    userId = existing.id;
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: parsed.data.password,
      user_metadata: { full_name: parsed.data.full_name },
      email_confirm: true,
    });
    if (updErr) return fail(updErr.message);
  } else {
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email: targetEmail,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
    });
    if (created?.user) {
      userId = created.user.id;
    } else if (
      userErr &&
      /already (registered|exists)|duplicate|email[_ ]exists/i.test(userErr.message)
    ) {
      const retry = await findAuthUserByEmail(admin, targetEmail);
      if (!retry) return fail("Bestaand account kon niet worden geladen.");
      userId = retry.id;
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: parsed.data.password,
        user_metadata: { full_name: parsed.data.full_name },
        email_confirm: true,
      });
      if (updErr) return fail(updErr.message);
    } else {
      return fail(userErr?.message ?? "Kon account niet aanmaken.");
    }
  }

  await admin
    .from("profiles")
    .upsert(
      { id: userId, email: targetEmail, full_name: parsed.data.full_name },
      { onConflict: "id" },
    );

  // Upsert ouder-lid in deze tenant en koppel aan auth-user.
  const parentMemberId = await ensureParentMember({
    tenantId: invite.tenant_id,
    userId,
    email: targetEmail,
  });
  if (!parentMemberId) return fail("Kon ouder-lid niet aanmaken.");

  // Sla de door de gebruiker opgegeven naam op (ensureParentMember
  // genereert anders een placeholder uit het email-prefix).
  await admin
    .from("members")
    .update({ full_name: parsed.data.full_name, member_status: "active" })
    .eq("id", parentMemberId)
    .eq("tenant_id", invite.tenant_id);

  // Auto-link parent → child (idempotent: 23505 unique-violation negeren).
  const { error: linkErr } = await admin.from("member_links").insert({
    tenant_id: invite.tenant_id,
    parent_member_id: parentMemberId,
    child_member_id: invite.child_member_id,
  });
  if (linkErr && linkErr.code !== "23505") return fail(linkErr.message);

  await admin
    .from("member_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: userId,
    })
    .eq("id", invite.id);

  // Haal kindnaam op voor bevestigingstekst + email-variabele.
  const { data: childRow } = await admin
    .from("members")
    .select("full_name")
    .eq("id", invite.child_member_id)
    .maybeSingle();
  const childName = (childRow?.full_name as string | null) ?? null;

  // Best-effort confirmatie-email naar de ouder.
  await sendEmail({
    tenantId: invite.tenant_id,
    templateKey: "minor_added",
    to: invite.email,
    variables: {
      parent_name: parsed.data.full_name,
      member_name: parsed.data.full_name,
      athlete_name: childName ?? "",
    },
    triggerSource: "minor_parent_accepted",
  });

  // Tenant-admin notificatie (best-effort, mirror van acceptAdultInvite).
  try {
    const { getNotificationEvent } = await import("@/lib/db/notifications");
    const { sendNotification } = await import("@/lib/notifications/send-notification");
    const evt = await getNotificationEvent(invite.tenant_id, "invite_accepted");
    if (!evt || evt.template_enabled) {
      await sendNotification({
        tenantId: invite.tenant_id,
        title: `Ouder gekoppeld: ${parsed.data.full_name}`,
        contentText: `${parsed.data.full_name} (${invite.email}) heeft het account geactiveerd${
          childName ? ` en is gekoppeld aan ${childName}` : ""
        }.`,
        targets: [{ target_type: "role", target_id: "admin" }],
        sendEmail: evt?.email_enabled ?? false,
        source: "invite_accepted",
        sourceRef: invite.id,
      });
    }
  } catch {
    // Best-effort notificatie: een falende admin-notify mag de
    // succesvolle invite-acceptatie nooit blokkeren of zichtbaar
    // maken aan de eindgebruiker. Bewust geen log hier — de
    // onderliggende sendNotification/sendEmail loggen zelf hun
    // fouten via de SMTP/notifications-laag.
  }

  return {
    ok: true,
    data: {
      tenant_slug: invite.tenants?.slug ?? "",
      email: invite.email,
      child_member_id: invite.child_member_id,
      child_full_name: childName,
    },
  };
}

// ── 6. Link minor by code (authenticated parent) ──────────

export async function linkMinorByCode(
  input: LinkMinorByCodeInput,
): Promise<ActionResult<{ child_member_id: string }>> {
  const parsed = linkMinorByCodeSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await requireAuth();
  await ensureProfile(user);

  const admin = createAdminClient();
  const { data: invRow } = await admin
    .from("member_invites")
    .select("*")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("invite_code", parsed.data.invite_code.trim().toUpperCase())
    .maybeSingle();
  if (!invRow) return fail("Code niet gevonden.");
  const invite = invRow as MemberInvite;

  if (invite.invite_type !== "minor_parent_link") {
    return fail("Deze code is niet bedoeld voor minderjarigen koppelen.");
  }
  if (invite.status === "accepted") return fail("Deze code is al gebruikt.");
  if (invite.status === "revoked") return fail("Deze code is ingetrokken.");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from("member_invites").update({ status: "expired" }).eq("id", invite.id);
    return fail("Deze code is verlopen.");
  }
  if (!invite.child_member_id) return fail("Geen kind gekoppeld aan deze code.");

  const parentMemberId = await ensureParentMember({
    tenantId: invite.tenant_id,
    userId: user.id,
    email: user.email ?? invite.email,
  });
  if (!parentMemberId) return fail("Kon ouder-lid niet aanmaken.");

  const { error: linkErr } = await admin.from("member_links").insert({
    tenant_id: invite.tenant_id,
    parent_member_id: parentMemberId,
    child_member_id: invite.child_member_id,
  });
  if (linkErr && linkErr.code !== "23505") return fail(linkErr.message);

  await admin
    .from("member_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: user.id,
    })
    .eq("id", invite.id);

  return { ok: true, data: { child_member_id: invite.child_member_id } };
}

// ── 7. Generate a parent-link code from member detail ─────

export async function generateMinorLinkCode(
  input: GenerateMinorCodeInput,
): Promise<ActionResult<{ invite_code: string; invite_id: string }>> {
  const parsed = generateMinorCodeSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  // Look up the parent's email so the invite has somewhere to send to.
  const { data: parent } = await admin
    .from("members")
    .select("email, full_name")
    .eq("id", parsed.data.parent_member_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!parent || !parent.email) {
    return fail("Ouder heeft geen e-mailadres. Voeg eerst een e-mail toe.");
  }

  // Belt-and-braces: the child must also belong to this tenant before we
  // store its id on a tenant-scoped invite.
  const childCheck = await assertMemberInTenant(
    parsed.data.child_member_id,
    parsed.data.tenant_id,
  );
  if (!childCheck.ok) return fail(childCheck.error);

  const settings = await loadInviteSettings(parsed.data.tenant_id);
  const ins = await insertInvite({
    tenantId: parsed.data.tenant_id,
    memberId: parsed.data.parent_member_id,
    inviteType: "minor_parent_link",
    email: parent.email as string,
    fullName: (parent.full_name as string | null) ?? null,
    childMemberId: parsed.data.child_member_id,
    createdBy: user.id,
    settings,
  });
  if ("error" in ins) return fail(ins.error);

  // Best-effort send: stuur de juiste mail afhankelijk van of de ouder
  // al een auth-account heeft. Failure blokkeert NIET het teruggeven van
  // de code (admin kan deze ook handmatig delen).
  await dispatchParentLinkCode({
    tenantId: parsed.data.tenant_id,
    invite: ins.invite,
    parentEmail: parent.email as string,
    parentName: (parent.full_name as string | null) ?? null,
  });

  revalidatePath(`/tenant/members/${parsed.data.parent_member_id}`);
  revalidatePath(`/tenant/members/${parsed.data.child_member_id}`);
  revalidatePath("/tenant/invites");
  return {
    ok: true,
    data: { invite_code: ins.invite.invite_code, invite_id: ins.invite.id },
  };
}

// ── 8. Convert registration → member ──────────────────────

function asAthletes(value: unknown): RegistrationAthleteEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is RegistrationAthleteEntry =>
      !!a && typeof a === "object" && "full_name" in a,
  );
}

export async function convertRegistrationToMember(
  input: ConvertRegistrationInput,
): Promise<
  ActionResult<{
    parent_member_id: string | null;
    child_member_ids: string[];
    invite_id: string | null;
  }>
> {
  const parsed = convertRegistrationSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data: regData, error: regErr } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", parsed.data.registration_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (regErr || !regData) return fail("Aanmelding niet gevonden.");
  const reg = regData as Registration;

  const isChildReg = reg.registration_target === "child";
  const isMultiAthletes = (reg.athletes_json?.length ?? 0) > 0;

  let parentMemberId: string | null = null;
  const childMemberIds: string[] = [];

  // 1) Adult / parent member from parent_email + parent_name.
  const adultName = reg.parent_name ?? reg.child_name ?? "Onbekend";
  const adultEmail = reg.parent_email.trim().toLowerCase();

  const { data: existingAdult } = await supabase
    .from("members")
    .select("id")
    .eq("tenant_id", parsed.data.tenant_id)
    .ilike("email", adultEmail)
    .maybeSingle();

  if (existingAdult) {
    parentMemberId = existingAdult.id as string;
  } else {
    const { data: createdAdult, error: aErr } = await supabase
      .from("members")
      .insert({
        tenant_id: parsed.data.tenant_id,
        full_name: adultName,
        email: adultEmail,
        phone: reg.parent_phone,
        member_status: "active",
      })
      .select("id")
      .single();
    if (aErr || !createdAdult) return fail(aErr?.message ?? "Kon ouder-lid niet aanmaken.");
    parentMemberId = createdAdult.id as string;
  }

  // 2) Roles for the adult.
  const adultRole = isChildReg || isMultiAthletes ? "parent" : "athlete";
  await supabase
    .from("member_roles")
    .upsert(
      { member_id: parentMemberId, role: adultRole },
      { onConflict: "member_id,role" },
    );

  // 3) Children: from athletes_json or single child_name.
  const athletes = asAthletes(reg.athletes_json);
  const childRows: Array<{ full_name: string }> = athletes.length > 0
    ? athletes.map((a) => ({ full_name: a.full_name }))
    : isChildReg && reg.child_name
      ? [{ full_name: reg.child_name }]
      : [];

  for (const ch of childRows) {
    const { data: createdChild, error: cErr } = await supabase
      .from("members")
      .insert({
        tenant_id: parsed.data.tenant_id,
        full_name: ch.full_name,
        member_status: "active",
      })
      .select("id")
      .single();
    if (cErr || !createdChild) return fail(cErr?.message ?? "Kon kind-lid niet aanmaken.");
    const cid = createdChild.id as string;
    childMemberIds.push(cid);
    await supabase
      .from("member_roles")
      .insert({ member_id: cid, role: "athlete" });
    await supabase.from("member_links").insert({
      tenant_id: parsed.data.tenant_id,
      parent_member_id: parentMemberId,
      child_member_id: cid,
    });
  }

  // 4) Mark registration as completed/accepted.
  await supabase
    .from("registrations")
    .update({
      membership_status: athletes.length > 0 || isChildReg ? "accepted" : "completed",
      status: athletes.length > 0 || isChildReg ? "accepted" : "completed",
    })
    .eq("id", reg.id);

  // 5) Optional invite to the adult.
  let inviteId: string | null = null;
  if (parsed.data.send_invite && adultEmail) {
    const settings = await loadInviteSettings(parsed.data.tenant_id);
    const ins = await insertInvite({
      tenantId: parsed.data.tenant_id,
      memberId: parentMemberId,
      inviteType: adultRole === "parent" ? "parent_account" : "adult_athlete_account",
      email: adultEmail,
      fullName: adultName,
      createdBy: user.id,
      settings,
    });
    if (!("error" in ins)) {
      inviteId = ins.invite.id;
      await dispatchInvite(parsed.data.tenant_id, ins.invite, "registration_converted");
    }

    // Notification template (best-effort).
    await sendEmail({
      tenantId: parsed.data.tenant_id,
      templateKey: "registration_converted",
      to: adultEmail,
      variables: {
        member_name: adultName,
      },
      triggerSource: "registration_converted",
    });
  }

  revalidatePath("/tenant/registrations");
  revalidatePath("/tenant/members");
  revalidatePath("/tenant/invites");
  return {
    ok: true,
    data: {
      parent_member_id: parentMemberId,
      child_member_ids: childMemberIds,
      invite_id: inviteId,
    },
  };
}

// ── 9. Re-expose duplicate detection as a server action ───

const detectDupSchema = z.object({
  tenant_id: z.string().uuid(),
  email: z.string().trim().email(),
  roles: z.array(z.string()).default([]),
});

export async function detectMemberDuplicate(
  input: z.infer<typeof detectDupSchema>,
): Promise<ActionResult<{ candidates: DuplicateCandidate[] }>> {
  const parsed = detectDupSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  await assertTenantAccess(parsed.data.tenant_id);
  const candidates = await detectDuplicateAdult({
    tenantId: parsed.data.tenant_id,
    email: parsed.data.email,
    candidateRoles: parsed.data.roles,
  });
  return { ok: true, data: { candidates } };
}

// silence unused-import warning in case Member is not referenced after refactors
export type _MemberRef = Member;
