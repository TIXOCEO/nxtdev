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
import { PlacementSuggestionsPanel } from "@/components/tenant/intake/PlacementSuggestionsPanel";

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
  reviewing: "In review",
  eligible: "Goedgekeurd",
  placed: "Geplaatst",
  rejected: "Afgewezen",
  cancelled: "Geannuleerd",
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
      "id, tenant_id, form_id, submission_type, status, registration_target, contact_name, contact_email, contact_phone, contact_date_of_birth, preferences_json, program_id, assigned_group_id, created_at, priority_date",
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!sub) notFound();

  const [{ data: answers }, { data: fields }, { data: program }, { data: assignedGroup }] = await Promise.all([
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
  ]);

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
          />
        </div>
      </div>
    </div>
  );
}
