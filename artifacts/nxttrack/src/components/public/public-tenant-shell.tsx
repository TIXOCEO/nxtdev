import type { ReactNode, CSSProperties } from "react";
import { cookies } from "next/headers";
import type { Tenant } from "@/types/database";
import { getUser } from "@/lib/auth/get-user";
import {
  getUserTenantContext,
  isAthlete,
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
import { countPublicMarketplacePrograms } from "@/lib/db/programs-public";
import { PublicSidebar, type PublicNavKey } from "./public-sidebar";
import { SocialBar } from "./social-bar";
import { PublicPageFooter } from "./public-page-footer";
import { getMyMember, getMessagesUnreadCount } from "@/lib/db/messages";
import { PublicHeader } from "./public-header";
import { PublicBottomTabBar } from "./public-bottom-tab-bar";
import { ThemeStyleInjector } from "./theme-style-injector";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { MobileLoginPrompt } from "./mobile-login-prompt";
import { WhatsNewBanner } from "./whats-new-banner";

const WHATS_NEW_VERSION = "0.35.0";

const FALLBACK_ACCENT = "#b6d83b";

type Mode = "auto" | "light" | "dark";

function isSafeHexColor(value: string | null | undefined): boolean {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
}

export interface PublicTenantShellProps {
  tenant: Tenant;
  pageTitle: string;
  active?: PublicNavKey | PublicNavKey[];
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
    // Sprint 81 — toon de "Mijn sport"-sectie ook voor athletes-zonder-parent,
    // niet alleen voor ouders met member_links.
    showKinderen = isParent(ctx) || isAthlete(ctx);
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
  // Sprint 63 — `publicProgramCount` bepaalt of de "Programma's"-link in
  // de sidebar/header verschijnt; voor Houtrust (0 publieke programma's)
  // blijft de nav dus identiek aan vóór deze sprint.
  const [lightTheme, darkTheme, customRows, publicProgramCount] = await Promise.all([
    resolveActiveTheme(tenant.id, user?.id ?? null, "light"),
    resolveActiveTheme(tenant.id, user?.id ?? null, "dark"),
    listEnabledCustomPages(tenant.id),
    countPublicMarketplacePrograms(tenant.id),
  ]);
  const showProgrammas = publicProgramCount > 0;

  // Custom pages: hide auth-required pages when not logged in.
  const visibleCustomRows = customRows.filter((p) =>
    !p.requires_auth || !!user,
  );
  const customTree: CustomPageNode[] = buildPageTree(visibleCustomRows);

  // Sprint 78b — Sidebar/page-bg afgeleid van de tenant-accent zodat
  // élke tenant een zachte, on-brand cream-tint krijgt (mockup-stijl).
  // Voor mint-accent → zachte mint-cream; voor blauw-accent → ijsblauw; etc.
  const wrapperStyle = {
    "--tenant-accent": accent,
    "--sidebar-bg": `color-mix(in srgb, ${accent} 12%, var(--surface-main))`,
    "--page-bg": `color-mix(in srgb, ${accent} 4%, var(--surface-main))`,
    "--shell-page-bg": `color-mix(in srgb, ${accent} 5%, #f8fafc)`,
    "--shell-panel-bg": `color-mix(in srgb, ${accent} 3%, rgba(255,255,255,0.94))`,
    background:
      "radial-gradient(circle at 16% 8%, color-mix(in srgb, var(--tenant-accent) 16%, transparent), transparent 30%), linear-gradient(180deg, var(--bg-viewport-start) 0%, var(--bg-viewport-end) 100%)",
  } as CSSProperties;

  const themeClass =
    mode === "dark" ? "theme-dark" : mode === "light" ? "theme-light" : "theme-auto";

  return (
    <div className={`nxt-public-shell-root fixed inset-0 ${themeClass}`} style={wrapperStyle}>
      <ThemeStyleInjector light={lightTheme.tokens} dark={darkTheme.tokens} />
      <ServiceWorkerRegister />
      {!user && <MobileLoginPrompt slug={tenant.slug} tenantName={tenant.name} />}
      <div
        className="nxt-public-shell-pad flex h-full w-full overflow-hidden"
        style={{
          padding:
            "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
        }}
      >
        <div
          className="nxt-public-shell-frame flex h-full w-full overflow-hidden rounded-[var(--radius-nxt-xl)] border"
          style={{
            backgroundColor: "var(--shell-frame-bg)",
            borderColor: "var(--shell-border)",
            boxShadow: "var(--shadow-app)",
          }}
        >
          <div className="nxt-public-desktop-sidebar hidden md:flex md:w-[264px] md:shrink-0">
            <PublicSidebar
              tenant={tenant}
              active={active}
              isAuthenticated={!!user}
              showKinderen={showKinderen}
              showGroepen={showGroepen}
              showProgrammas={showProgrammas}
              unreadCount={unreadCount}
              messagesUnread={messagesUnread}
              customPages={customTree}
              customActivePath={customActivePath}
              socialBar={<SocialBar tenantId={tenant.id} />}
            />
          </div>
          <div className="nxt-public-shell-content flex min-w-0 flex-1 flex-col">
            <PublicHeader
              tenant={tenant}
              pageTitle={pageTitle}
              active={active}
              isAuthenticated={!!user}
              showKinderen={showKinderen}
              showGroepen={showGroepen}
              showProgrammas={showProgrammas}
              unreadCount={unreadCount}
              messagesUnread={messagesUnread}
              customPages={customTree}
              customActivePath={customActivePath}
            />
            <main
              className="nxt-public-main nxt-scrollbar flex-1 overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8"
              style={{
                background:
                  "linear-gradient(180deg, var(--shell-page-bg), var(--page-bg))",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
              }}
            >
              <div className="nxt-public-main-inner mx-auto w-full max-w-7xl space-y-6">
                {user && (
                  <WhatsNewBanner
                    slug={tenant.slug}
                    version={WHATS_NEW_VERSION}
                    userId={user.id}
                  />
                )}
                {children}
                <PublicPageFooter tenantId={tenant.id} tenantName={tenant.name} />
              </div>
            </main>
            <PublicBottomTabBar
              slug={tenant.slug}
              active={
                Array.isArray(active)
                  ? ((active.find((k) =>
                      ["home", "lessen", "voortgang", "diplomas", "nieuws", "agenda", "profile", "notifications", "messages"].includes(k),
                    ) ?? active[0]) as PublicNavKey)
                  : active
              }
              isAuthenticated={!!user}
              unreadCount={unreadCount}
              messagesUnread={messagesUnread}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
