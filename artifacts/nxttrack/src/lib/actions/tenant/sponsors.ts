"use server";

import { revalidatePath } from "next/cache";
import { assertTenantAccess } from "./_assert-access";
import { createClient } from "@/lib/supabase/server";
import { createSponsorSchema } from "@/lib/validation/sponsors";
import type { z } from "zod";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/tenant/sponsors");
  revalidatePath("/t", "layout");
}

// Autorisatie loopt via RLS (`sp_admin_all` op public.sponsors gebruikt
// `has_tenant_access(tenant_id)`); de TS-gate `assertTenantAccess` blijft als
// nettere foutmelding voor unauth/forbidden.
export async function createSponsor(
  input: z.infer<typeof createSponsorSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSponsorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("sponsors")
    .select("position")
    .eq("tenant_id", parsed.data.tenant_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((maxRow as { position: number } | null)?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("sponsors")
    .insert({
      tenant_id: parsed.data.tenant_id,
      name: parsed.data.name,
      logo_url: parsed.data.logo_url ?? null,
      website_url: parsed.data.website_url ?? null,
      is_active: parsed.data.is_active,
      position: nextPos,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert mislukt" };
  revalidate();
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateSponsor(input: {
  tenant_id: string;
  id: string;
  name?: string;
  logo_url?: string | null;
  website_url?: string | null;
  is_active?: boolean;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.logo_url !== undefined) patch.logo_url = input.logo_url;
  if (input.website_url !== undefined) patch.website_url = input.website_url;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };
  const { error } = await supabase
    .from("sponsors")
    .update(patch)
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function deleteSponsor(input: {
  tenant_id: string;
  id: string;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("sponsors")
    .delete()
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function reorderSponsors(input: {
  tenant_id: string;
  ordered_ids: string[];
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const supabase = await createClient();
  for (let i = 0; i < input.ordered_ids.length; i++) {
    const { error } = await supabase
      .from("sponsors")
      .update({ position: i })
      .eq("id", input.ordered_ids[i])
      .eq("tenant_id", input.tenant_id);
    if (error) return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true, data: undefined };
}

// `members.show_in_public` / `public_bio` worden afgedekt door
// `members_tenant_all` (has_tenant_access) — sprint8.
export async function setMemberPublicTrainerSettings(input: {
  tenant_id: string;
  member_id: string;
  show_in_public: boolean;
  public_bio?: string | null;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const supabase = await createClient();
  const patch: Record<string, unknown> = { show_in_public: input.show_in_public };
  if (input.public_bio !== undefined) patch.public_bio = input.public_bio;
  const { error } = await supabase
    .from("members")
    .update(patch)
    .eq("id", input.member_id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/tenant/members/${input.member_id}`);
  revalidatePath("/t", "layout");
  return { ok: true, data: undefined };
}
