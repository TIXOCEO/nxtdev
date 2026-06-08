import type { CSSProperties } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { TenantLoginForm } from "./_form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function TenantLoginPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const accent = /^#[0-9a-fA-F]{6}$/.test(tenant.primary_color)
    ? tenant.primary_color
    : "#b6d83b";

  return (
    <div
      className="fixed inset-0 overflow-y-auto p-4 sm:p-6"
      style={
        {
          "--tenant-accent": accent,
          background:
            "radial-gradient(circle at 16% 8%, color-mix(in srgb, var(--tenant-accent) 18%, transparent), transparent 30%), linear-gradient(135deg, var(--bg-viewport-start), var(--bg-viewport-end))",
        } as CSSProperties
      }
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center">
        <div className="grid w-full gap-5 lg:grid-cols-[1fr_420px]">
          <section className="hidden min-h-[520px] flex-col justify-between rounded-lg border p-8 lg:flex" style={{ backgroundColor: "var(--shell-panel-bg)", borderColor: "var(--shell-border)", boxShadow: "var(--shell-shadow-soft)" }}>
            <div>
              <div className="flex items-center gap-3">
                <TenantLogo name={tenant.name} logoUrl={tenant.logo_url} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {tenant.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Trainer- en ledenportaal
                  </p>
                </div>
              </div>
              <div className="mt-16 max-w-xl">
                <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-secondary)" }}>
                  NXTTRACK shell
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Klaar voor de lesvloer.
                </h1>
                <p className="mt-4 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
                  Log in voor aanwezigheid, leerlingdossiers, acties en berichten in een rustige werkomgeving die meebeweegt met de tenantstijl.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <LoginFeature icon={CalendarCheck} label="Planning" />
              <LoginFeature icon={Users} label="Leerlingen" />
              <LoginFeature icon={ShieldCheck} label="Veilig portaal" />
            </div>
          </section>

          <section className="flex flex-col justify-center rounded-lg border p-5 sm:p-8" style={{ backgroundColor: "var(--shell-panel-bg)", borderColor: "var(--shell-border)", boxShadow: "var(--shell-shadow-soft)" }}>
            <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <TenantLogo name={tenant.name} logoUrl={tenant.logo_url} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-secondary)" }}>
                    Portaal
                  </p>
                  <h1 className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                    Inloggen bij {tenant.name}
                  </h1>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Gebruik je e-mail en wachtwoord.
                  </p>
                </div>
              </div>

              <Suspense fallback={null}>
                <TenantLoginForm slug={slug} />
              </Suspense>

              <Link
                href={`/t/${slug}`}
                className="nxt-focus-ring inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                <ArrowLeft className="h-3 w-3" /> Doorgaan zonder inloggen
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TenantLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div
      className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border"
      style={{
        borderColor: "var(--shell-border)",
        backgroundColor: "var(--surface-main)",
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-lg font-bold" style={{ color: "var(--tenant-accent)" }}>
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function LoginFeature({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div
      className="rounded-md border p-3"
      style={{
        backgroundColor: "var(--shell-panel-muted)",
        borderColor: "var(--shell-border)",
      }}
    >
      <Icon className="h-5 w-5" style={{ color: "var(--brand-navy)" }} />
      <p className="mt-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {label}
      </p>
    </div>
  );
}
