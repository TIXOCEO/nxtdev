"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import {
  updateEmailTemplateSchema,
  toggleEmailTemplateSchema,
  sendTestEmailSchema,
  type UpdateEmailTemplateInput,
  type ToggleEmailTemplateInput,
  type SendTestEmailInput,
} from "@/lib/validation/email-templates";
import {
  upsertTenantEmailSettingsSchema,
  type UpsertTenantEmailSettingsInput,
} from "@/lib/validation/tenant-email-settings";
import {
  upsertTriggerSchema,
  type UpsertTriggerInput,
  TRIGGER_EVENTS,
  DEFAULT_TRIGGER_TEMPLATE_MAP,
} from "@/lib/validation/email-triggers";
import { sendEmail } from "@/lib/email/send-email";
import { DEFAULT_TEMPLATES } from "@/lib/email/default-templates";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

const seedTemplatesSchema = z.object({ tenant_id: z.string().uuid() });

// ── Default-template seed ────────────────────────────────

/**
 * Insert any missing default templates for the tenant. Idempotent:
 * existing rows (by tenant_id+key) are not touched.
 */
export async function seedDefaultEmailTemplates(
  input: { tenant_id: string },
): Promise<ActionResult<{ inserted: number }>> {
  const parsed = seedTemplatesSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data: existing, error: existingErr } = await supabase
    .from("email_templates")
    .select("key")
    .eq("tenant_id", parsed.data.tenant_id);
  if (existingErr) return fail(existingErr.message);

  const have = new Set((existing ?? []).map((r: { key: string }) => r.key));
  const toInsert = DEFAULT_TEMPLATES.filter((t) => !have.has(t.key)).map((t) => ({
    tenant_id: parsed.data.tenant_id,
    key: t.key,
    name: t.name,
    subject: t.subject,
    content_html: t.content_html,
    content_text: t.content_text,
    is_enabled: true,
  }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("email_templates").insert(toInsert);
    if (error) return fail(error.message);
  }

  // Ook default-triggers seeden zodat alle events meteen actief gekoppeld zijn
  // aan de natuurlijke template. Tenant admin kan dit later overschrijven.
  await seedDefaultEmailTriggers({ tenant_id: parsed.data.tenant_id });

  revalidatePath("/tenant/email-templates");
  revalidatePath("/tenant/settings/email");
  return { ok: true, data: { inserted: toInsert.length } };
}

/**
 * Voor elke TRIGGER_EVENT: zorg dat er een rij in `email_triggers` staat met
 * de default template-key + enabled=true. Bestaande rijen worden NIET
 * overschreven (admin-keuzes blijven behouden).
 */
export async function seedDefaultEmailTriggers(
  input: { tenant_id: string },
): Promise<ActionResult<{ inserted: number }>> {
  const parsed = seedTemplatesSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data: existing, error: existingErr } = await supabase
    .from("email_triggers")
    .select("event_key")
    .eq("tenant_id", parsed.data.tenant_id);
  if (existingErr) return fail(existingErr.message);

  const have = new Set(
    (existing ?? []).map((r: { event_key: string }) => r.event_key),
  );
  const toInsert = TRIGGER_EVENTS
    .filter((evt) => !have.has(evt))
    .map((evt) => ({
      tenant_id: parsed.data.tenant_id,
      event_key: evt,
      template_key: DEFAULT_TRIGGER_TEMPLATE_MAP[evt],
      enabled: true,
    }));

  if (toInsert.length === 0) return { ok: true, data: { inserted: 0 } };

  const { error } = await supabase.from("email_triggers").insert(toInsert);
  if (error) return fail(error.message);

  revalidatePath("/tenant/settings/email");
  return { ok: true, data: { inserted: toInsert.length } };
}

// ── Templates: edit / toggle ─────────────────────────────

export async function updateEmailTemplate(
  input: UpdateEmailTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateEmailTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { id, tenant_id, ...patch } = parsed.data;
  const { data, error } = await supabase
    .from("email_templates")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenant_id)
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Failed to update template.");

  revalidatePath("/tenant/email-templates");
  revalidatePath(`/tenant/email-templates/${id}`);
  return { ok: true, data: { id: data.id } };
}

export async function toggleEmailTemplate(
  input: ToggleEmailTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = toggleEmailTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { id, tenant_id, is_enabled } = parsed.data;
  const { data, error } = await supabase
    .from("email_templates")
    .update({ is_enabled })
    .eq("id", id)
    .eq("tenant_id", tenant_id)
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Failed to toggle template.");

  revalidatePath("/tenant/email-templates");
  return { ok: true, data: { id: data.id } };
}

// ── Test email from a template ───────────────────────────

/**
 * Tenant test send: looks up the tenant's actual template by key, renders
 * with safe sample variables, and dispatches via the SendGrid API.
 */
export async function sendTemplateTestEmail(
  input: SendTestEmailInput,
): Promise<ActionResult<{ messageId?: string }>> {
  const parsed = sendTestEmailSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);

  // Look up tenant name once for nicer sample variables (admin client so
  // we can read regardless of the caller's tenant scope — safe because we
  // already gated with assertTenantAccess).
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("name, contact_email, logo_url")
    .eq("id", parsed.data.tenant_id)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const sampleVars: Record<string, string> = {
    tenant_name: tenant?.name ?? "NXTTRACK",
    tenant_logo_url: tenant?.logo_url ?? "",
    tenant_contact_email: tenant?.contact_email ?? "",
    member_name: "Test Lid",
    parent_name: "Test Ouder",
    athlete_name: "Test Sporter",
    trainer_name: "Test Trainer",
    function_label: "trainer",
    invite_link: "https://example.com/invite/sample",
    invite_code: "SAMPLE-1234",
    athlete_code: "ATH-9999",
    complete_registration_link: "https://example.com/complete/sample",
    minor_link_url: "https://example.com/link-minor/sample",
    group_name: "Test Groep",
    news_title: "Voorbeeldbericht",
    news_url: "https://example.com/nieuws/sample",
    membership_name: "Test abonnement",
    membership_amount: "12,50",
    membership_due_date: today,
    membership_period: "maandelijks",
    current_date: today,
    expiry_date: today,
  };

  const res = await sendEmail({
    tenantId: parsed.data.tenant_id,
    templateKey: parsed.data.template_key,
    to: parsed.data.to,
    variables: sampleVars,
    triggerSource: "tenant_template_test",
  });
  if (!res.ok) return fail(res.error ?? "Send failed.");

  revalidatePath("/tenant/email-templates");
  return { ok: true, data: { messageId: res.messageId } };
}

// ── Tenant email settings ────────────────────────────────

export async function upsertTenantEmailSettings(
  input: UpsertTenantEmailSettingsInput,
): Promise<ActionResult<{ tenant_id: string }>> {
  const parsed = upsertTenantEmailSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { error } = await supabase
    .from("tenant_email_settings")
    .upsert(parsed.data, { onConflict: "tenant_id" });
  if (error) return fail(error.message);

  revalidatePath("/tenant/settings/email");
  return { ok: true, data: { tenant_id: parsed.data.tenant_id } };
}

// ── Email triggers (config only) ─────────────────────────

export async function upsertEmailTrigger(
  input: UpsertTriggerInput,
): Promise<ActionResult<{ tenant_id: string; event_key: string }>> {
  const parsed = upsertTriggerSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { error } = await supabase
    .from("email_triggers")
    .upsert(parsed.data, { onConflict: "tenant_id,event_key" });
  if (error) return fail(error.message);

  revalidatePath("/tenant/settings/email");
  return {
    ok: true,
    data: { tenant_id: parsed.data.tenant_id, event_key: parsed.data.event_key },
  };
}
