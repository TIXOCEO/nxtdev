"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { recordAudit } from "@/lib/audit/log";
import {
  createReleaseSchema,
  updateReleaseSchema,
  setReleaseStatusSchema,
  type CreateReleaseInput,
  type UpdateReleaseInput,
  type SetReleaseStatusInput,
} from "@/lib/validation/release";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function revalidateAll(id?: string) {
  revalidatePath("/platform/releases");
  if (id) revalidatePath(`/platform/releases/${id}`);
  revalidatePath("/tenant");
  revalidatePath("/tenant/releases");
}

export async function createRelease(
  input: CreateReleaseInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePlatformAdmin();
  const parsed = createReleaseSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const v = parsed.data;
  const { data, error } = await supabase
    .from("platform_releases")
    .insert({
      version: v.version,
      release_type: v.release_type,
      title: v.title,
      summary: v.summary,
      body_json: v.body,
      status: v.status,
      published_at:
        v.status === "published"
          ? new Date(v.published_at).toISOString()
          : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return fail("Versie bestaat al.", { version: ["Versie bestaat al."] });
    }
    return fail(error?.message ?? "Kon release niet aanmaken.");
  }

  await recordAudit({
    tenant_id: null,
    actor_user_id: user.id,
    action: "platform.release.create",
    meta: {
      release_id: data.id,
      version: v.version,
      release_type: v.release_type,
      status: v.status,
    },
  });

  revalidateAll(data.id);
  return { ok: true, data };
}

export async function updateRelease(
  input: UpdateReleaseInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePlatformAdmin();
  const parsed = updateReleaseSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const v = parsed.data;
  const { data, error } = await supabase
    .from("platform_releases")
    .update({
      version: v.version,
      release_type: v.release_type,
      title: v.title,
      summary: v.summary,
      body_json: v.body,
      status: v.status,
      published_at:
        v.status === "published"
          ? new Date(v.published_at).toISOString()
          : null,
    })
    .eq("id", v.id)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return fail("Versie bestaat al.", { version: ["Versie bestaat al."] });
    }
    return fail(error?.message ?? "Kon release niet bijwerken.");
  }

  await recordAudit({
    tenant_id: null,
    actor_user_id: user.id,
    action: "platform.release.update",
    meta: {
      release_id: v.id,
      version: v.version,
      release_type: v.release_type,
      status: v.status,
    },
  });

  revalidateAll(v.id);
  return { ok: true, data };
}

export async function setReleaseStatus(
  input: SetReleaseStatusInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePlatformAdmin();
  const parsed = setReleaseStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "published") {
    const { data: existing } = await supabase
      .from("platform_releases")
      .select("published_at")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!existing?.published_at) patch.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("platform_releases")
    .update(patch)
    .eq("id", parsed.data.id);

  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: null,
    actor_user_id: user.id,
    action: `platform.release.${parsed.data.status}`,
    meta: { release_id: parsed.data.id, status: parsed.data.status },
  });

  revalidateAll(parsed.data.id);
  return { ok: true, data: { id: parsed.data.id } };
}

export async function deleteRelease(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requirePlatformAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid id");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("platform_releases")
    .select("version")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("platform_releases").delete().eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: null,
    actor_user_id: user.id,
    action: "platform.release.delete",
    meta: {
      release_id: id,
      version: (existing?.version as string | undefined) ?? null,
    },
  });

  revalidateAll();
  return { ok: true, data: { id } };
}
