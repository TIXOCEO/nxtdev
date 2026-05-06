import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import type { Member, MemberObservation } from "@/types/database";
import { ObservationForm } from "./_observation-form";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Sprint 35 — Trainer-only minimal LVS view for one member.
 *
 * Authorization: the user must own a member that is in any of the same
 * groups as the target member, and that member must carry a trainer role
 * (member_roles.role='trainer' OR a tenant_role with is_trainer_role).
 * Tenant admins / platform admins reach this via the regular tenant pages.
 */
export default async function PublicMemberDossierPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, id } = await params;
  const { from } = await searchParams;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/members/${id}`);

  const admin = createAdminClient();

  const { data: targetRow } = await admin
    .from("members")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .maybeSingle();
  const target = targetRow as Member | null;
  if (!target) notFound();

  // ── Authorization ──────────────────────────────────────────
  const { data: own } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id);
  const ownIds = ((own ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (ownIds.length === 0) redirect(`/t/${slug}`);

  const { data: gmsTarget } = await admin
    .from("group_members")
    .select("group_id")
    .eq("member_id", target.id);
  const targetGroupIds = ((gmsTarget ?? []) as Array<{ group_id: string }>).map(
    (r) => r.group_id,
  );
  if (targetGroupIds.length === 0) redirect(`/t/${slug}`);

  const { data: trainerInGroups } = await admin
    .from("group_members")
    .select("member_id, group_id")
    .in("member_id", ownIds)
    .in("group_id", targetGroupIds);
  const candidates = ((trainerInGroups ?? []) as Array<{
    member_id: string;
    group_id: string;
  }>).map((r) => r.member_id);
  if (candidates.length === 0) redirect(`/t/${slug}`);

  const [{ data: roleRows }, { data: tmrRows }] = await Promise.all([
    admin
      .from("member_roles")
      .select("member_id")
      .in("member_id", candidates)
      .eq("role", "trainer"),
    admin
      .from("tenant_member_roles")
      .select("member_id, tenant_roles!inner(is_trainer_role)")
      .eq("tenant_id", tenant.id)
      .in("member_id", candidates),
  ]);
  let isTrainer = ((roleRows ?? []) as Array<{ member_id: string }>).length > 0;
  if (!isTrainer) {
    type TmrRow = {
      member_id: string;
      tenant_roles:
        | { is_trainer_role: boolean }
        | { is_trainer_role: boolean }[]
        | null;
    };
    for (const r of (tmrRows ?? []) as TmrRow[]) {
      const list = Array.isArray(r.tenant_roles)
        ? r.tenant_roles
        : r.tenant_roles
          ? [r.tenant_roles]
          : [];
      if (list.some((tr) => tr.is_trainer_role)) {
        isTrainer = true;
        break;
      }
    }
  }
  if (!isTrainer) redirect(`/t/${slug}`);

  // ── Data ───────────────────────────────────────────────────
  const { data: observationsRows } = await admin
    .from("member_observations")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("member_id", target.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const observations = (observationsRows ?? []) as MemberObservation[];

  const fromSessionId =
    typeof from === "string" && from.startsWith("session:")
      ? from.slice("session:".length)
      : null;
  const backHref = fromSessionId
    ? `/t/${slug}/schedule/${fromSessionId}/manage`
    : `/t/${slug}/schedule`;

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Leerlingdossier" active="agenda">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug
        </Link>

        <header
          className="rounded-2xl border p-3"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {target.full_name}
          </h1>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Trainer-dossier
          </p>
        </header>

        <ObservationForm
          tenantId={tenant.id}
          memberId={target.id}
          sessionId={fromSessionId}
        />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Notities
          </h2>
          {observations.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Nog geen notities.
            </p>
          ) : (
            <ul className="grid gap-2">
              {observations.map((o) => (
                <li
                  key={o.id}
                  className="rounded-2xl border p-3"
                  style={{
                    backgroundColor: "var(--surface-main)",
                    borderColor: "var(--surface-border)",
                  }}
                >
                  <p
                    className="whitespace-pre-wrap text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {o.body}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {fmt(o.created_at)} · {o.visibility === "private" ? "Privé" : "Zichtbaar voor lid"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PublicTenantShell>
  );
}
