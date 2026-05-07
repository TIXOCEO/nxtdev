"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  createTenantSchema,
  updateTenantSchema,
  setTenantStatusSchema,
  createTenantAdminSchema,
  createTenantWithAdminSchema,
  updateMasterAdminSchema,
  type UpdateTenantInput,
  type SetTenantStatusInput,
  type CreateTenantAdminInput,
  type CreateTenantWithAdminInput,
  type UpdateMasterAdminInput,
} from "@/lib/validation/platform";
import { findUniqueSlug } from "@/lib/utils/slug";
import { seedTenantHomepageFromSector } from "@/lib/db/sector-template-seed";
import type { Tenant } from "@/types/database";

/**
 * Subdomeinen die voor het platform zelf gereserveerd zijn — die mogen
 * niet als tenant-slug worden gebruikt, anders kunnen klanten van de
 * subdomein-routing in `src/middleware.ts` worden afgehouden.
 */
const RESERVED_TENANT_SLUGS = new Set<string>([
  "www", "app", "api", "admin", "platform", "staging", "dev", "test",
  "mail", "m", "assets", "cdn", "static", "ftp", "smtp", "imap",
]);

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Create a new tenant AND its first master admin in one transaction-ish
 * flow. Order: auth user → tenant → membership. On any failure after the
 * auth user is created, the auth user is deleted to avoid orphans.
 */
export async function createTenant(
  input: CreateTenantWithAdminInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  await requirePlatformAdmin();

  const parsed = createTenantWithAdminSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const {
    admin_email,
    admin_password,
    admin_full_name,
    sector_template_key,
    ...rest
  } = parsed.data;
  const tenantFields: typeof rest & { sector_template_key?: string | null } = {
    ...rest,
    sector_template_key: sector_template_key ?? null,
  };

  const admin = createAdminClient();

  // Auto-fix slug-uniekheid + reserved-check. We pakken alle bestaande
  // slugs die met onze basis overlappen, voegen reserved subdomeinen toe,
  // en laten findUniqueSlug() een vrije variant kiezen (slug, slug-2, …).
  const desired = tenantFields.slug;
  const { data: takenRows } = await admin
    .from("tenants")
    .select("slug")
    .or(`slug.eq.${desired},slug.like.${desired}-%`);
  const taken = new Set<string>(
    (takenRows ?? []).map((r) => r.slug as string),
  );
  for (const r of RESERVED_TENANT_SLUGS) taken.add(r);
  tenantFields.slug = findUniqueSlug(desired, taken);

  // 1. Create the auth user (auto-confirmed so they can sign in immediately).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: admin_email,
    password: admin_password,
    email_confirm: true,
    user_metadata: admin_full_name ? { full_name: admin_full_name } : undefined,
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message ?? "Failed to create admin user.";
    if (/already.*registered|already.*exists|duplicate/i.test(msg)) {
      return fail("An account with that admin email already exists.", {
        admin_email: ["Email already in use."],
      });
    }
    return fail(msg, { admin_email: [msg] });
  }

  const userId = created.user.id;

  // 2. Ensure the profiles row exists (auth trigger may not be present).
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: admin_email,
        full_name: admin_full_name || null,
      },
      { onConflict: "id" },
    );
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    return fail(`Failed to create profile: ${profileErr.message}`);
  }

  // 3. Create the tenant.
  const supabase = await createClient();
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert(tenantFields)
    .select("id, slug")
    .single();

  if (tenantErr || !tenant) {
    await admin.auth.admin.deleteUser(userId);
    if (tenantErr?.code === "23505") {
      return fail("A tenant with that slug already exists.", {
        slug: ["Slug already in use."],
      });
    }
    return fail(tenantErr?.message ?? "Failed to create tenant.");
  }

  // 4. Create the master admin membership (using service role to bypass RLS).
  const { error: memErr } = await admin.from("tenant_memberships").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "tenant_admin",
  });

  if (memErr) {
    await admin.from("tenants").delete().eq("id", tenant.id);
    await admin.auth.admin.deleteUser(userId);
    return fail(`Failed to assign master admin: ${memErr.message}`);
  }

  // Sprint 39 — pas sector-default homepage-modules toe (best-effort).
  // Faalt deze stap, dan blokkeert dat het aanmaken van de tenant niet:
  // de platform-admin kan later via "Seed homepage" alsnog (her-)seeden.
  try {
    const seedRes = await seedTenantHomepageFromSector(tenant.id);
    if (
      seedRes.reason === "tenant_read_error" ||
      seedRes.reason === "template_read_error" ||
      seedRes.reason === "tenant_modules_count_error" ||
      seedRes.reason === "catalog_read_error" ||
      seedRes.reason === "invalid_template_modules"
    ) {
      console.error(
        `[createTenant] sector-homepage seed reason=${seedRes.reason} ` +
          `tenant=${tenant.id} error=${seedRes.error ?? "unknown"}`,
      );
    }
  } catch (err) {
    // Best-effort: tenant is al aangemaakt, seed-fout blokkeert niet.
    // Wel loggen zodat operationeel zichtbaar is wat misging.
    console.error(
      `[createTenant] sector-homepage seed threw for tenant=${tenant.id}: ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }

  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  return { ok: true, data: tenant };
}

/**
 * Update the master admin's email and/or password. The master admin is
 * defined as the earliest `tenant_admin` membership for the tenant.
 */
export async function updateTenantMasterAdmin(
  input: UpdateMasterAdminInput,
): Promise<ActionResult<{ user_id: string }>> {
  await requirePlatformAdmin();

  const parsed = updateMasterAdminSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }
  const { tenant_id, email, password } = parsed.data;

  const admin = createAdminClient();

  // Find the master admin = earliest tenant_admin membership.
  const { data: membership, error: memErr } = await admin
    .from("tenant_memberships")
    .select("user_id, created_at")
    .eq("tenant_id", tenant_id)
    .eq("role", "tenant_admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr) return fail(memErr.message);
  if (!membership) return fail("This tenant has no master admin to update.");

  const userId = membership.user_id;
  const updates: { email?: string; password?: string } = {};
  if (email) updates.email = email;
  if (password) updates.password = password;

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    ...updates,
    email_confirm: email ? true : undefined,
  });

  if (updErr) {
    if (/already.*registered|already.*exists|duplicate/i.test(updErr.message)) {
      return fail("An account with that email already exists.", {
        email: ["Email already in use."],
      });
    }
    return fail(updErr.message);
  }

  // Mirror the email change into profiles so UI lookups match. If this
  // fails the auth email change has already succeeded, so surface the
  // drift rather than silently ignoring it.
  if (email) {
    const { error: pErr } = await admin
      .from("profiles")
      .update({ email })
      .eq("id", userId);
    if (pErr) {
      return fail(
        `Auth email updated, but failed to mirror to profile: ${pErr.message}`,
      );
    }
  }

  revalidatePath(`/platform/tenants/${tenant_id}`);
  return { ok: true, data: { user_id: userId } };
}

export async function updateTenant(
  id: string,
  input: Omit<UpdateTenantInput, "id">,
): Promise<ActionResult<Tenant>> {
  await requirePlatformAdmin();

  const parsed = updateTenantSchema.safeParse({ ...input, id });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }
  const { id: _id, ...patch } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") return fail("Slug already in use.");
    return fail(error?.message ?? "Failed to update tenant.");
  }

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${id}`);
  return { ok: true, data: data as Tenant };
}

export async function setTenantStatus(
  id: string,
  status: SetTenantStatusInput["status"],
): Promise<ActionResult<Tenant>> {
  await requirePlatformAdmin();

  const parsed = setTenantStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select()
    .single();

  if (error || !data) return fail(error?.message ?? "Failed to update status.");

  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${id}`);
  return { ok: true, data: data as Tenant };
}

/**
 * Assign tenant_admin role to an existing user by email.
 * Does NOT create auth users — that requires a service-role flow we have
 * not yet wired up. The target user must have logged in once first so a
 * `profiles` row exists.
 */
export async function createTenantAdmin(
  input: CreateTenantAdminInput,
): Promise<ActionResult<{ membership_id: string }>> {
  await requirePlatformAdmin();

  const parsed = createTenantAdminSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  // Case-insensitive email lookup. Sprint 2/4 stores emails lowercased,
  // but defensively use ilike for legacy rows.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (profileError) return fail(profileError.message);
  if (!profile) {
    // Generic message — don't enumerate which emails do/don't exist.
    return fail(
      "Could not assign admin. The user must sign in once at /login first, then try again.",
    );
  }

  // Optionally update full_name if provided and currently empty.
  if (parsed.data.full_name && !profile.full_name) {
    await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name })
      .eq("id", profile.id);
  }

  // Check if membership already exists for this tenant + user.
  const { data: existing } = await supabase
    .from("tenant_memberships")
    .select("id, role")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existing) {
    if (existing.role === "tenant_admin") {
      return fail("This user is already a tenant admin for this tenant.");
    }
    const { error: upErr } = await supabase
      .from("tenant_memberships")
      .update({ role: "tenant_admin" })
      .eq("id", existing.id);
    if (upErr) return fail(upErr.message);
    revalidatePath(`/platform/tenants/${parsed.data.tenant_id}`);
    return { ok: true, data: { membership_id: existing.id } };
  }

  const { data: created, error: insErr } = await supabase
    .from("tenant_memberships")
    .insert({
      tenant_id: parsed.data.tenant_id,
      user_id: profile.id,
      role: "tenant_admin",
    })
    .select("id")
    .single();

  if (insErr || !created) return fail(insErr?.message ?? "Failed to assign admin.");

  revalidatePath(`/platform/tenants/${parsed.data.tenant_id}`);
  return { ok: true, data: { membership_id: created.id } };
}
