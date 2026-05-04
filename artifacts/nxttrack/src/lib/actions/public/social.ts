"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPostSchema,
  updatePostSchema,
  deletePostSchema,
  createCommentSchema,
  deleteCommentSchema,
  toggleLikeSchema,
} from "@/lib/validation/social";
import { getSocialSettings, getMyMemberId, getViewerVisibilityContext } from "@/lib/db/social";
import { canViewPost } from "@/lib/permissions/social";
import {
  canPostToSocial,
  canCommentOnPost,
  canLikePost,
  isMemberMuted,
  canCoachBroadcast,
} from "@/lib/permissions/social";
import { getUserTenantContext, isMinorAthlete } from "@/lib/auth/user-role-rules";
import { sendNotification } from "@/lib/notifications/send-notification";
import { hasTenantAccess } from "@/lib/permissions";
import { getMemberships } from "@/lib/auth/get-memberships";
import type { Post } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function tenantSlugOf(tenantId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle();
  return (data as { slug: string } | null)?.slug ?? null;
}

function revalidateFeed(slug: string | null) {
  if (slug) {
    revalidatePath(`/t/${slug}/feed`);
    revalidatePath(`/t/${slug}`);
  }
  revalidatePath("/tenant/social-moderation");
}

async function resolveContext(tenantId: string, userId: string) {
  const admin = createAdminClient();
  const ctx = await getUserTenantContext(tenantId, userId);
  const memberId = ctx.members[0]?.id ?? null;
  let isLinkedAsChild = false;
  if (memberId) {
    const { data: link } = await admin
      .from("member_links")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("child_member_id", memberId)
      .limit(1)
      .maybeSingle();
    isLinkedAsChild = !!link;
  }
  const memberships = await getMemberships(userId);
  const isAdmin = hasTenantAccess(memberships, tenantId);
  const isMinor = memberId
    ? isMinorAthlete({ id: memberId }, isLinkedAsChild, ctx.roles)
    : false;
  const isMuted = memberId ? await isMemberMuted(tenantId, memberId) : false;
  return { ctx, memberId, isAdmin, isMinor, isMuted };
}

// ───────────────────── createPost ─────────────────────
export async function createPost(
  input: z.infer<typeof createPostSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer",
    };
  }
  const user = await requireAuth();
  const { ctx, memberId, isAdmin, isMinor, isMuted } = await resolveContext(
    parsed.data.tenant_id,
    user.id,
  );
  if (!memberId && !isAdmin) {
    return { ok: false, error: "Geen lid in deze club." };
  }
  const settings = await getSocialSettings(parsed.data.tenant_id);
  if (!canPostToSocial(settings, { isAdmin, isMinor, isMuted })) {
    return { ok: false, error: "Je hebt geen rechten om te plaatsen." };
  }
  if (parsed.data.coach_broadcast && !isAdmin && !canCoachBroadcast(ctx.roles)) {
    return { ok: false, error: "Geen rechten voor coach-broadcast." };
  }
  if (parsed.data.media_url && !settings.allow_media && !isAdmin) {
    return { ok: false, error: "Media is niet toegestaan." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .insert({
      tenant_id: parsed.data.tenant_id,
      author_member_id: memberId,
      type: parsed.data.coach_broadcast ? "coach_broadcast" : parsed.data.type,
      content: parsed.data.content ?? null,
      media_url: parsed.data.media_url ?? null,
      media_type: parsed.data.media_type ?? null,
      visibility: parsed.data.visibility,
      target_id: parsed.data.target_id ?? null,
      comments_enabled: parsed.data.comments_enabled,
      coach_broadcast: parsed.data.coach_broadcast,
    })
    .select("id, visibility, target_id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Plaatsen mislukt." };
  }

  const slug = await tenantSlugOf(parsed.data.tenant_id);
  revalidateFeed(slug);

  // ─── Mentions ───
  await persistMentions({
    tenantId: parsed.data.tenant_id,
    postId: data.id,
    commentId: null,
    mentionedBy: memberId,
    mentionedMemberIds: parsed.data.mentioned_member_ids ?? [],
    settings,
    isAdmin,
    slug,
    contentSnippet: parsed.data.content?.slice(0, 200) ?? "",
    createdBy: user.id,
  });

  // Best-effort notification triggers.
  try {
    if (parsed.data.coach_broadcast) {
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: "Nieuw bericht van de trainer",
        contentText: parsed.data.content?.slice(0, 200) ?? "Bekijk het bericht",
        targets:
          parsed.data.visibility === "team" && parsed.data.target_id
            ? [{ target_type: "group", target_id: parsed.data.target_id }]
            : [{ target_type: "all" }],
        sendEmail: false,
        sendPush: true,
        pushUrl: slug ? `/t/${slug}/feed/${data.id}` : null,
        source: "social_coach_broadcast",
        sourceRef: data.id,
        createdBy: user.id,
      });
    } else if (parsed.data.visibility === "team" && parsed.data.target_id) {
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: "Nieuw teampost",
        contentText: parsed.data.content?.slice(0, 200) ?? "",
        targets: [{ target_type: "group", target_id: parsed.data.target_id }],
        sendEmail: false,
        sendPush: false,
        pushUrl: slug ? `/t/${slug}/feed/${data.id}` : null,
        source: "social_new_team_post",
        sourceRef: data.id,
        createdBy: user.id,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[social] notify createPost:", err);
  }

  return { ok: true, data: { id: (data as { id: string }).id } };
}

// ───────────────────── updatePost ─────────────────────
export async function updatePost(
  input: z.infer<typeof updatePostSchema>,
): Promise<ActionResult<void>> {
  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await requireAuth();
  const { memberId, isAdmin } = await resolveContext(
    parsed.data.tenant_id,
    user.id,
  );

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("posts")
    .select("author_member_id")
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Niet gevonden." };
  const ownsPost =
    memberId !== null && (existing as Post).author_member_id === memberId;
  if (!isAdmin && !ownsPost) {
    return { ok: false, error: "Geen rechten." };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.content !== undefined) patch.content = parsed.data.content;
  if (parsed.data.comments_enabled !== undefined)
    patch.comments_enabled = parsed.data.comments_enabled;
  if (parsed.data.is_pinned !== undefined && isAdmin)
    patch.is_pinned = parsed.data.is_pinned;

  const { error } = await admin
    .from("posts")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidateFeed(await tenantSlugOf(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

// ───────────────────── deletePost ─────────────────────
export async function deletePost(
  input: z.infer<typeof deletePostSchema>,
): Promise<ActionResult<void>> {
  const parsed = deletePostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await requireAuth();
  const { memberId, isAdmin } = await resolveContext(
    parsed.data.tenant_id,
    user.id,
  );
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("posts")
    .select("author_member_id")
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Niet gevonden." };
  const ownsPost =
    memberId !== null && (existing as Post).author_member_id === memberId;
  if (!isAdmin && !ownsPost) return { ok: false, error: "Geen rechten." };
  const { error } = await admin
    .from("posts")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidateFeed(await tenantSlugOf(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

// ───────────────────── createComment ─────────────────────
export async function createComment(
  input: z.infer<typeof createCommentSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer",
    };
  }
  const user = await requireAuth();
  const { memberId, isAdmin, isMinor, isMuted } = await resolveContext(
    parsed.data.tenant_id,
    user.id,
  );
  if (!memberId && !isAdmin) return { ok: false, error: "Geen lid in deze club." };

  const settings = await getSocialSettings(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("id, comments_enabled, is_hidden, author_member_id")
    .eq("id", parsed.data.post_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!post) return { ok: false, error: "Bericht niet gevonden." };

  // Visibility check — caller must be able to see the post.
  const { data: fullPost } = await admin
    .from("posts")
    .select("*")
    .eq("id", parsed.data.post_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!fullPost) return { ok: false, error: "Bericht niet gevonden." };
  const vis = await getViewerVisibilityContext(
    parsed.data.tenant_id,
    user.id,
  );
  if (
    !canViewPost(fullPost as Post, {
      isAdmin,
      viewerMemberIds: vis.viewerMemberIds,
      viewerGroupIds: vis.viewerGroupIds,
      viewerRoles: vis.viewerRoles,
      viewerIsTrainerLike: vis.viewerIsTrainerLike,
    })
  ) {
    return { ok: false, error: "Geen toegang tot dit bericht." };
  }
  if (!canCommentOnPost(settings, post as Post, { isAdmin, isMinor, isMuted })) {
    return { ok: false, error: "Reageren is niet toegestaan." };
  }

  // Enforce max 2 levels: parent must be a top-level comment.
  if (parsed.data.parent_id) {
    const { data: parent } = await admin
      .from("comments")
      .select("parent_id, post_id")
      .eq("id", parsed.data.parent_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle();
    if (!parent) return { ok: false, error: "Parent niet gevonden." };
    if ((parent as { parent_id: string | null }).parent_id) {
      return { ok: false, error: "Maximaal 2 niveaus toegestaan." };
    }
    if ((parent as { post_id: string }).post_id !== parsed.data.post_id) {
      return { ok: false, error: "Parent hoort niet bij dit bericht." };
    }
  }

  const { data, error } = await admin
    .from("comments")
    .insert({
      tenant_id: parsed.data.tenant_id,
      post_id: parsed.data.post_id,
      parent_id: parsed.data.parent_id ?? null,
      author_member_id: memberId,
      content: parsed.data.content,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Mislukt" };

  // ─── Mentions on comment ───
  await persistMentions({
    tenantId: parsed.data.tenant_id,
    postId: parsed.data.post_id,
    commentId: data.id,
    mentionedBy: memberId,
    mentionedMemberIds: parsed.data.mentioned_member_ids ?? [],
    settings,
    isAdmin,
    slug: await tenantSlugOf(parsed.data.tenant_id),
    contentSnippet: parsed.data.content.slice(0, 200),
    createdBy: user.id,
  });

  // Notify post author (if not self).
  try {
    const authorMemberId = (post as { author_member_id: string | null })
      .author_member_id;
    if (authorMemberId && authorMemberId !== memberId) {
      const slug = await tenantSlugOf(parsed.data.tenant_id);
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: "Nieuwe reactie op je bericht",
        contentText: parsed.data.content.slice(0, 200),
        targets: [{ target_type: "member", target_id: authorMemberId }],
        sendEmail: false,
        sendPush: true,
        pushUrl: slug ? `/t/${slug}/feed/${parsed.data.post_id}` : null,
        source: "social_new_comment",
        sourceRef: parsed.data.post_id,
        createdBy: user.id,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[social] notify createComment:", err);
  }

  revalidateFeed(await tenantSlugOf(parsed.data.tenant_id));
  return { ok: true, data: { id: (data as { id: string }).id } };
}

// ───────────────────── deleteComment ─────────────────────
export async function deleteComment(
  input: z.infer<typeof deleteCommentSchema>,
): Promise<ActionResult<void>> {
  const parsed = deleteCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await requireAuth();
  const { memberId, isAdmin } = await resolveContext(
    parsed.data.tenant_id,
    user.id,
  );
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("comments")
    .select("author_member_id, post_id")
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!c) return { ok: false, error: "Niet gevonden." };
  if (
    !isAdmin &&
    (c as { author_member_id: string | null }).author_member_id !== memberId
  ) {
    return { ok: false, error: "Geen rechten." };
  }
  const { error } = await admin
    .from("comments")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidateFeed(await tenantSlugOf(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

// ───────────────────── toggleLike ─────────────────────
export async function toggleLike(
  input: z.infer<typeof toggleLikeSchema>,
): Promise<ActionResult<{ liked: boolean }>> {
  const parsed = toggleLikeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await requireAuth();
  const { memberId, isAdmin, isMinor, isMuted } = await resolveContext(
    parsed.data.tenant_id,
    user.id,
  );
  if (!memberId) return { ok: false, error: "Geen lid in deze club." };
  const settings = await getSocialSettings(parsed.data.tenant_id);
  if (!canLikePost(settings, { isAdmin, isMinor, isMuted })) {
    return { ok: false, error: "Liken is niet toegestaan." };
  }

  const admin = createAdminClient();
  // Visibility check — caller must be able to see the post.
  const { data: fullPost } = await admin
    .from("posts")
    .select("*")
    .eq("id", parsed.data.post_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!fullPost) return { ok: false, error: "Bericht niet gevonden." };
  const vis = await getViewerVisibilityContext(
    parsed.data.tenant_id,
    user.id,
  );
  if (
    !canViewPost(fullPost as Post, {
      isAdmin,
      viewerMemberIds: vis.viewerMemberIds,
      viewerGroupIds: vis.viewerGroupIds,
      viewerRoles: vis.viewerRoles,
      viewerIsTrainerLike: vis.viewerIsTrainerLike,
    })
  ) {
    return { ok: false, error: "Geen toegang tot dit bericht." };
  }
  const { data: existing } = await admin
    .from("post_likes")
    .select("id")
    .eq("post_id", parsed.data.post_id)
    .eq("member_id", memberId)
    .maybeSingle();

  if (existing) {
    await admin.from("post_likes").delete().eq("id", (existing as { id: string }).id);
    revalidateFeed(await tenantSlugOf(parsed.data.tenant_id));
    return { ok: true, data: { liked: false } };
  }

  const { error } = await admin.from("post_likes").insert({
    tenant_id: parsed.data.tenant_id,
    post_id: parsed.data.post_id,
    member_id: memberId,
    emoji: parsed.data.emoji,
  });
  if (error) return { ok: false, error: error.message };

  // Notify post author (if not self).
  try {
    const { data: post } = await admin
      .from("posts")
      .select("author_member_id")
      .eq("id", parsed.data.post_id)
      .maybeSingle();
    const authorMemberId = (post as { author_member_id: string | null } | null)
      ?.author_member_id;
    if (authorMemberId && authorMemberId !== memberId) {
      const slug = await tenantSlugOf(parsed.data.tenant_id);
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: "Iemand liket je bericht",
        contentText: parsed.data.emoji,
        targets: [{ target_type: "member", target_id: authorMemberId }],
        sendEmail: false,
        sendPush: false,
        pushUrl: slug ? `/t/${slug}/feed/${parsed.data.post_id}` : null,
        source: "social_like",
        sourceRef: parsed.data.post_id,
        createdBy: user.id,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[social] notify toggleLike:", err);
  }

  revalidateFeed(await tenantSlugOf(parsed.data.tenant_id));
  return { ok: true, data: { liked: true } };
}

// ───────────────────── helper used by other modules ─────────────────────
export { getMyMemberId };

// ───────────────────── mentions persistence ─────────────────────
async function persistMentions(args: {
  tenantId: string;
  postId: string;
  commentId: string | null;
  mentionedBy: string | null;
  mentionedMemberIds: string[];
  settings: { allow_mentions: boolean };
  isAdmin: boolean;
  slug: string | null;
  contentSnippet: string;
  createdBy: string;
}): Promise<void> {
  if (args.mentionedMemberIds.length === 0) return;
  if (!args.settings.allow_mentions && !args.isAdmin) return;
  const admin = createAdminClient();

  // Validate mentioned IDs belong to this tenant.
  const { data: validRows } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", args.tenantId)
    .in("id", args.mentionedMemberIds);
  const validIds = ((validRows ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (validIds.length === 0) return;

  await admin.from("post_mentions").insert(
    validIds.map((mid) => ({
      tenant_id: args.tenantId,
      post_id: args.postId,
      comment_id: args.commentId,
      mentioned_member_id: mid,
      mentioned_by_member_id: args.mentionedBy,
    })),
  );

  try {
    for (const mid of validIds) {
      if (mid === args.mentionedBy) continue;
      await sendNotification({
        tenantId: args.tenantId,
        title: "Je bent genoemd in een bericht",
        contentText: args.contentSnippet,
        targets: [{ target_type: "member", target_id: mid }],
        sendEmail: false,
        sendPush: true,
        pushUrl: args.slug ? `/t/${args.slug}/feed/${args.postId}` : null,
        source: "social_mention",
        sourceRef: args.postId,
        createdBy: args.createdBy,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[social] notify mentions:", err);
  }
}
