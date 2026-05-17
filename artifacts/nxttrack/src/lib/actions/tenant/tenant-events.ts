"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  createTenantEventSchema,
  updateTenantEventSchema,
  type CreateTenantEventInput,
  type UpdateTenantEventInput,
} from "@/lib/validation/tenant-events";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export async function createTenantEvent(
  input: CreateTenantEventInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTenantEventSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Sprint 79 — single-featured guard: maximaal één is_featured=true per
  // tenant. Bij conflict: bestaande featured-event eerst un-featuren binnen
  // dezelfde transactie-batch (best-effort; geen DB-level constraint omdat
  // dat onhandig is met soft-deletes/archivering).
  if (parsed.data.is_featured) {
    await unfeatureOtherEvents(parsed.data.tenant_id, null, user.id);
  }

  const { data, error } = await supabase
    .from("tenant_events")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) return fail(error?.message ?? "Aanmaken mislukt.");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "tenant.event.created",
    meta: {
      event_id: data.id,
      title: parsed.data.title,
      status: parsed.data.status,
      is_featured: parsed.data.is_featured,
    },
  });
  if (parsed.data.is_featured) {
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      action: "tenant.event.featured_set",
      meta: { event_id: data.id },
    });
  }

  revalidatePath("/tenant/events");
  revalidatePath(`/t/.*`); // public pages — best-effort
  return { ok: true, data };
}

/**
 * Un-feature alle andere events van deze tenant zodat maximaal één
 * is_featured=true per tenant overblijft. `exceptId` = de event-id die
 * juist wél featured mag blijven (bij update); null bij create.
 */
async function unfeatureOtherEvents(
  tenantId: string,
  exceptId: string | null,
  actorUserId: string,
): Promise<void> {
  const supabase = await createClient();
  const query = supabase
    .from("tenant_events")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_featured", true);
  const { data: others } = exceptId
    ? await query.neq("id", exceptId)
    : await query;
  if (!others || others.length === 0) return;

  await supabase
    .from("tenant_events")
    .update({ is_featured: false })
    .eq("tenant_id", tenantId)
    .in("id", others.map((o) => o.id));

  for (const o of others) {
    await recordAudit({
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      action: "tenant.event.featured_cleared",
      meta: { event_id: o.id, reason: "single_featured_guard" },
    });
  }
}

export async function updateTenantEvent(
  id: string,
  input: Omit<UpdateTenantEventInput, "id">,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateTenantEventSchema.safeParse({ ...input, id });
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tenant_events")
    .select("id, tenant_id, status, is_featured")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return fail("Event niet gevonden.");
  if (existing.tenant_id !== parsed.data.tenant_id) return fail("Tenant mismatch.");

  // Sprint 79 — single-featured guard.
  if (parsed.data.is_featured && !existing.is_featured) {
    await unfeatureOtherEvents(parsed.data.tenant_id, id, user.id);
  }

  const { id: _id, tenant_id: _t, ...patch } = parsed.data;
  const { error } = await supabase
    .from("tenant_events")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);

  if (parsed.data.is_featured && !existing.is_featured) {
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      action: "tenant.event.featured_set",
      meta: { event_id: id },
    });
  }
  if (!parsed.data.is_featured && existing.is_featured) {
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      action: "tenant.event.featured_cleared",
      meta: { event_id: id, reason: "admin_unfeatured" },
    });
  }

  if (patch.status === "published" && existing.status !== "published") {
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      action: "tenant.event.published",
      meta: { event_id: id, title: patch.title },
    });
  }
  if (patch.status === "archived" && existing.status !== "archived") {
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      action: "tenant.event.archived",
      meta: { event_id: id },
    });
  }

  revalidatePath("/tenant/events");
  revalidatePath(`/tenant/events/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteTenantEvent(
  id: string,
  tenantId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
    return fail("Ongeldige id");
  }
  const user = await assertTenantAccess(tenantId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("tenant_events")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "tenant.event.deleted",
    meta: { event_id: id },
  });

  revalidatePath("/tenant/events");
  return { ok: true, data: { id } };
}

/**
 * Sprint 79 — toggle voor `tenants.settings_json.public_show_upcoming_sessions`.
 * Houdt overige settings intact (read-modify-write pattern).
 */
export async function setPublicShowUpcomingSessions(
  tenantId: string,
  enabled: boolean,
): Promise<ActionResult<{ enabled: boolean }>> {
  await assertTenantAccess(tenantId);
  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("tenants")
    .select("settings_json")
    .eq("id", tenantId)
    .maybeSingle();
  if (fetchErr || !existing) return fail(fetchErr?.message ?? "Tenant niet gevonden.");

  const current = (existing.settings_json ?? {}) as Record<string, unknown>;
  const next = { ...current, public_show_upcoming_sessions: enabled };

  const { error } = await supabase
    .from("tenants")
    .update({ settings_json: next })
    .eq("id", tenantId);
  if (error) return fail(error.message);

  revalidatePath("/tenant/events");
  revalidatePath(`/t/.*`);
  return { ok: true, data: { enabled } };
}
