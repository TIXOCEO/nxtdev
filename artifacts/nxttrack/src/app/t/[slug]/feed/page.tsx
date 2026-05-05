import { notFound, redirect } from "next/navigation";
import { Rss } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/tenants";
import { getUser } from "@/lib/auth/get-user";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  getFeedPosts,
  getSocialSettings,
  getAllowedPostTargets,
  getMyMemberId,
} from "@/lib/db/social";
import {
  getUserTenantContext,
  isMinorAthlete,
} from "@/lib/auth/user-role-rules";
import { hasTenantAccess } from "@/lib/permissions";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import {
  canPostToSocial,
  canCoachBroadcast,
  isMemberMuted,
} from "@/lib/permissions/social";
import { createAdminClient } from "@/lib/supabase/admin";
import { PostCard } from "@/components/public/feed/post-card";
import { PostComposer } from "@/components/public/feed/post-composer";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function FeedPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/feed`);

  const settings = await getSocialSettings(tenant.id);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  const [memberships, adminRoleTenantIds] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const isAdmin = hasTenantAccess(memberships, tenant.id, adminRoleTenantIds);
  const memberId = ctx.members[0]?.id ?? null;

  let isLinkedAsChild = false;
  if (memberId) {
    const admin = createAdminClient();
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

  const canPost = canPostToSocial(settings, { isAdmin, isMinor, isMuted });
  const canBroadcast = isAdmin || canCoachBroadcast(ctx.roles);

  const targets = canPost
    ? await getAllowedPostTargets(tenant.id, memberId ? [memberId] : [])
    : { groups: [], members: [] };

  const { items } = await getFeedPosts({
    tenantId: tenant.id,
    userId: user.id,
    limit: 30,
    filter: "all",
  });

  return (
    <PublicTenantShell tenant={tenant} active="feed" pageTitle="Feed">
      <div className="space-y-4">
        <header className="flex items-center gap-2">
          <Rss className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <h1
            className="text-lg font-bold sm:text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            Feed
          </h1>
        </header>

        {isMuted && (
          <div
            className="rounded-2xl border px-4 py-3 text-xs"
            style={{
              backgroundColor: "rgba(220,38,38,0.08)",
              borderColor: "rgba(220,38,38,0.3)",
              color: "#dc2626",
            }}
          >
            Je account is tijdelijk gedempt door een beheerder.
          </div>
        )}

        {canPost && (
          <PostComposer
            tenantId={tenant.id}
            groups={targets.groups}
            members={targets.members}
            canCoachBroadcast={canBroadcast}
            allowMedia={settings.allow_media}
          />
        )}

        {items.length === 0 ? (
          <div
            className="rounded-2xl border px-4 py-10 text-center text-sm"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
              color: "var(--text-secondary)",
            }}
          >
            Nog geen berichten in de feed.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.post.id}>
                <PostCard
                  tenantId={tenant.id}
                  tenantSlug={slug}
                  data={it}
                  canModify={
                    isAdmin ||
                    (memberId !== null &&
                      it.post.author_member_id === memberId)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicTenantShell>
  );
}
