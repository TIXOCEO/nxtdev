import Link from "next/link";
import { ChevronDown, LogIn, Search } from "lucide-react";
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
      className="nxt-public-header flex h-[68px] shrink-0 items-center gap-3 border-b px-3 backdrop-blur-md sm:px-5"
      style={{
        backgroundColor: "color-mix(in srgb, var(--shell-panel-strong) 86%, transparent)",
        borderColor: "var(--shell-border)",
      }}
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
      <div className="min-w-0 flex-1">
        <p className="hidden text-[11px] font-semibold sm:block" style={{ color: "var(--text-secondary)" }}>
          {tenant.name}
        </p>
        <h1 className="truncate text-base font-bold tracking-tight sm:text-lg" style={{ color: "var(--text-primary)" }}>
          {pageTitle}
        </h1>
      </div>
      {isAuthenticated ? (
        <button
          type="button"
          className="nxt-focus-ring hidden min-w-[220px] items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-xs font-semibold md:inline-flex"
          style={{
            borderColor: "var(--shell-border)",
            backgroundColor: "var(--shell-panel-muted)",
            color: "var(--text-primary)",
          }}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--shell-info)" }} />
            <span className="truncate">Zoek lessen, berichten...</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
        </button>
      ) : null}
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
            className="nxt-focus-ring nxt-shell-primary-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Inloggen</span>
          </Link>
        )}
      </div>
    </header>
  );
}
