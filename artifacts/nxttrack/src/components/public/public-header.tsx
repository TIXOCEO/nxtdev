import Link from "next/link";
import { ChevronRight, Home, LogIn } from "lucide-react";
import type { Tenant } from "@/types/database";
import { PublicMobileNav } from "./public-mobile-nav";
import type { PublicNavKey } from "./public-sidebar";
import { NotificationBell, type BellItem } from "./notification-bell";
import { MessagesBell } from "./messages-bell";
import { ProfileMenu } from "./profile-menu";
import { AdminHandoffButton } from "./admin-handoff-button";
import { getUser } from "@/lib/auth/get-user";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import { getMyNotifications } from "@/lib/db/notifications";

export interface PublicHeaderProps {
  tenant: Tenant;
  pageTitle: string;
  active?: PublicNavKey | PublicNavKey[];
  /** Sprint 13. */
  isAuthenticated?: boolean;
  showKinderen?: boolean;
  showGroepen?: boolean;
  /** Sprint 63 — Toont alleen wanneer tenant ≥1 publiek programma heeft. */
  showProgrammas?: boolean;
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
  showProgrammas,
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
      const [rows, memberships, adminRoleTenants] = await Promise.all([
        getMyNotifications(20),
        getMemberships(user.id),
        getAdminRoleTenantIds(user.id),
      ]);
      isAdmin = hasTenantAccess(memberships, tenant.id, adminRoleTenants);
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
      className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <PublicMobileNav
        tenant={tenant}
        active={active}
        isAuthenticated={isAuthenticated}
        showKinderen={showKinderen}
        showGroepen={showGroepen}
        showProgrammas={showProgrammas}
        unreadCount={unread}
        customPages={customPages}
        customActivePath={customActivePath}
      />
      <nav
        aria-label="Breadcrumb"
        className="min-w-0 flex-1"
        style={{ color: "var(--text-secondary)" }}
      >
        <ol className="flex items-center gap-2 text-sm font-medium">
          <li className="flex items-center gap-2">
            <Link
              href={`/t/${slug}`}
              aria-label="Home"
              className="inline-flex items-center transition-opacity hover:opacity-80"
            >
              <Home className="h-4 w-4 shrink-0" />
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </li>
          <li className="min-w-0">
            <span
              className="truncate font-semibold"
              style={{ color: "var(--text-primary)" }}
              aria-current="page"
            >
              {pageTitle}
            </span>
          </li>
        </ol>
      </nav>
      <div className="flex items-center gap-1">
        {isAuthenticated && user ? (
          <>
            {isAdmin && (
              <AdminHandoffButton tenantId={tenant.id} next="/tenant" />
            )}
            <MessagesBell slug={slug} unreadCount={messagesUnread} />
            <NotificationBell slug={slug} unreadCount={unread} items={bellItems} />
            <ProfileMenu
              slug={slug}
              email={user.email ?? null}
              isAdmin={isAdmin}
              tenantId={tenant.id}
              tenantDomain={tenant.domain}
            />
          </>
        ) : (
          <Link
            href={`/t/${slug}/login`}
            aria-label="Inloggen"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5"
            style={{ color: "var(--text-primary)" }}
          >
            <LogIn
              className="h-4 w-4"
              style={{ color: "var(--tenant-accent)" }}
            />
            <span className="hidden sm:inline">Inloggen</span>
          </Link>
        )}
      </div>
    </header>
  );
}
