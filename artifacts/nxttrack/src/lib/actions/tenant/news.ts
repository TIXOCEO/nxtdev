"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { sendNotification } from "@/lib/notifications/send-notification";
import { getNotificationEvent } from "@/lib/db/notifications";
import {
  createNewsPostSchema,
  updateNewsPostSchema,
  newsCategorySchema,
  type CreateNewsPostInput,
  type UpdateNewsPostInput,
  type NewsCategoryInput,
} from "@/lib/validation/news";
import { findUniqueSlug } from "@/lib/utils/slug";
import type { NewsPost, NewsCategory } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function createNewsCategory(
  input: NewsCategoryInput,
): Promise<ActionResult<NewsCategory>> {
  const parsed = newsCategorySchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();

  // Auto-fix uniekheid binnen tenant.
  const desired = parsed.data.slug;
  const { data: takenRows } = await supabase
    .from("news_categories")
    .select("slug")
    .eq("tenant_id", parsed.data.tenant_id)
    .or(`slug.eq.${desired},slug.like.${desired}-%`);
  const taken = new Set<string>((takenRows ?? []).map((r) => r.slug as string));
  const finalSlug = findUniqueSlug(desired, taken);

  const { data, error } = await supabase
    .from("news_categories")
    .insert({ ...parsed.data, slug: finalSlug })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") return fail("A category with that slug already exists.");
    return fail(error?.message ?? "Failed to create category.");
  }
  revalidatePath("/tenant/news");
  return { ok: true, data: data as NewsCategory };
}

export async function createNewsPost(
  input: CreateNewsPostInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createNewsPostSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();

  // Auto-fix slug-uniekheid binnen tenant (kiest slug-2, slug-3, …).
  const desired = parsed.data.slug;
  const { data: takenRows } = await supabase
    .from("news_posts")
    .select("slug")
    .eq("tenant_id", parsed.data.tenant_id)
    .or(`slug.eq.${desired},slug.like.${desired}-%`);
  const taken = new Set<string>((takenRows ?? []).map((r) => r.slug as string));
  const finalSlug = findUniqueSlug(desired, taken);

  const payload = {
    ...parsed.data,
    slug: finalSlug,
    created_by: user.id,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("news_posts")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return fail("Slug already in use for this tenant.");
    return fail(error?.message ?? "Failed to create post.");
  }
  revalidatePath("/tenant");
  revalidatePath("/tenant/news");
  return { ok: true, data };
}

export async function updateNewsPost(
  id: string,
  input: Omit<UpdateNewsPostInput, "id">,
): Promise<ActionResult<NewsPost>> {
  const parsed = updateNewsPostSchema.safeParse({ ...input, id });
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();

  // Re-fetch to enforce tenant_id ownership server-side, ignoring any
  // tampering from the client.
  const { data: existing, error: fetchErr } = await supabase
    .from("news_posts")
    .select("id, tenant_id, status, published_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return fail(fetchErr.message);
  if (!existing) return fail("Post not found.");
  if (existing.tenant_id !== parsed.data.tenant_id) return fail("Tenant mismatch.");

  const { id: _id, tenant_id: _t, ...patch } = parsed.data;
  const next: Record<string, unknown> = { ...patch };
  if (patch.status === "published" && !existing.published_at) {
    next.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("news_posts")
    .update(next)
    .eq("id", id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") return fail("Slug already in use.");
    return fail(error?.message ?? "Failed to update post.");
  }

  // Sprint 11: News-publish trigger — fire whenever the post transitions
  // FROM a non-published state INTO 'published' (covers first publish AND
  // republish after unpublish/archive).
  const justPublished =
    patch.status === "published" && existing.status !== "published";
  if (justPublished) {
    try {
      const evt = await getNotificationEvent(parsed.data.tenant_id, "new_news_published");
      if (!evt || evt.template_enabled) {
        const post = data as NewsPost;
        const plain = (post.content_html ?? "")
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 280);
        await sendNotification({
          tenantId: parsed.data.tenant_id,
          title: post.title,
          contentHtml: post.excerpt
            ? `<p>${post.excerpt}</p>`
            : `<p>${plain}</p>`,
          contentText: post.excerpt ?? plain,
          targets: [{ target_type: "all" }],
          sendEmail: evt?.email_enabled ?? false,
          source: "news_published",
          sourceRef: post.id,
        });
      }
    } catch (err) {
      // Best-effort — never break a publish over a notification failure.
      // eslint-disable-next-line no-console
      console.error("[news] notification trigger failed:", err);
    }
  }

  revalidatePath("/tenant");
  revalidatePath("/tenant/news");
  revalidatePath(`/tenant/news/${id}`);
  return { ok: true, data: data as NewsPost };
}

export async function publishNewsPost(
  id: string,
  tenantId: string,
): Promise<ActionResult<NewsPost>> {
  return updateNewsPost(id, {
    tenant_id: tenantId,
    status: "published",
  });
}

export async function unpublishNewsPost(
  id: string,
  tenantId: string,
): Promise<ActionResult<NewsPost>> {
  return updateNewsPost(id, {
    tenant_id: tenantId,
    status: "draft",
  });
}

export async function deleteNewsPost(
  id: string,
  tenantId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
    return fail("Invalid id");
  }
  const user = await assertTenantAccess(tenantId);

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("news_posts")
    .select("title, slug, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { error } = await supabase
    .from("news_posts")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "news.delete",
    meta: {
      post_id: id,
      title: (existing?.title as string | undefined) ?? null,
      slug: (existing?.slug as string | undefined) ?? null,
      status: (existing?.status as string | undefined) ?? null,
    },
  });

  revalidatePath("/tenant/news");
  return { ok: true, data: { id } };
}

export async function uploadNewsCoverImage(
  formData: FormData,
): Promise<ActionResult<{ url: string; path: string }>> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const file = formData.get("file");

  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) return fail("Invalid tenant id.");
  if (!(file instanceof File)) return fail("No file provided.");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    return fail(`Unsupported file type: ${file.type || "unknown"}.`);
  if (file.size > MAX_UPLOAD_BYTES) return fail("File too large (max 5MB).");

  const user = await assertTenantAccess(tenantId);

  const supabase = await createClient();
  const ext =
    file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase() : "bin";
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const path = `${tenantId}/news/${filename}`;

  const { error: upErr } = await supabase.storage
    .from("tenant-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return fail(upErr.message);

  const { data: pub } = supabase.storage.from("tenant-media").getPublicUrl(path);
  const url = pub.publicUrl;

  // Best-effort media_assets record; ignore failures.
  await supabase.from("media_assets").insert({
    tenant_id: tenantId,
    url,
    path,
    file_type: file.type,
    uploaded_by: user.id,
  });

  return { ok: true, data: { url, path } };
}
