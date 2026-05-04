import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/tenants";
import { getUser } from "@/lib/auth/get-user";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  getPostById,
  getPostComments,
  getPostLikes,
  getSocialSettings,
} from "@/lib/db/social";
import {
  getUserTenantContext,
  isMinorAthlete,
} from "@/lib/auth/user-role-rules";
import { hasTenantAccess } from "@/lib/permissions";
import { getMemberships } from "@/lib/auth/get-memberships";
import {
  canCommentOnPost,
  canViewPost,
  isMemberMuted,
} from "@/lib/permissions/social";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostCard } from "@/components/public/feed/post-card";
import { CommentThread } from "@/components/public/feed/comment-thread";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PostDetailPage({ params }: Props) {
  const { slug, id } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/feed/${id}`);

  const post = await getPostById(id, tenant.id);
  if (!post) notFound();

  const settingsEarly = await getSocialSettings(tenant.id);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  const memberships = await getMemberships(user.id);
  const isAdmin = hasTenantAccess(memberships, tenant.id);
  const memberId = ctx.members[0]?.id ?? null;

  // Visibility check
  const admin = createAdminClient();
  const memberIds = ctx.members.map((m) => m.id);
  let viewerGroupIds: string[] = [];
  if (memberIds.length > 0) {
    const { data: gm } = await admin
      .from("group_members")
      .select("group_id")
      .in("member_id", memberIds);
    viewerGroupIds = ((gm ?? []) as Array<{ group_id: string }>).map(
      (r) => r.group_id,
    );
  }
  const viewerIsTrainerLike =
    ctx.roles.includes("trainer") ||
    ctx.roles.includes("staff") ||
    ctx.roles.includes("volunteer");

  // Minor team-feed gate (parity with feed listing).
  let isMinorViewerEarly = false;
  if (memberId && ctx.roles.includes("athlete")) {
    const { data: linkedEarly } = await admin
      .from("member_links")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("child_member_id", memberId)
      .limit(1);
    isMinorViewerEarly = (linkedEarly ?? []).length > 0;
  }
  if (
    !isAdmin &&
    isMinorViewerEarly &&
    !settingsEarly.minor_team_feed_allowed &&
    post.visibility === "team"
  ) {
    notFound();
  }

  if (
    !canViewPost(post, {
      isAdmin,
      viewerMemberIds: memberIds,
      viewerGroupIds,
      viewerRoles: ctx.roles,
      viewerIsTrainerLike,
    })
  ) {
    notFound();
  }

  let isLinkedAsChild = false;
  if (memberId) {
    const { data: link } = await admin
      .from("member_links")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("child_member_id", memberId)
      .limit(1)
      .maybeSingle();
    isLinkedAsChild = !!link;
  }
  const isMinor = memberId
    ? isMinorAthlete({ id: memberId }, isLinkedAsChild, ctx.roles)
    : false;
  const isMuted = memberId ? await isMemberMuted(tenant.id, memberId) : false;

  const settings = settingsEarly;
  const [comments, likes] = await Promise.all([
    getPostComments(id, tenant.id),
    getPostLikes(id, tenant.id),
  ]);

  // Author lookup
  let author: { id: string; full_name: string } | null = null;
  if (post.author_member_id) {
    const { data } = await admin
      .from("members")
      .select("id, full_name")
      .eq("id", post.author_member_id)
      .maybeSingle();
    author = (data as { id: string; full_name: string } | null) ?? null;
  }
  const viewerLiked =
    memberId !== null &&
    likes.some((l) => l.member_id === memberId);

  const canComment = canCommentOnPost(settings, post, {
    isAdmin,
    isMinor,
    isMuted,
  });

  return (
    <PublicTenantShell tenant={tenant} active="feed" pageTitle="Bericht">
      <div className="space-y-4">
        <Link
          href={`/t/${slug}/feed`}
          className="inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Terug naar feed
        </Link>

        <PostCard
          tenantId={tenant.id}
          tenantSlug={slug}
          data={{
            post,
            author,
            likes_count: likes.length,
            comments_count: comments.length,
            viewer_liked: viewerLiked,
          }}
          canModify={
            isAdmin ||
            (memberId !== null && post.author_member_id === memberId)
          }
        />

        <section
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <h2
            className="mb-3 text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Reacties
          </h2>
          <CommentThread
            tenantId={tenant.id}
            postId={post.id}
            comments={comments}
            canComment={canComment}
            myMemberId={memberId}
            isAdmin={isAdmin}
          />
        </section>
      </div>
    </PublicTenantShell>
  );
}
