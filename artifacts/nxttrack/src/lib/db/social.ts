import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Comment,
  Member,
  Post,
  PostLike,
  SocialMute,
  SocialSettings,
} from "@/types/database";
import { canViewPost } from "@/lib/permissions/social";
import { getUserTenantContext } from "@/lib/auth/user-role-rules";

const DEFAULT_SETTINGS: SocialSettings = {
  tenant_id: "",
  allow_posts: true,
  allow_comments: true,
  allow_likes: true,
  allow_media: true,
  allow_auto_posts: false,
  allow_mentions: false,
  minor_read_only: true,
  minor_team_feed_allowed: false,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export async function getSocialSettings(
  tenantId: string,
): Promise<SocialSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_SETTINGS, tenant_id: tenantId };
  return data as SocialSettings;
}

export interface FeedPostWithMeta {
  post: Post;
  author: { id: string; full_name: string } | null;
  likes_count: number;
  comments_count: number;
  viewer_liked: boolean;
}

export interface GetFeedParams {
  tenantId: string;
  userId: string | null;
  limit?: number;
  cursor?: string | null;
  filter?: "all" | "team" | "coach" | "achievements";
}

export async function getFeedPosts(
  params: GetFeedParams,
): Promise<{ items: FeedPostWithMeta[]; nextCursor: string | null }> {
  const admin = createAdminClient();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);

  const settings = await getSocialSettings(params.tenantId);

  // Resolve viewer context (members, groups, roles, parent links)
  let viewerMemberIds: string[] = [];
  let viewerGroupIds: string[] = [];
  let viewerRoles: string[] = [];
  let viewerChildMemberIds: string[] = [];
  let isAdmin = false;
  let viewerIsTrainerLike = false;
  let isMinorViewer = false;

  if (params.userId) {
    const ctx = await getUserTenantContext(params.tenantId, params.userId);
    viewerMemberIds = ctx.members.map((m) => m.id);
    viewerChildMemberIds = ctx.children.map((c) => c.id);
    viewerRoles = ctx.roles as string[];
    viewerIsTrainerLike =
      viewerRoles.includes("trainer") ||
      viewerRoles.includes("staff") ||
      viewerRoles.includes("volunteer");

    // Tenant-admin / platform-admin lookup — scoped to THIS tenant only.
    const { data: m } = await admin
      .from("tenant_memberships")
      .select("role, tenant_id")
      .eq("user_id", params.userId);
    const roleRows = (m ?? []) as Array<{ role: string; tenant_id: string | null }>;
    const isPlatformAdmin = roleRows.some(
      (r) => r.role === "platform_admin",
    );
    const isTenantAdminHere = roleRows.some(
      (r) => r.role === "tenant_admin" && r.tenant_id === params.tenantId,
    );
    isAdmin = isPlatformAdmin || isTenantAdminHere;

    if (viewerMemberIds.length > 0) {
      const { data: gm } = await admin
        .from("group_members")
        .select("group_id")
        .in("member_id", viewerMemberIds);
      viewerGroupIds = ((gm ?? []) as Array<{ group_id: string }>).map(
        (r) => r.group_id,
      );
    }

    // Minor viewer: athlete role + at least one parent link
    if (viewerRoles.includes("athlete") && viewerMemberIds.length > 0) {
      const { data: linked } = await admin
        .from("member_links")
        .select("id")
        .eq("tenant_id", params.tenantId)
        .in("child_member_id", viewerMemberIds)
        .limit(1);
      isMinorViewer = (linked ?? []).length > 0;
    }
  }

  // Pull a window of recent non-hidden posts; filter visibility in app.
  let q = admin
    .from("posts")
    .select("*")
    .eq("tenant_id", params.tenantId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit * 3); // overscan for visibility filter

  if (params.cursor) q = q.lt("created_at", params.cursor);

  switch (params.filter) {
    case "team":
      q = q.eq("visibility", "team");
      break;
    case "coach":
      q = q.eq("coach_broadcast", true);
      break;
    case "achievements":
      q = q.eq("type", "achievement");
      break;
  }

  const { data: rows } = await q;
  const all = (rows ?? []) as Post[];

  const visible = all.filter((p) => {
    if (
      isMinorViewer &&
      !settings.minor_team_feed_allowed &&
      p.visibility === "team"
    ) {
      return false;
    }
    return canViewPost(p, {
      isAdmin,
      viewerMemberIds,
      viewerGroupIds,
      viewerRoles,
      viewerIsTrainerLike,
    });
  });

  const sliced = visible.slice(0, limit);
  const nextCursor =
    sliced.length === limit ? sliced[sliced.length - 1]!.created_at : null;

  if (sliced.length === 0) return { items: [], nextCursor: null };

  const postIds = sliced.map((p) => p.id);
  const authorIds = Array.from(
    new Set(sliced.map((p) => p.author_member_id).filter(Boolean) as string[]),
  );

  const [{ data: authors }, { data: likes }, { data: comments }, viewerLikes] =
    await Promise.all([
      authorIds.length > 0
        ? admin.from("members").select("id, full_name").in("id", authorIds)
        : Promise.resolve({ data: [] as Array<Pick<Member, "id" | "full_name">> }),
      admin.from("post_likes").select("post_id").in("post_id", postIds),
      admin.from("comments").select("post_id").in("post_id", postIds).eq("is_hidden", false),
      params.userId && viewerMemberIds.length > 0
        ? admin
            .from("post_likes")
            .select("post_id")
            .in("post_id", postIds)
            .in("member_id", viewerMemberIds)
        : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
    ]);

  const authorMap = new Map(
    ((authors ?? []) as Array<{ id: string; full_name: string }>).map((a) => [
      a.id,
      a,
    ]),
  );
  const likeCount = new Map<string, number>();
  for (const l of (likes ?? []) as Array<{ post_id: string }>) {
    likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1);
  }
  const commentCount = new Map<string, number>();
  for (const c of (comments ?? []) as Array<{ post_id: string }>) {
    commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
  }
  const viewerLiked = new Set(
    ((viewerLikes.data ?? []) as Array<{ post_id: string }>).map(
      (r) => r.post_id,
    ),
  );

  const items: FeedPostWithMeta[] = sliced.map((p) => ({
    post: p,
    author: p.author_member_id
      ? (authorMap.get(p.author_member_id) ?? null)
      : null,
    likes_count: likeCount.get(p.id) ?? 0,
    comments_count: commentCount.get(p.id) ?? 0,
    viewer_liked: viewerLiked.has(p.id),
  }));

  return { items, nextCursor };
}

export async function getPostById(
  postId: string,
  tenantId: string,
): Promise<Post | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as Post | null) ?? null;
}

export async function getPostComments(
  postId: string,
  tenantId: string,
): Promise<Array<Comment & { author: { id: string; full_name: string } | null }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .eq("tenant_id", tenantId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Comment[];
  if (rows.length === 0) return [];
  const ids = Array.from(
    new Set(rows.map((r) => r.author_member_id).filter(Boolean) as string[]),
  );
  const { data: authors } = await admin
    .from("members")
    .select("id, full_name")
    .in("id", ids);
  const map = new Map(
    ((authors ?? []) as Array<{ id: string; full_name: string }>).map((a) => [
      a.id,
      a,
    ]),
  );
  return rows.map((r) => ({
    ...r,
    author: r.author_member_id ? (map.get(r.author_member_id) ?? null) : null,
  }));
}

export async function getPostLikes(
  postId: string,
  tenantId: string,
): Promise<PostLike[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("post_likes")
    .select("*")
    .eq("post_id", postId)
    .eq("tenant_id", tenantId);
  return (data ?? []) as PostLike[];
}

export async function getMutedMember(
  tenantId: string,
  memberId: string,
): Promise<SocialMute | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_mutes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId)
    .maybeSingle();
  return (data as SocialMute | null) ?? null;
}

export async function listMutedMembers(
  tenantId: string,
): Promise<Array<SocialMute & { member: { id: string; full_name: string } | null }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_mutes")
    .select("*, member:members!social_mutes_member_id_fkey(id, full_name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Array<
    SocialMute & { member: { id: string; full_name: string } | null }
  >;
}

export interface ModerationStats {
  totalPosts: number;
  hiddenPosts: number;
  totalComments: number;
  hiddenComments: number;
  mutedMembers: number;
}

export async function getSocialModerationStats(
  tenantId: string,
): Promise<ModerationStats> {
  const admin = createAdminClient();
  const [posts, hidden, comments, hiddenC, mutes] = await Promise.all([
    admin.from("posts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("posts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_hidden", true),
    admin.from("comments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("comments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_hidden", true),
    admin.from("social_mutes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  return {
    totalPosts: posts.count ?? 0,
    hiddenPosts: hidden.count ?? 0,
    totalComments: comments.count ?? 0,
    hiddenComments: hiddenC.count ?? 0,
    mutedMembers: mutes.count ?? 0,
  };
}

export async function listRecentPostsAdmin(
  tenantId: string,
  filter: "all" | "visible" | "hidden" | "coach",
  limit = 50,
): Promise<Array<Post & { author: { id: string; full_name: string } | null }>> {
  const admin = createAdminClient();
  let q = admin
    .from("posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filter === "visible") q = q.eq("is_hidden", false);
  if (filter === "hidden") q = q.eq("is_hidden", true);
  if (filter === "coach") q = q.eq("coach_broadcast", true);
  const { data } = await q;
  const rows = (data ?? []) as Post[];
  if (rows.length === 0) return [];
  const ids = Array.from(
    new Set(rows.map((r) => r.author_member_id).filter(Boolean) as string[]),
  );
  const { data: authors } = await admin
    .from("members")
    .select("id, full_name")
    .in("id", ids);
  const map = new Map(
    ((authors ?? []) as Array<{ id: string; full_name: string }>).map((a) => [
      a.id,
      a,
    ]),
  );
  return rows.map((r) => ({
    ...r,
    author: r.author_member_id ? (map.get(r.author_member_id) ?? null) : null,
  }));
}

export interface AllowedTargets {
  groups: Array<{ id: string; name: string }>;
  members: Array<{ id: string; full_name: string }>;
}

export async function getAllowedPostTargets(
  tenantId: string,
  memberIds: string[],
): Promise<AllowedTargets> {
  const admin = createAdminClient();
  // For now: list all groups and members in tenant. UI can show what makes sense per visibility.
  const [{ data: groups }, { data: members }] = await Promise.all([
    admin.from("groups").select("id, name").eq("tenant_id", tenantId).order("name"),
    admin
      .from("members")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .order("full_name"),
  ]);
  void memberIds;
  return {
    groups: (groups ?? []) as Array<{ id: string; name: string }>,
    members: (members ?? []) as Array<{ id: string; full_name: string }>,
  };
}

export interface ViewerVisibilityContext {
  isAdmin: boolean;
  viewerMemberIds: string[];
  viewerGroupIds: string[];
  viewerRoles: string[];
  viewerIsTrainerLike: boolean;
  isMinorViewer: boolean;
}

/** Resolve a viewer's full visibility context for a single tenant. */
export async function getViewerVisibilityContext(
  tenantId: string,
  userId: string,
): Promise<ViewerVisibilityContext> {
  const admin = createAdminClient();
  const ctx = await getUserTenantContext(tenantId, userId);
  const viewerMemberIds = ctx.members.map((m) => m.id);
  const viewerRoles = ctx.roles as string[];
  const viewerIsTrainerLike =
    viewerRoles.includes("trainer") ||
    viewerRoles.includes("staff") ||
    viewerRoles.includes("volunteer");

  const { data: m } = await admin
    .from("tenant_memberships")
    .select("role, tenant_id")
    .eq("user_id", userId);
  const roleRows = (m ?? []) as Array<{ role: string; tenant_id: string | null }>;
  const isAdmin =
    roleRows.some((r) => r.role === "platform_admin") ||
    roleRows.some(
      (r) => r.role === "tenant_admin" && r.tenant_id === tenantId,
    );

  let viewerGroupIds: string[] = [];
  if (viewerMemberIds.length > 0) {
    const { data: gm } = await admin
      .from("group_members")
      .select("group_id")
      .in("member_id", viewerMemberIds);
    viewerGroupIds = ((gm ?? []) as Array<{ group_id: string }>).map(
      (r) => r.group_id,
    );
  }

  let isMinorViewer = false;
  if (viewerRoles.includes("athlete") && viewerMemberIds.length > 0) {
    const { data: linked } = await admin
      .from("member_links")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("child_member_id", viewerMemberIds)
      .limit(1);
    isMinorViewer = (linked ?? []).length > 0;
  }

  return {
    isAdmin,
    viewerMemberIds,
    viewerGroupIds,
    viewerRoles,
    viewerIsTrainerLike,
    isMinorViewer,
  };
}

/** Resolve the current user's primary member id in a tenant (or null). */
export async function getMyMemberId(
  tenantId: string,
  userId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
