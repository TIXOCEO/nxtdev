import type { ReactNode, CSSProperties } from "react";
import { cookies } from "next/headers";
import type { Tenant } from "@/types/database";
import { getUser } from "@/lib/auth/get-user";
import {
  getUserTenantContext,
  isParent,
  isTrainer,
} from "@/lib/auth/user-role-rules";
import { getMyNotifications } from "@/lib/db/notifications";
import {
  getUserThemePreference,
  resolveActiveTheme,
} from "@/lib/db/themes";
import {
  listEnabledCustomPages,
  buildPageTree,
  type CustomPageNode,
} from "@/lib/db/custom-pages";
import { PublicSidebar, type PublicNavKey } from "./public-sidebar";
import { SocialBar } from "./social-bar";
import { getMyMember, getMessagesUnreadCount } from "@/lib/db/messages";
import { PublicHeader } from "./public-header";
import { ThemeStyleInjector } from "./theme-style-injector";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { MobileLoginPrompt } from "./mobile-login-prompt";

const FALLBACK_ACCENT = "#b6d83b";

type Mode = "auto" | "light" | "dark";

function isSafeHexColor(value: string | null | undefined): boolean {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
}

export interface PublicTenantShellProps {
  tenant: Tenant;
  pageTitle: string;
  active?: PublicNavKey;
  /** When true, the active nav highlight is suppressed (used for custom pages). */
  customActivePath?: string;
  children: ReactNode;
}

export async function PublicTenantShell({
  tenant,
  pageTitle,
  active,
  customActivePath,
  children,
}: PublicTenantShellProps) {
  const accent = isSafeHexColor(tenant.primary_color)
    ? tenant.primary_color
    : FALLBACK_ACCENT;

  const cookieStore = await cookies();
  const cookieMode =
    (cookieStore.get(`nxt-mode-${tenant.slug}`)?.value as Mode | undefined) ??
    (cookieStore.get("nxt-mode")?.value as Mode | undefined);

  const user = await getUser();
  let showKinderen = false;
  let showGroepen = false;
  let unreadCount = 0;
  let messagesUnread = 0;
  // Default = light for everyone. Users can opt-in to dark or auto via the picker.
  let mode: Mode =
    cookieMode === "light" || cookieMode === "dark" || cookieMode === "auto"
      ? cookieMode
      : "light";

  if (user) {
    const [ctx, rows, pref, myMember] = await Promise.all([
      getUserTenantContext(tenant.id, user.id),
      getMyNotifications(50),
      getUserThemePreference(user.id, tenant.id),
      getMyMember(tenant.id, user.id),
    ]);
    showKinderen = isParent(ctx);
    showGroepen = isTrainer(ctx);
    unreadCount = rows.filter(
      (r) => r.notification.tenant_id === tenant.id && !r.is_read,
    ).length;
    if (pref?.mode_preference) {
      mode = pref.mode_preference;
    }
    if (myMember) {
      messagesUnread = await getMessagesUnreadCount(tenant.id, myMember.id);
    }
  }

  // Resolve themes for both modes so the toggle works without a refetch.
  const [lightTheme, darkTheme, customRows] = await Promise.all([
    resolveActiveTheme(tenant.id, user?.id ?? null, "light"),
    resolveActiveTheme(tenant.id, user?.id ?? null, "dark"),
    listEnabledCustomPages(tenant.id),
  ]);

  // Custom pages: hide auth-required pages when not logged in.
  const visibleCustomRows = customRows.filter((p) =>
    !p.requires_auth || !!user,
  );
  const customTree: CustomPageNode[] = buildPageTree(visibleCustomRows);

  const wrapperStyle = {
    "--tenant-accent": accent,
    background:
      "linear-gradient(180deg, var(--bg-viewport-start) 0%, var(--bg-viewport-end) 100%)",
  } as CSSProperties;

  const themeClass =
    mode === "dark" ? "theme-dark" : mode === "light" ? "theme-light" : "theme-auto";

  return (
    <div className={`fixed inset-0 ${themeClass}`} style={wrapperStyle}>
      <ThemeStyleInjector light={lightTheme.tokens} dark={darkTheme.tokens} />
      <ServiceWorkerRegister />
      {!user && <MobileLoginPrompt slug={tenant.slug} tenantName={tenant.name} />}
      <div
        className="flex h-full w-full overflow-hidden"
        style={{
          padding:
            "max(1vmin, env(safe-area-inset-top)) max(1vmin, env(safe-area-inset-right)) max(1vmin, env(safe-area-inset-bottom)) max(1vmin, env(safe-area-inset-left))",
        }}
      >
        <div
          className="flex h-full w-full overflow-hidden rounded-[var(--radius-nxt-xl)] border"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
            boxShadow: "var(--shadow-app)",
          }}
        >
          <div className="hidden md:flex md:w-[240px] md:shrink-0">
            <PublicSidebar
              tenant={tenant}
              active={active}
              isAuthenticated={!!user}
              showKinderen={showKinderen}
              showGroepen={showGroepen}
              unreadCount={unreadCount}
              messagesUnread={messagesUnread}
              customPages={customTree}
              customActivePath={customActivePath}
              socialBar={<SocialBar tenantId={tenant.id} />}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <PublicHeader
              tenant={tenant}
              pageTitle={pageTitle}
              active={active}
              isAuthenticated={!!user}
              showKinderen={showKinderen}
              showGroepen={showGroepen}
              unreadCount={unreadCount}
              messagesUnread={messagesUnread}
              customPages={customTree}
              customActivePath={customActivePath}
            />
            <main
              className="flex-1 overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4rem)" }}
            >
              <div className="mx-auto w-full max-w-5xl space-y-6">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
