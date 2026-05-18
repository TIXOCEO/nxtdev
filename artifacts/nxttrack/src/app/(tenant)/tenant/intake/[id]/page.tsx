import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess, hasMembership } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { scorePlacementCandidates } from "@/lib/db/placement";
import { getWaitEstimate } from "@/lib/intake/wait-time";
import { PlacementSuggestionsPanel } from "@/components/tenant/intake/PlacementSuggestionsPanel";
import { SubmissionStatusStrip } from "@/components/tenant/intake/SubmissionStatusStrip";
import { RecommendedStageBadge } from "@/components/tenant/intake/RecommendedStageBadge";
import {
  SubmissionHistory,
  type SubmissionAuditRow,
} from "@/components/tenant/intake/SubmissionHistory";
import {
  SubmissionSlotOffers,
  type SlotOfferRow,
} from "@/components/tenant/intake/SubmissionSlotOffers";

/**
 * Sprint 70 — Intake-submission detailpagina.
 *
 * Toont contact-block + antwoorden + status, met het advisory
 * PlacementSuggestionsPanel ernaast. Toegang: tenant-admin OF
 * tenant-staff (zelfde regel als Sprint 65 lijst-page).
 */

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  trial_lesson: "Proefles",
  registration: "Inschrijving",
  waitlist_request: "Wachtlijst",
  information_request: "Informatie",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Ingediend",
  in_review: "In beoordeling",
  needs_review: "Vereist beoordeling",
  waitlisted: "Wachtlijst",
  placed: "Geplaatst",
  rejected: "Afgewezen",
  converted: "Omgezet",
};

interface AnswerRow {
  field_id: string;
  field_key: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_bool: boolean | null;
  value_json: unknown;
}

function renderAnswerValue(a: AnswerRow): string {
  if (a.value_text != null && a.value_text !== "") return a.value_text;
  if (a.value_number != null) return String(a.value_number);
  if (a.value_date != null) return a.value_date;
  if (a.value_bool != null) return a.value_bool ? "Ja" : "Nee";
  if (a.value_json != null) {
    if (Array.isArray(a.value_json)) return a.value_json.join(", ");
    return JSON.stringify(a.value_json);
  }
  return "—";
}

export default async function TenantIntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/login");

  const user = await requireAuth();
  const [memberships, adminRoleTenants] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const isAdmin = hasTenantAccess(memberships, tenantId, adminRoleTenants);
  const isStaff = hasMembership(memberships, tenantId);
  if (!isAdmin && !isStaff) redirect("/");

  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("intake_submissions")
    .select(
      "id, tenant_id, form_id, submission_type, status, registration_target, contact_name, contact_email, contact_phone, contact_date_of_birth, preferences_json, program_id, assigned_group_id, recommended_stage_id, selected_stage_id, created_at, priority_date",
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!sub) notFound();

  // Sprint 73 — laad program_stages voor de "Aanbevolen stage"-badge
  // en de "Pas aan"-popover. Ook de namen van de huidige
  // recommended/selected stage voor read-only weergave.
  const programStagesPromise = sub.program_id
    ? admin
        .from("program_stages")
        .select("id, name, color")
        .eq("tenant_id", tenantId)
        .eq("program_id", sub.program_id)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
    : Promise.resolve({ data: [] as Array<{ id: string; name: string; color: string | null }> });
  const stageIdsToFetch = [sub.recommended_stage_id, sub.selected_stage_id].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const stageNamesPromise =
    stageIdsToFetch.length > 0
      ? admin
          .from("program_stages")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", stageIdsToFetch)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> });

  const [
    { data: answers },
    { data: fields },
    { data: program },
    { data: assignedGroup },
    { data: programStagesData },
    { data: stageNamesData },
  ] = await Promise.all([
    admin
      .from("submission_answers")
      .select("field_id, field_key, value_text, value_number, value_date, value_bool, value_json")
      .eq("submission_id", id)
      .eq("tenant_id", tenantId),
    sub.form_id
      ? admin
          .from("intake_form_fields")
          .select("id, key, label, sort_order")
          .eq("tenant_id", tenantId)
          .eq("form_id", sub.form_id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; key: string; label: string; sort_order: number }> }),
    sub.program_id
      ? admin
          .from("programs")
          .select("id, name")
          .eq("id", sub.program_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sub.assigned_group_id
      ? admin
          .from("groups")
          .select("id, name")
          .eq("id", sub.assigned_group_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    programStagesPromise,
    stageNamesPromise,
  ]);

  const programStages = (programStagesData ?? []) as Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  const stageNameById = new Map<string, string>(
    ((stageNamesData ?? []) as Array<{ id: string; name: string }>).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const recommendedStageName = sub.recommended_stage_id
    ? stageNameById.get(sub.recommended_stage_id) ?? null
    : null;
  const selectedStageName = sub.selected_stage_id
    ? stageNameById.get(sub.selected_stage_id) ?? null
    : null;

  // Sprint 73 — audit-timeline voor deze submission. We filteren op
  // DB-niveau via de jsonb-key `meta->>submission_id`, zodat ook in
  // drukke tenants geen events buiten een tenant-wide window vallen.
  // De 5 intake-acties slaan submission_id altijd top-level in meta.
  const { data: auditRowsRaw } = await admin
    .from("audit_logs")
    .select("id, action, meta, actor_user_id, created_at")
    .eq("tenant_id", tenantId)
    .in("action", [
      "intake.submission.reviewed",
      "intake.submission.status_changed",
      "intake.submission.rejected",
      "intake.submission.placed",
      "intake.submission.stage_selected",
    ])
    .filter("meta->>submission_id", "eq", sub.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const filtered = (auditRowsRaw ?? []) as Array<{
    id: string;
    action: string;
    meta: Record<string, unknown> | null;
    actor_user_id: string | null;
    created_at: string;
  }>;
  const actorIds = Array.from(
    new Set(filtered.map((r) => r.actor_user_id).filter((v): v is string => !!v)),
  );
  const actorEmailById = new Map<string, string>();
  if (actorIds.length > 0) {
    await Promise.all(
      actorIds.map(async (uid) => {
        try {
          const { data: u } = await admin.auth.admin.getUserById(uid);
          if (u?.user?.email) actorEmailById.set(uid, u.user.email);
        } catch {
          /* swallow */
        }
      }),
    );
  }
  const historyRows: SubmissionAuditRow[] = filtered
    .reverse()
    .map((r) => ({
      id: r.id,
      action: r.action,
      meta: (r.meta ?? {}) as Record<string, unknown>,
      actor_email: r.actor_user_id
        ? actorEmailById.get(r.actor_user_id) ?? null
        : null,
      created_at: r.created_at,
    }));

  // Sprint 74 — laad slot-offers voor de tijdlijn op de detailpagina.
  const { data: slotOfferRows } = await admin
    .from("intake_slot_offers")
    .select("id, status, expires_at, used_at, created_at, group_id")
    .eq("tenant_id", tenantId)
    .eq("submission_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const offerGroupIds = Array.from(
    new Set(((slotOfferRows ?? []) as Array<{ group_id: string }>).map((o) => o.group_id)),
  );
  let offerGroupNames: Record<string, string> = {};
  if (offerGroupIds.length > 0) {
    const { data: gNames } = await admin
      .from("groups")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", offerGroupIds);
    offerGroupNames = Object.fromEntries(
      (gNames ?? []).map((g) => [g.id as string, (g.name as string) ?? ""]),
    );
  }
  const slotOffers: SlotOfferRow[] = ((slotOfferRows ?? []) as Array<{
    id: string;
    status: SlotOfferRow["status"];
    expires_at: string;
    used_at: string | null;
    created_at: string;
    group_id: string;
  }>).map((o) => ({
    id: o.id,
    status: o.status,
    expires_at: o.expires_at,
    used_at: o.used_at,
    created_at: o.created_at,
    group_name: offerGroupNames[o.group_id] ?? null,
  }));

  // Sprint 71 — scorePlacementCandidates gooit nu bij RPC-fout i.p.v.
  // stilletjes lege array; vang dat hier op zodat de pagina nog rendert
  // (lege-state in het panel).
  let candidates: Awaited<ReturnType<typeof scorePlacementCandidates>> = [];
  try {
    candidates = await scorePlacementCandidates(id);
  } catch {
    candidates = [];
  }

  // Verzamel groep-namen voor het panel (alleen kandidaten waarvan
  // we de naam moeten tonen).
  const candidateGroupIds = Array.from(new Set(candidates.map((c) => c.group_id)));
  let groupNames: Record<string, string> = {};
  if (candidateGroupIds.length > 0) {
    const { data: grpRows } = await admin
      .from("groups")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", candidateGroupIds);
    groupNames = Object.fromEntries(
      (grpRows ?? []).map((g) => [g.id as string, (g.name as string) ?? ""]),
    );
  }

  // Sprint 82b — wachttijd per top-5 kandidaat-groep voor de resolved
  // target-stage (selected of recommended). Identiek aan wat de
  // aanvrager publiek ziet via /voorstellen, zodat de admin geen mismatch
  // ervaart bij het kiezen van een groep.
  const waitWeeksByGroupId: Record<string, number | null> = {};
  const adminWaitCandidates = candidates.slice(0, 5);
  for (const c of adminWaitCandidates) {
    const stageId = c.rationale_json.target_stage_id ?? null;
    try {
      waitWeeksByGroupId[c.group_id] = await getWaitEstimate(admin, {
        tenantId,
        groupId: c.group_id,
        stageId,
      });
    } catch {
      waitWeeksByGroupId[c.group_id] = null;
    }
  }

  const labelByKey = new Map<string, string>(
    (fields ?? []).map((f) => [f.key as string, (f.label as string) ?? (f.key as string)]),
  );

  const prefs = (sub.preferences_json ?? {}) as Record<string, unknown>;
  const prefsEmpty = Object.keys(prefs).length === 0;
  const missingSignals = {
    preferences: prefsEmpty,
    dateOfBirth: !sub.contact_date_of_birth,
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title={sub.contact_name ?? "Intake-aanvraag"}
        description={`${TYPE_LABEL[sub.submission_type] ?? sub.submission_type} • ${STATUS_LABEL[sub.status] ?? sub.status}`}
      />

      <p className="text-sm">
        <Link href="/tenant/intake" className="underline" style={{ color: "var(--text-secondary)" }}>
          ← Terug naar overzicht
        </Link>
      </p>

      {isAdmin ? (
        <SubmissionStatusStrip
          submissionId={sub.id}
          currentStatus={sub.status}
        />
      ) : null}

      {isAdmin && (sub.recommended_stage_id || sub.selected_stage_id || programStages.length > 0) ? (
        <RecommendedStageBadge
          submissionId={sub.id}
          recommendedStageId={sub.recommended_stage_id ?? null}
          recommendedStageName={recommendedStageName}
          selectedStageId={sub.selected_stage_id ?? null}
          selectedStageName={selectedStageName}
          programStages={programStages}
        />
      ) : null}

      {isAdmin ? <SubmissionHistory rows={historyRows} /> : null}

      {isAdmin && slotOffers.length > 0 ? (
        <SubmissionSlotOffers offers={slotOffers} canCancel={isAdmin} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-base font-semibold">Contact</h2>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Naam</dt>
                <dd>{sub.contact_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>E-mail</dt>
                <dd>{sub.contact_email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Telefoon</dt>
                <dd>{sub.contact_phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Geboortedatum</dt>
                <dd>{sub.contact_date_of_birth ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Voor</dt>
                <dd>
                  {sub.registration_target === "child"
                    ? "Kind"
                    : sub.registration_target === "self"
                    ? "Zichzelf"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Programma</dt>
                <dd>{program?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Ingediend op</dt>
                <dd>{new Date(sub.created_at).toLocaleString("nl-NL")}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Geplaatst in</dt>
                <dd>{assignedGroup?.name ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-base font-semibold">Antwoorden</h2>
            {(answers ?? []).length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                Geen antwoorden geregistreerd.
              </p>
            ) : (
              <dl className="mt-3 space-y-2 text-sm">
                {((answers ?? []) as AnswerRow[]).map((a) => (
                  <div key={a.field_id} className="grid grid-cols-3 gap-2">
                    <dt className="col-span-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {labelByKey.get(a.field_key) ?? a.field_key}
                    </dt>
                    <dd className="col-span-2">{renderAnswerValue(a)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {!prefsEmpty && (
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-base font-semibold">Voorkeuren</h2>
              <pre
                className="mt-2 overflow-auto rounded-md p-2 text-xs"
                style={{ backgroundColor: "var(--surface-muted, #f4f5f7)" }}
              >
                {JSON.stringify(prefs, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <PlacementSuggestionsPanel
            submissionId={id}
            candidates={candidates}
            groupNames={groupNames}
            missingSignals={missingSignals}
            canPlace={isAdmin}
            waitWeeksByGroupId={waitWeeksByGroupId}
          />
        </div>
      </div>
    </div>
  );
}
