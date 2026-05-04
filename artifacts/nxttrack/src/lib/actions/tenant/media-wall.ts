"use server";

import { revalidatePath } from "next/cache";
import { assertTenantAccess } from "./_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMediaWallItemSchema } from "@/lib/validation/media-wall";
import type { z } from "zod";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/tenant/media-wall");
  revalidatePath("/t", "layout");
}

export async function createMediaWallItem(
  input: z.infer<typeof createMediaWallItemSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createMediaWallItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("media_wall_items")
    .select("position")
    .eq("tenant_id", parsed.data.tenant_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((maxRow as { position: number } | null)?.position ?? -1) + 1;
  const { data, error } = await admin
    .from("media_wall_items")
    .insert({
      tenant_id: parsed.data.tenant_id,
      title: parsed.data.title ?? null,
      media_url: parsed.data.media_url,
      media_type: parsed.data.media_type,
      is_active: parsed.data.is_active,
      position: nextPos,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert mislukt" };
  revalidate();
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateMediaWallItem(input: {
  tenant_id: string;
  id: string;
  title?: string | null;
  media_url?: string;
  media_type?: "image" | "video";
  is_active?: boolean;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.media_url !== undefined) patch.media_url = input.media_url;
  if (input.media_type !== undefined) patch.media_type = input.media_type;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };
  const { error } = await admin
    .from("media_wall_items")
    .update(patch)
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function deleteMediaWallItem(input: {
  tenant_id: string;
  id: string;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("media_wall_items")
    .delete()
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function reorderMediaWallItems(input: {
  tenant_id: string;
  ordered_ids: string[];
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const admin = createAdminClient();
  for (let i = 0; i < input.ordered_ids.length; i++) {
    const { error } = await admin
      .from("media_wall_items")
      .update({ position: i })
      .eq("id", input.ordered_ids[i])
      .eq("tenant_id", input.tenant_id);
    if (error) return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true, data: undefined };
}
