import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listTrainerTasksForAdmin } from "@/lib/db/trainer-tasks";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewTaskForm } from "./_new-task-form";
import { ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

interface TrainerOption {
  user_id: string;
  full_name: string;
}

async function listTrainerCandidates(tenantId: string): Promise<TrainerOption[]> {
  const admin = createAdminClient();
  // Trainer-rol via member_roles ∪ tenant_member_roles (is_trainer_role).
  const [{ data: mr }, { data: tmr }] = await Promise.all([
    admin
      .from("member_roles")
      .select("member_id, members!inner(id,tenant_id,user_id,full_name,archived_at)")
      .eq("role", "trainer"),
    admin
      .from("tenant_member_roles")
      .select("member_id, tenant_roles!inner(is_trainer_role), members!inner(id,tenant_id,user_id,full_name,archived_at)")
      .eq("tenant_id", tenantId),
  ]);
  type Row = {
    members:
      | { id: string; tenant_id: string; user_id: string | null; full_name: string; archived_at: string | null }
      | Array<{ id: string; tenant_id: string; user_id: string | null; full_name: string; archived_at: string | null }>
      | null;
    tenant_roles?: { is_trainer_role: boolean } | Array<{ is_trainer_role: boolean }> | null;
  };
  const map = new Map<string, TrainerOption>();
  function flat<T>(v: T | T[] | null | undefined): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  }
  for (const r of (mr ?? []) as Row[]) {
    const m = flat(r.members);
    if (!m || m.tenant_id !== tenantId || m.archived_at || !m.user_id) continue;
    if (!map.has(m.user_id)) map.set(m.user_id, { user_id: m.user_id, full_name: m.full_name });
  }
  for (const r of (tmr ?? []) as Row[]) {
    const m = flat(r.members);
    const tr = flat(r.tenant_roles);
    if (!m || !tr?.is_trainer_role || m.archived_at || !m.user_id) continue;
    if (!map.has(m.user_id)) map.set(m.user_id, { user_id: m.user_id, full_name: m.full_name });
  }
  return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
}

const STATUS_TONE: Record<string, { bg: string; color: string; label: string }> = {
  open:      { bg: "#fef3c7", color: "#92400e", label: "Open" },
  done:      { bg: "#dcfce7", color: "#14532d", label: "Klaar" },
  cancelled: { bg: "#f3f4f6", color: "#6b7280", label: "Geannuleerd" },
};

export default async function TenantTakenPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [tasks, trainers] = await Promise.all([
    listTrainerTasksForAdmin(result.tenant.id),
    listTrainerCandidates(result.tenant.id),
  ]);

  const trainerName = new Map(trainers.map((t) => [t.user_id, t.full_name]));

  return (
    <>
      <PageHeading title="Trainer-taken" description="Wijs taken toe aan trainers." />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border" style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-card)" }}>
          {tasks.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ClipboardList}
                title="Nog geen taken"
                description="Wijs hieronder de eerste taak toe aan een trainer."
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider" style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
                  <th className="px-4 py-2">Titel</th>
                  <th className="px-4 py-2">Toegewezen aan</th>
                  <th className="px-4 py-2">Deadline</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const tone = STATUS_TONE[t.status] ?? STATUS_TONE.open;
                  return (
                    <tr key={t.id} className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)" }}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium" style={{ color: "var(--text-primary)" }}>{t.title}</div>
                        {t.body && <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.body}</div>}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>
                        {trainerName.get(t.assigned_to_user_id) ?? "—"}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{fmt(t.due_date)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: tone.bg, color: tone.color }}>
                          {tone.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <NewTaskForm tenantId={result.tenant.id} trainers={trainers} />
      </div>
    </>
  );
}
