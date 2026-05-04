import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Plus, MessageSquare } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/tenants";
import { getUser } from "@/lib/auth/get-user";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { getMyMember, listConversationsForMember } from "@/lib/db/messages";

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
      <div className="flex items-center justify-between gap-3">
        <h1
          className="text-lg font-bold sm:text-xl"
          style={{ color: "var(--text-primary)" }}
        >
          Berichten
        </h1>
        <Link
          href={`/t/${slug}/messages/new`}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Nieuw bericht
        </Link>
      </div>

      {rows.length === 0 ? (
        <div
          className="mt-4 flex flex-col items-center gap-2 rounded-2xl border px-4 py-10 text-center"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          <MessageSquare className="h-8 w-8" style={{ color: "var(--accent)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Nog geen berichten
          </p>
          <p className="text-xs">Start een nieuw gesprek met de knop hierboven.</p>
        </div>
      ) : (
        <ul
          className="mt-4 overflow-hidden rounded-2xl border"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          {rows.map((r) => {
            const others = r.participants
              .filter((p) => p.member_id !== me.id)
              .map((p) => p.full_name ?? "Onbekend")
              .join(", ");
            return (
              <li
                key={r.conversation.id}
                className="border-b last:border-b-0"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <Link
                  href={`/t/${slug}/messages/${r.conversation.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/5"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {r.conversation.title}
                    </p>
                    <p
                      className="truncate text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {others || "Alleen jij"}
                    </p>
                    {r.last_message && (
                      <p
                        className="mt-0.5 line-clamp-1 text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {r.last_message.body}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {fmtDate(r.conversation.last_message_at)}
                    </span>
                    {r.unread_count > 0 && (
                      <span
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none text-white"
                        style={{ backgroundColor: "#dc2626" }}
                      >
                        {r.unread_count > 9 ? "9+" : r.unread_count}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
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
