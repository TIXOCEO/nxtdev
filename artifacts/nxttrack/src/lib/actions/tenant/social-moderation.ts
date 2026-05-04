"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertTenantAccess } from "./_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  moderationActionSchema,
  hideCommentSchema,
  muteMemberSchema,
  unmuteMemberSchema,
} from "@/lib/validation/social";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/tenant/social-moderation");
  revalidatePath(`/t`, "layout");
}

export async function moderatePost(
  input: z.infer<typeof moderationActionSchema>,
): Promise<ActionResult<void>> {
  const parsed = moderationActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.action === "hide") patch.is_hidden = true;
  if (parsed.data.action === "unhide") patch.is_hidden = false;
  if (parsed.data.action === "toggle_comments") {
    const { data } = await admin
      .from("posts")
      .select("comments_enabled")
      .eq("id", parsed.data.id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle();
    patch.comments_enabled = !((data as { comments_enabled: boolean } | null)
      ?.comments_enabled ?? true);
  }

  const { error } = await admin
    .from("posts")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function moderateComment(
  input: z.infer<typeof hideCommentSchema>,
): Promise<ActionResult<void>> {
  const parsed = hideCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("comments")
    .update({ is_hidden: parsed.data.hide, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function pinPost(input: {
  tenant_id: string;
  id: string;
  pin: boolean;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("posts")
    .update({ is_pinned: input.pin, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function muteMember(
  input: z.infer<typeof muteMemberSchema>,
): Promise<ActionResult<void>> {
  const parsed = muteMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin.from("social_mutes").upsert(
    {
      tenant_id: parsed.data.tenant_id,
      member_id: parsed.data.member_id,
      muted_until: parsed.data.muted_until ?? null,
      reason: parsed.data.reason ?? null,
      created_by: user.id,
    },
    { onConflict: "tenant_id,member_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function unmuteMember(
  input: z.infer<typeof unmuteMemberSchema>,
): Promise<ActionResult<void>> {
  const parsed = unmuteMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("social_mutes")
    .delete()
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("member_id", parsed.data.member_id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, data: undefined };
}
