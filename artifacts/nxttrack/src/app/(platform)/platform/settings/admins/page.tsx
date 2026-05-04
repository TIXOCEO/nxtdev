import { ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { listPlatformAdmins } from "@/lib/db/platform-admins";
import { AddAdminForm } from "./_add-form";
import { RemoveAdminButton } from "./_remove-button";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function PlatformAdminsPage() {
  const me = await requirePlatformAdmin();
  const admins = await listPlatformAdmins();

  return (
    <>
      <PageHeading
        title="Platformbeheerders"
        description="Beheerders met volledige toegang tot het platform. Een gebruiker moet eerst zelf een account hebben aangemaakt voordat je hem als beheerder kunt toevoegen."
      />

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Nieuwe beheerder toevoegen
        </h2>
        <AddAdminForm />
      </section>

      <section className="space-y-3">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Huidige beheerders ({admins.length})
        </h2>

        {admins.length === 0 ? (
          <p
            className="rounded-2xl border p-6 text-center text-sm"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
              color: "var(--text-secondary)",
            }}
          >
            Geen platformbeheerders gevonden.
          </p>
        ) : (
          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
            }}
          >
            <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
              {admins.map((a) => {
                const isSelf = a.user_id === me.id;
                return (
                  <li
                    key={a.membership_id}
                    className="flex items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      <ShieldCheck
                        className="h-4 w-4"
                        style={{ color: "var(--text-primary)" }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {a.full_name || a.email}
                        {isSelf && (
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                            style={{
                              backgroundColor: "var(--surface-soft)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            jij
                          </span>
                        )}
                      </p>
                      <p
                        className="truncate text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {a.email} · sinds {formatDate(a.created_at)}
                      </p>
                    </div>
                    <RemoveAdminButton
                      membershipId={a.membership_id}
                      label={a.full_name || a.email}
                      disabled={isSelf}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
