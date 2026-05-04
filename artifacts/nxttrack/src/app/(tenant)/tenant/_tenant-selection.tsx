import { Building2, ShieldCheck } from "lucide-react";
import { selectActiveTenant } from "@/lib/actions/tenant/select";
import type { Tenant } from "@/types/database";

export interface TenantSelectionProps {
  tenants: Tenant[];
}

export function TenantSelection({ tenants }: TenantSelectionProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          "linear-gradient(180deg, var(--bg-viewport-start) 0%, var(--bg-viewport-end) 100%)",
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border p-6 shadow-sm sm:p-8"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Platform admin
          </span>
        </div>
        <h1 className="text-xl font-semibold sm:text-2xl" style={{ color: "var(--text-primary)" }}>
          Select a tenant to manage
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          You're a platform admin. Choose a tenant to enter its admin workspace.
          Your selection is remembered until you change it.
        </p>

        {tenants.length === 0 ? (
          <p className="mt-6 text-sm" style={{ color: "var(--text-secondary)" }}>
            No tenants exist yet. Create one from the platform dashboard.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {tenants.map((t) => (
              <li key={t.id}>
                <form action={selectActiveTenant}>
                  <input type="hidden" name="tenant_id" value={t.id} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-black/5"
                    style={{ borderColor: "var(--surface-border)" }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                        style={{ backgroundColor: t.primary_color || "var(--surface-soft)" }}
                      >
                        {t.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Building2 className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {t.name}
                        </p>
                        <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                          /{t.slug}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Enter →
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
