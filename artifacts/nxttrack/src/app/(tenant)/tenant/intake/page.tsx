import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess, hasMembership } from "@/lib/permissions";
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

interface SearchParams {
  q?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
}

export default async function TenantIntakePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/login");
  // Sprint 65 — tenant-admin OF tenant-staff mogen het intake-overzicht
  // zien (read-only MVP). `hasTenantAccess` dekt platform-admin + legacy
  // tenant_admin-enum + admin-role; `hasMembership` dekt reguliere
  // staff-memberships in deze tenant.
  const user = await requireAuth();
  const [memberships, adminRoleTenants] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const isAdmin = hasTenantAccess(memberships, tenantId, adminRoleTenants);
  const isStaff = hasMembership(memberships, tenantId);
  if (!isAdmin && !isStaff) {
    redirect("/");
  }

  const admin = createAdminClient();

  // Sprint 65 — flag-off pagina-fallback: als dynamic intake voor deze
  // tenant uit staat tonen we een uitleg-card (geen redirect, want de
  // sidebar-link toont al niet — directe URL-bezoek moet wel begrijpen
  // wat er aan de hand is).
  const { data: tRow } = await admin
    .from("tenants")
    .select("settings_json")
    .eq("id", tenantId)
    .maybeSingle();
  const settings = (tRow?.settings_json ?? {}) as Record<string, unknown>;
  const dynamicIntakeEnabled = settings.dynamic_intake_enabled === true;

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const typeFilter = (sp.type ?? "").trim();
  const fromFilter = (sp.from ?? "").trim();
  const toFilter = (sp.to ?? "").trim();

  let query = admin
    .from("intake_submissions")
    .select(
      "id, submission_type, status, registration_target, contact_name, contact_email, contact_phone, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (typeFilter) query = query.eq("submission_type", typeFilter);
  if (fromFilter) query = query.gte("created_at", `${fromFilter}T00:00:00Z`);
  if (toFilter) query = query.lte("created_at", `${toFilter}T23:59:59Z`);
  if (q) {
    const safe = q.replace(/[%,]/g, " ");
    query = query.or(
      `contact_name.ilike.%${safe}%,contact_email.ilike.%${safe}%,contact_phone.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  const rows = (data ?? []) as SubmissionRow[];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Intake-aanvragen"
        description="Overzicht van alle dynamic intake-submissions (Sprint 65 MVP — read-only)."
      />

      {!dynamicIntakeEnabled ? (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Dynamic intake is uit voor deze tenant. Bestaande proefles-aanvragen
            blijven via de klassieke flow binnenkomen onder{" "}
            <Link href="/tenant/registrations" className="underline">
              Aanmeldingen
            </Link>
            . Vraag een platform-admin om{" "}
            <code>settings_json.dynamic_intake_enabled = true</code> te zetten
            om dit overzicht te activeren.
          </p>
        </div>
      ) : null}

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <label className="flex flex-col text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Zoeken</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Naam / e-mail / telefoon"
            className="mt-1 rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input, var(--surface))" }}
          />
        </label>
        <label className="flex flex-col text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Status</span>
          <select
            name="status"
            defaultValue={statusFilter}
            className="mt-1 rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input, var(--surface))" }}
          >
            <option value="">Alle</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Type</span>
          <select
            name="type"
            defaultValue={typeFilter}
            className="mt-1 rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input, var(--surface))" }}
          >
            <option value="">Alle</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Vanaf</span>
          <input
            type="date"
            name="from"
            defaultValue={fromFilter}
            className="mt-1 rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input, var(--surface))" }}
          />
        </label>
        <label className="flex flex-col text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Tot</span>
          <input
            type="date"
            name="to"
            defaultValue={toFilter}
            className="mt-1 rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input, var(--surface))" }}
          />
        </label>
        <button
          type="submit"
          className="rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground, white)" }}
        >
          Filter
        </button>
        {(q || statusFilter || typeFilter || fromFilter || toFilter) ? (
          <Link
            href="/tenant/intake"
            className="text-sm underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Wissen
          </Link>
        ) : null}
      </form>

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
                  <td className="px-4 py-2">
                    <Link
                      href={`/tenant/intake/${r.id}`}
                      className="underline"
                    >
                      {r.contact_name ?? "—"}
                    </Link>
                  </td>
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
