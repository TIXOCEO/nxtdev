import Link from "next/link";
import { UserRound } from "lucide-react";
import type { Tenant } from "@/types/database";
import { PublicMobileNav } from "./public-mobile-nav";
import type { PublicNavKey } from "./public-sidebar";
import { NotificationBell, type BellItem } from "./notification-bell";
import { MessagesBell } from "./messages-bell";
import { ProfileMenu } from "./profile-menu";
import { getUser } from "@/lib/auth/get-user";
import { getMemberships } from "@/lib/auth/get-memberships";
import { hasTenantAccess } from "@/lib/permissions";
import { getMyNotifications } from "@/lib/db/notifications";

export interface PublicHeaderProps {
  tenant: Tenant;
  pageTitle: string;
  active?: PublicNavKey;
  /** Sprint 13. */
  isAuthenticated?: boolean;
  showKinderen?: boolean;
  showGroepen?: boolean;
  /** Sprint 14: precomputed by the shell so we don't double-query. */
  unreadCount?: number;
  /** Sprint 15: forwarded to the mobile drawer. */
  customPages?: import("@/lib/db/custom-pages").CustomPageNode[];
  customActivePath?: string;
  /** Sprint 17 — unread messages badge in the header bell. */
  messagesUnread?: number;
}

export async function PublicHeader({
  tenant,
  pageTitle,
  active,
  isAuthenticated,
  showKinderen,
  showGroepen,
  unreadCount,
  customPages,
  customActivePath,
  messagesUnread = 0,
}: PublicHeaderProps) {
  const slug = tenant.slug;

  let user = null;
  let bellItems: BellItem[] = [];
  let unread = unreadCount ?? 0;
  let isAdmin = false;
  if (isAuthenticated) {
    user = await getUser();
    if (user) {
      const [rows, memberships] = await Promise.all([
        getMyNotifications(20),
        getMemberships(user.id),
      ]);
      isAdmin = hasTenantAccess(memberships, tenant.id);
      const tenantRows = rows.filter((r) => r.notification.tenant_id === tenant.id);
      if (unreadCount === undefined) {
        unread = tenantRows.filter((r) => !r.is_read).length;
      }
      bellItems = tenantRows.slice(0, 3).map((r) => ({
        id: r.recipient_id,
        title: r.notification.title,
        is_read: r.is_read,
        created_at: r.created_at,
      }));
    }
  }

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-5"
      style={{
        backgroundColor: "var(--bg-nav)",
        borderColor: "var(--surface-border)",
      }}
    >
      <PublicMobileNav
        tenant={tenant}
        active={active}
        isAuthenticated={isAuthenticated}
        showKinderen={showKinderen}
        showGroepen={showGroepen}
        unreadCount={unread}
        customPages={customPages}
        customActivePath={customActivePath}
      />
      <p
        className="min-w-0 flex-1 truncate text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        <span>{tenant.name}</span>
        <span className="mx-2" style={{ color: "var(--text-secondary)" }}>
          &mdash;
        </span>
        <span style={{ color: "var(--text-secondary)" }}>{pageTitle}</span>
      </p>
      <div className="flex items-center gap-1">
        {isAuthenticated && user ? (
          <>
            {isAdmin && (
              <Link
                href={`/tenant?tenant=${tenant.id}`}
                className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold sm:inline-flex"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                Admin
              </Link>
            )}
            <MessagesBell slug={slug} unreadCount={messagesUnread} />
            <NotificationBell slug={slug} unreadCount={unread} items={bellItems} />
            <ProfileMenu
              slug={slug}
              email={user.email ?? null}
              isAdmin={isAdmin}
              tenantId={tenant.id}
            />
          </>
        ) : (
          <Link
            href={`/t/${slug}/login`}
            aria-label="Inloggen"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
            style={{ color: "var(--text-secondary)" }}
          >
            <UserRound className="h-4 w-4" />
          </Link>
        )}
      </div>
    </header>
  );
}
