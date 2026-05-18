import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isTrainer } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PageHeader } from "@/components/public/page-header";
import { listTrainerTasksForUser } from "@/lib/db/trainer-tasks";
import { TrainerTaskList } from "./_task-list";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  return { title: `${tenant.name} | Taken` };
}

export default async function TakenPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/taken`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isTrainer(ctx)) redirect(`/t/${slug}`);

  const tasks = await listTrainerTasksForUser(tenant.id, user.id);

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Taken" active="taken">
      <PageHeader
        title="Mijn taken"
        description="Taken die aan jou zijn toegewezen. Vink af zodra ze klaar zijn."
      />
      {tasks.length === 0 ? (
        <PublicCard className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--accent-tint)", color: "var(--brand-navy)" }}
            >
              <CheckSquare className="h-7 w-7" />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Geen taken
            </h2>
            <p className="max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
              Wanneer een beheerder of jij een taak toevoegt verschijnt die hier.
            </p>
          </div>
        </PublicCard>
      ) : (
        <TrainerTaskList tenantId={tenant.id} tasks={tasks} />
      )}
    </PublicTenantShell>
  );
}
