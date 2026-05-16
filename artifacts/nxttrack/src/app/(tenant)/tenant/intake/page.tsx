import { redirect } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sprint 65 — Tenant-admin lijst van intake-submissions (read-only MVP).
 *
 * Triage-acties (assign-member, status-changes, link naar member-profile)
 * volgen in Sprint 66; deze pagina toont het volledige funnel-overzicht
 * zodat admins kunnen verifiëren dat dynamic intake werkt zoals verwacht.
 */

export const dynamic = "force-dynamic";

interface SubmissionRow {
  id: string;
  submission_type: string;
  status: string;
  registration_target: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

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

export default async function TenantIntakePage() {
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/login");
  await requireTenantAdmin(tenantId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_submissions")
    .select(
      "id, submission_type, status, registration_target, contact_name, contact_email, contact_phone, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as SubmissionRow[];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Intake-aanvragen"
        description="Overzicht van alle dynamic intake-submissions (Sprint 65 MVP — read-only)."
      />

      {error ? (
        <p className="text-sm" style={{ color: "var(--danger, #c0392b)" }}>
          Kon submissions niet laden: {error.message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Nog geen intake-aanvragen. Zodra dynamic intake voor deze tenant is
            ingeschakeld (settings_json.dynamic_intake_enabled = true) en het
            publieke proefles-formulier wordt verstuurd, verschijnt de eerste
            submission hier.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-2 text-left font-medium">Datum</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Naam</th>
                <th className="px-4 py-2 text-left font-medium">Voor</th>
                <th className="px-4 py-2 text-left font-medium">Contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("nl-NL")}
                  </td>
                  <td className="px-4 py-2">
                    {TYPE_LABEL[r.submission_type] ?? r.submission_type}
                  </td>
                  <td className="px-4 py-2">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </td>
                  <td className="px-4 py-2">{r.contact_name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {r.registration_target === "child"
                      ? "Kind"
                      : r.registration_target === "self"
                      ? "Zichzelf"
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span>{r.contact_email ?? "—"}</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {r.contact_phone ?? ""}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
