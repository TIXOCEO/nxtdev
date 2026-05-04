import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Member,
  MemberRoleName,
  Post,
  SocialSettings,
} from "@/types/database";
import type { UserTenantContext } from "@/lib/auth/user-role-rules";
import { isMinorAthlete } from "@/lib/auth/user-role-rules";

/** Caller-side check: the viewer is a minor athlete in this tenant. */
export function viewerIsMinorAthlete(
  member: Pick<Member, "id">,
  isLinkedAsChild: boolean,
  roles: MemberRoleName[] | string[],
): boolean {
  return isMinorAthlete(member, isLinkedAsChild, roles);
}

export function canPostToSocial(
  settings: SocialSettings | null,
  ctx: { isAdmin: boolean; isMinor: boolean; isMuted: boolean },
): boolean {
  if (!settings) return false;
  if (ctx.isMuted) return false;
  if (ctx.isAdmin) return settings.allow_posts || true;
  if (!settings.allow_posts) return false;
  if (ctx.isMinor && settings.minor_read_only) return false;
  return true;
}

export function canCommentOnPost(
  settings: SocialSettings | null,
  post: Pick<Post, "comments_enabled" | "is_hidden">,
  ctx: { isAdmin: boolean; isMinor: boolean; isMuted: boolean },
): boolean {
  if (!settings) return false;
  if (post.is_hidden) return false;
  if (!post.comments_enabled) return false;
  if (ctx.isMuted) return false;
  if (ctx.isAdmin) return true;
  if (!settings.allow_comments) return false;
  if (ctx.isMinor && settings.minor_read_only) return false;
  return true;
}

export function canLikePost(
  settings: SocialSettings | null,
  ctx: { isAdmin: boolean; isMinor: boolean; isMuted: boolean },
): boolean {
  if (!settings) return false;
  if (ctx.isMuted) return false;
  if (ctx.isAdmin) return true;
  if (!settings.allow_likes) return false;
  if (ctx.isMinor && settings.minor_read_only) return false;
  return true;
}

export function canCoachBroadcast(roles: MemberRoleName[] | string[]): boolean {
  return (
    roles.includes("trainer") ||
    roles.includes("staff") ||
    roles.includes("volunteer")
  );
}

/** Check if member is currently muted (returns true when muted_until is null OR future). */
export async function isMemberMuted(
  tenantId: string,
  memberId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_mutes")
    .select("muted_until")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!data) return false;
  const until = (data as { muted_until: string | null }).muted_until;
  if (!until) return true; // permanent mute
  return new Date(until).getTime() > Date.now();
}

export function canViewPost(
  post: Post,
  ctx: {
    isAdmin: boolean;
    viewerMemberIds: string[];
    viewerGroupIds: string[];
    viewerRoles: MemberRoleName[] | string[];
    viewerIsTrainerLike: boolean;
  },
): boolean {
  if (ctx.isAdmin) return true;
  if (post.is_hidden) return false;
  switch (post.visibility) {
    case "tenant":
      return true;
    case "trainers":
      return ctx.viewerIsTrainerLike;
    case "team":
      if (!post.target_id) return false;
      if (ctx.viewerGroupIds.includes(post.target_id)) return true;
      return ctx.viewerIsTrainerLike;
    case "private":
      if (!post.target_id) return false;
      return (
        ctx.viewerMemberIds.includes(post.target_id) ||
        (post.author_member_id !== null &&
          ctx.viewerMemberIds.includes(post.author_member_id))
      );
    default:
      return false;
  }
}
