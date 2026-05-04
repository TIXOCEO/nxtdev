import { redirect, notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/db/tenants";
import { getUser } from "@/lib/auth/get-user";
import { getMemberships } from "@/lib/auth/get-memberships";
import { hasTenantAccess } from "@/lib/permissions";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  getConversationDetail,
  getMyMember,
  isParticipant,
} from "@/lib/db/messages";
import { markConversationRead } from "@/lib/actions/tenant/messages";
import { Thread } from "./_thread";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { slug, id } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/messages/${id}`);

  const me = await getMyMember(tenant.id, user.id);
  if (!me) redirect(`/t/${slug}`);

  const memberships = await getMemberships(user.id);
  const isAdmin = hasTenantAccess(memberships, tenant.id);

  const detail = await getConversationDetail(id, tenant.id);
  if (!detail) notFound();

  const part = await isParticipant(id, me.id);
  if (!part && !isAdmin) redirect(`/t/${slug}/messages`);

  // Best-effort mark-read.
  await markConversationRead({ tenant_id: tenant.id, conversation_id: id });

  const others = detail.participants
    .filter((p) => p.member_id !== me.id)
    .map((p) => p.full_name ?? "Onbekend")
    .join(", ");

  return (
    <PublicTenantShell tenant={tenant} active="messages" pageTitle={detail.conversation.title}>
      <Link
        href={`/t/${slug}/messages`}
        className="inline-flex items-center gap-1 text-xs font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Terug
      </Link>
      <div
        className="mt-2 rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h1
          className="text-base font-bold sm:text-lg"
          style={{ color: "var(--text-primary)" }}
        >
          {detail.conversation.title}
        </h1>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {others || "Alleen jij"}
        </p>
      </div>

      <Thread
        tenantId={tenant.id}
        slug={slug}
        conversationId={id}
        myMemberId={me.id}
        initialMessages={detail.messages.map((m) => ({
          id: m.id,
          body: m.body,
          created_at: m.created_at,
          sender_member_id: m.sender_member_id,
          sender_name:
            detail.participants.find((p) => p.member_id === m.sender_member_id)?.full_name ??
            "Onbekend",
        }))}
      />
    </PublicTenantShell>
  );
}
