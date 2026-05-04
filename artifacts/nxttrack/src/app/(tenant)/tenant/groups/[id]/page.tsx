import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRound, Users } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getGroupDetail } from "@/lib/db/groups";
import { getMembersByTenant } from "@/lib/db/members";
import { createClient } from "@/lib/supabase/server";
import { GroupRolePicker } from "./_role-picker";
import { GroupMemberRow } from "./_member-row";
import type { MemberRole } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const detail = await getGroupDetail(id, result.tenant.id);
  if (!detail) notFound();

  // Members + roles for the picker (filter by role tab).
  const members = await getMembersByTenant(result.tenant.id);
  const supabase = await createClient();
  const { data: roleRows } = await supabase
    .from("member_roles")
    .select("member_id, role")
    .in(
      "member_id",
      members.map((m) => m.id),
    );
  const rolesByMember = new Map<string, Set<string>>();
  for (const r of (roleRows ?? []) as Array<MemberRole>) {
    const set = rolesByMember.get(r.member_id) ?? new Set<string>();
    set.add(r.role);
    rolesByMember.set(r.member_id, set);
  }

  const inGroupIds = new Set([
    ...detail.athletes.map((m) => m.id),
    ...detail.trainers.map((m) => m.id),
    ...detail.staff.map((m) => m.id),
    ...detail.others.map((m) => m.id),
  ]);

  const candidatesByRole = (role: string) =>
    members
      .filter((m) => !inGroupIds.has(m.id) && (rolesByMember.get(m.id)?.has(role) ?? false))
      .map((m) => ({ id: m.id, full_name: m.full_name }));

  return (
    <>
      <Link
        href="/tenant/groups"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar groepen
      </Link>

      <PageHeading
        title={detail.group.name}
        description={detail.group.description ?? "Beheer atleten en trainers in deze groep."}
      />

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Atleten ({detail.athletes.length})
          </h2>
        </div>
        <div className="mt-3">
          <GroupRolePicker
            tenantId={result.tenant.id}
            groupId={id}
            label="Atleet toevoegen"
            members={candidatesByRole("athlete")}
          />
        </div>
        {detail.athletes.length === 0 ? (
          <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen atleten in deze groep.
          </p>
        ) : (
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {detail.athletes.map((m) => (
              <GroupMemberRow
                key={m.id}
                tenantId={result.tenant.id}
                groupId={id}
                memberId={m.id}
                name={m.full_name}
                status={m.member_status}
              />
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Trainers ({detail.trainers.length})
          </h2>
        </div>
        <div className="mt-3">
          <GroupRolePicker
            tenantId={result.tenant.id}
            groupId={id}
            label="Trainer toevoegen"
            members={candidatesByRole("trainer")}
          />
        </div>
        {detail.trainers.length === 0 ? (
          <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen trainers in deze groep.
          </p>
        ) : (
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {detail.trainers.map((m) => (
              <GroupMemberRow
                key={m.id}
                tenantId={result.tenant.id}
                groupId={id}
                memberId={m.id}
                name={m.full_name}
                status={m.member_status}
              />
            ))}
          </ul>
        )}
      </section>

      {(detail.staff.length > 0 || detail.others.length > 0) && (
        <section
          className="rounded-2xl border p-4 sm:p-6"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Overige leden ({detail.staff.length + detail.others.length})
          </h2>
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {[...detail.staff, ...detail.others].map((m) => (
              <GroupMemberRow
                key={m.id}
                tenantId={result.tenant.id}
                groupId={id}
                memberId={m.id}
                name={m.full_name}
                status={m.member_status}
              />
            ))}
          </ul>
        </section>
      )}

      {detail.athletes.length === 0 &&
        detail.trainers.length === 0 &&
        detail.staff.length === 0 &&
        detail.others.length === 0 && (
          <EmptyState
            icon={Users}
            title="Lege groep"
            description="Voeg atleten of trainers toe via de keuzelijst hierboven."
          />
        )}
    </>
  );
}
