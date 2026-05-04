import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getSocialModerationStats,
  listRecentPostsAdmin,
  listMutedMembers,
} from "@/lib/db/social";
import { ModerationManager } from "@/components/tenant/social/moderation-manager";

export const dynamic = "force-dynamic";

export default async function SocialModerationPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const tenantId = result.tenant.id;

  const [stats, posts, mutes] = await Promise.all([
    getSocialModerationStats(tenantId),
    listRecentPostsAdmin(tenantId, "all", 50),
    listMutedMembers(tenantId),
  ]);

  return (
    <>
      <PageHeading
        title="Social feed — moderatie"
        description="Verberg berichten of reacties en demp leden tijdelijk."
      />
      <ModerationManager
        tenantId={tenantId}
        stats={stats}
        posts={posts}
        mutes={mutes}
      />
    </>
  );
}
