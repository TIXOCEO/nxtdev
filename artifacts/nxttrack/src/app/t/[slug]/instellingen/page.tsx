import { notFound, redirect } from "next/navigation";
import { Mail, BellRing, Info, Palette } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getNotificationEventsByTenant } from "@/lib/db/notifications";
import { getMyNotificationPrefs } from "@/lib/db/notification-prefs";
import { getUserThemePreference } from "@/lib/db/themes";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { ThemeModePicker } from "@/components/public/theme-mode-picker";
import {
  DEFAULT_USER_VISIBLE_EVENTS,
  labelFor,
} from "@/lib/notifications/event-labels";
import { PrefToggle } from "./_pref-toggle";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function PublicSettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();
  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/instellingen`);

  const [events, prefs, themePref] = await Promise.all([
    getNotificationEventsByTenant(tenant.id),
    getMyNotificationPrefs(tenant.id),
    getUserThemePreference(user.id, tenant.id),
  ]);
  const initialMode: "auto" | "light" | "dark" = themePref?.mode_preference ?? "light";

  const tenantKeys = Array.from(new Set(events.map((e) => e.event_key)));
  const eventKeys = tenantKeys.length > 0 ? tenantKeys : DEFAULT_USER_VISIBLE_EVENTS;
  const sortedKeys = [...eventKeys].sort((a, b) => labelFor(a).label.localeCompare(labelFor(b).label));

  function isEnabled(eventKey: string, channel: "email" | "push"): boolean {
    const row = prefs.find((p) => p.event_key === eventKey && p.channel === channel);
    return row ? row.enabled : true; // default ON
  }

  return (
    <PublicTenantShell
      tenant={tenant}
      pageTitle="Mijn instellingen"
      active="instellingen"
    >
      <div className="space-y-6">
        <section
          className="rounded-2xl border p-4 sm:p-5"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--surface-soft)" }}
            >
              <Palette className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Weergave
              </h2>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Kies tussen licht, donker, of laat het volgen aan je apparaat.
              </p>
              <div className="mt-3">
                <ThemeModePicker
                  tenantId={tenant.id}
                  slug={slug}
                  initialMode={initialMode}
                />
              </div>
            </div>
          </div>
        </section>

        <header>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Berichtinstellingen
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Kies welke berichten je per e-mail of als pushmelding wilt ontvangen
            van {tenant.name}. Je kunt dit altijd aanpassen.
          </p>
        </header>

        <div
          className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Pushmeldingen werken pas als je ze in je profiel ook hebt
            toegestaan. Per type bericht kun je e-mail en push los aan- of
            uitzetten.
          </p>
        </div>

        <section
          className="overflow-hidden rounded-2xl border"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          {/* Header row (desktop only) */}
          <div
            className="hidden grid-cols-[1fr_auto_auto] items-center gap-4 border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wide sm:grid"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-secondary)",
              backgroundColor: "var(--surface-soft)",
            }}
          >
            <span>Type bericht</span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> E-mail
            </span>
            <span className="flex items-center gap-1">
              <BellRing className="h-3 w-3" /> Push
            </span>
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {sortedKeys.map((key) => {
              const lbl = labelFor(key);
              return (
                <li
                  key={key}
                  className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6 sm:py-3.5"
                >
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {lbl.label}
                    </p>
                    {lbl.description && (
                      <p
                        className="mt-0.5 text-[11px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {lbl.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 sm:contents">
                    <label className="flex items-center gap-2 text-[11px] sm:gap-1.5 sm:justify-self-center">
                      <span
                        className="sm:hidden"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        E-mail
                      </span>
                      <PrefToggle
                        tenantId={tenant.id}
                        slug={slug}
                        eventKey={key}
                        channel="email"
                        initial={isEnabled(key, "email")}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-[11px] sm:gap-1.5 sm:justify-self-center">
                      <span
                        className="sm:hidden"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Push
                      </span>
                      <PrefToggle
                        tenantId={tenant.id}
                        slug={slug}
                        eventKey={key}
                        channel="push"
                        initial={isEnabled(key, "push")}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Wijzigingen worden meteen opgeslagen.
        </p>
      </div>
    </PublicTenantShell>
  );
}
