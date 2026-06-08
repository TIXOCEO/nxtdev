import { notFound, redirect } from "next/navigation";
import { GraduationCap, Layers, Search, Users } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isTrainer } from "@/lib/auth/user-role-rules";
import { listAthletesForTrainer } from "@/lib/db/trainer-athletes";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  TrainerCommandHero,
  TrainerEmptyState,
  TrainerListItem,
  TrainerStatusPill,
} from "@/components/public/trainer-shell-components";

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
    redirect(`/t/${slug}`);
  }

  const athletes = await listAthletesForTrainer(tenant.id, user.id);
  const groupCount = new Set(athletes.flatMap((a) => a.groups.map((g) => g.id))).size;

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Leerlingen" active="leerlingen">
      <div className="space-y-4">
        <TrainerCommandHero
          title="Leerlingen"
          description="Een rustige, snelle lijst van sporters uit jouw gekoppelde groepen."
          stats={[
            { label: "Leerlingen", value: String(athletes.length), icon: GraduationCap },
            { label: "Groepen", value: String(groupCount), icon: Layers },
            { label: "Dossiers", value: "Open", icon: Search },
          ]}
        />

        {athletes.length === 0 ? (
          <TrainerEmptyState
            icon={Users}
            title="Geen leerlingen"
            body="Je bent nog niet gekoppeld aan groepen met leerlingen."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {athletes.map((a) => (
              <TrainerListItem
                key={a.member_id}
                href={`/t/${slug}/members/${a.member_id}`}
                title={a.full_name}
                meta={a.email ?? "Geen e-mailadres"}
                icon={Users}
              >
                <div className="flex flex-wrap gap-1.5">
                  {a.groups.map((g) => (
                    <TrainerStatusPill key={g.id} toneKey="neutral">
                      {g.name}
                    </TrainerStatusPill>
                  ))}
                </div>
              </TrainerListItem>
            ))}
          </div>
        )}
      </div>
    </PublicTenantShell>
  );
}
