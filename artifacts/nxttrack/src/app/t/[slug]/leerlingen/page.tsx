import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isTrainer } from "@/lib/auth/user-role-rules";
import { listAthletesForTrainer } from "@/lib/db/trainer-athletes";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function TrainerLeerlingenPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/leerlingen`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isTrainer(ctx)) {
    // Niet-trainers krijgen geen leerlingen-lijst; redirect naar home.
    redirect(`/t/${slug}`);
  }

  const athletes = await listAthletesForTrainer(tenant.id, user.id);

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Mijn leerlingen" active="leerlingen">
      <div className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Mijn leerlingen
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Unieke leerlingen uit de groepen waarin je traint.
          </p>
        </div>

        {athletes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Geen leerlingen"
            description="Je bent (nog) niet gekoppeld aan groepen met leerlingen."
          />
        ) : (
          <ul className="grid gap-2">
            {athletes.map((a) => (
              <li
                key={a.member_id}
                className="rounded-2xl border p-3"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.full_name}
                    </p>
                    {a.email && (
                      <p
                        className="text-[11px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {a.email}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {a.groups.map((g) => (
                      <span
                        key={g.id}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: "var(--surface-soft)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicTenantShell>
  );
}
