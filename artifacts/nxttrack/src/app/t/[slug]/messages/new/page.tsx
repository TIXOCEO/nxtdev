import { redirect, notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/tenants";
import { getUser } from "@/lib/auth/get-user";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  getMessagingSide,
  getMyMember,
  listMessageRecipients,
} from "@/lib/db/messages";
import { ComposeForm } from "./_compose";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewMessagePage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/messages/new`);

  const me = await getMyMember(tenant.id, user.id);
  if (!me) redirect(`/t/${slug}`);

  const [memberships, adminRoleTenantIds] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const isAdmin = hasTenantAccess(memberships, tenant.id, adminRoleTenantIds);
  const side = await getMessagingSide(tenant.id, me, isAdmin);
  const recipients = await listMessageRecipients(tenant.id, side, me.id);

  return (
    <PublicTenantShell tenant={tenant} active="messages" pageTitle="Nieuw bericht">
      <h1
        className="text-lg font-bold sm:text-xl"
        style={{ color: "var(--text-primary)" }}
      >
        Nieuw bericht
      </h1>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {side === "parent"
          ? "Je kan alleen trainers en beheerders berichten. Selecteer één of meerdere ontvangers (groepsgesprek)."
          : "Selecteer één of meerdere ontvangers."}
      </p>
      <div className="mt-4">
        <ComposeForm
          tenantId={tenant.id}
          slug={slug}
          recipients={recipients}
          allowMulti={true}
        />
      </div>
    </PublicTenantShell>
  );
}
