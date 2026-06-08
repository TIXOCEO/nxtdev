import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { MessageSquare, Plus } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/tenants";
import { getUser } from "@/lib/auth/get-user";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { getMyMember, listConversationsForMember } from "@/lib/db/messages";
import {
  UserActionLink,
  UserEmptyState,
  UserReferenceHero,
  UserSectionHeader,
  UserStatusPill,
  UserSurface,
} from "@/components/public/user-shell-components";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MessagesInboxPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/messages`);

  const me = await getMyMember(tenant.id, user.id);
  if (!me) redirect(`/t/${slug}`);

  const rows = await listConversationsForMember(tenant.id, me.id);

  return (
    <PublicTenantShell tenant={tenant} active="messages" pageTitle="Berichten">
      <UserReferenceHero
        eyebrow="Inbox"
        title="Berichten"
        description="Gesprekken met de academie, trainers en beheerders op een rustige plek."
        action={
          <UserActionLink href={`/t/${slug}/messages/new`} icon={Plus}>
            Nieuw bericht
          </UserActionLink>
        }
      />

      <UserSectionHeader
        eyebrow="Inbox"
        title="Gesprekken"
        description={`${rows.length} gesprek${rows.length === 1 ? "" : "ken"} in je inbox.`}
        icon={MessageSquare}
      />

      {rows.length === 0 ? (
        <UserEmptyState
          icon={MessageSquare}
          title="Nog geen berichten"
          body="Start een nieuw gesprek met de knop hierboven."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((r) => {
              const others = r.participants
                .filter((p) => p.member_id !== me.id)
                .map((p) => p.full_name ?? "Onbekend")
                .join(", ");
              return (
                <UserSurface key={r.conversation.id} interactive>
                  <Link
                    href={`/t/${slug}/messages/${r.conversation.id}`}
                    className="nxt-focus-ring flex items-center gap-3 p-4 transition-colors hover:bg-white/50"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
                      style={{
                        borderColor: "var(--shell-border)",
                        backgroundColor: "color-mix(in srgb, var(--shell-info) 10%, var(--shell-panel-strong))",
                        color: "var(--shell-info)",
                      }}
                    >
                      <MessageSquare className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {r.conversation.title}
                      </p>
                      <p className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {others || "Alleen jij"}
                      </p>
                      {r.last_message && (
                        <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {r.last_message.body}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        {fmtDate(r.conversation.last_message_at)}
                      </span>
                      {r.unread_count > 0 && (
                        <UserStatusPill toneKey="danger">
                          {r.unread_count > 9 ? "9+" : r.unread_count}
                        </UserStatusPill>
                      )}
                    </div>
                  </Link>
                </UserSurface>
              );
            })}
        </div>
      )}
    </PublicTenantShell>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}
