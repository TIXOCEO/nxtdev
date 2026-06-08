import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, CheckSquare, Flame, ListTodo } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isTrainer } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  TrainerCommandHero,
  TrainerEmptyState,
} from "@/components/public/trainer-shell-components";
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
  const openTasks = tasks.filter((t) => t.status === "open");
  const highTasks = openTasks.filter((t) => t.priority === "high");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Taken" active="taken">
      <div className="space-y-4">
        <TrainerCommandHero
          title="Acties"
          description="Taken die aan jou zijn toegewezen. Rustig afvinken, duidelijk prioriteren."
          stats={[
            { label: "Open", value: String(openTasks.length), icon: ListTodo },
            { label: "Hoog", value: String(highTasks.length), icon: Flame },
            { label: "Afgerond", value: String(doneTasks.length), icon: CheckCircle2 },
          ]}
        />

        {tasks.length === 0 ? (
          <TrainerEmptyState
            icon={CheckSquare}
            title="Geen taken"
            body="Wanneer een beheerder of jij een taak toevoegt verschijnt die hier."
          />
        ) : (
          <TrainerTaskList tenantId={tenant.id} tasks={tasks} />
        )}
      </div>
    </PublicTenantShell>
  );
}
