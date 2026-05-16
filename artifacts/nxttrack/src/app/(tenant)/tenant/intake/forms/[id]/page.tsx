import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { assertTenantAccess } from "@/lib/actions/tenant/_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntakeFormDetailActions } from "./_actions";

interface FormRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  settings_json: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
}

const STATUS_LABEL: Record<FormRow["status"], string> = {
  draft: "Concept",
  published: "Gepubliceerd",
  archived: "Gearchiveerd",
};

export default async function IntakeFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/login");
  await assertTenantAccess(tenantId);
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("intake_forms")
    .select(
      "id, slug, name, description, status, is_default, settings_json, updated_at, created_at",
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) notFound();
  const form = data as FormRow;

  const { count: fieldCount } = await admin
    .from("intake_form_fields")
    .select("id", { count: "exact", head: true })
    .eq("form_id", form.id)
    .eq("tenant_id", tenantId);

  const settings = (form.settings_json ?? {}) as Record<string, unknown>;
  const submissionType =
    typeof settings.submission_type === "string"
      ? (settings.submission_type as string)
      : "trial_lesson";

  return (
    <div className="space-y-6">
      <PageHeading
        title={form.name}
        description={form.description ?? "Intake-formulier"}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor:
              form.status === "published"
                ? "var(--success-soft, #d1fae5)"
                : form.status === "draft"
                  ? "var(--warning-soft, #fef3c7)"
                  : "var(--bg-muted, #e5e7eb)",
          }}
        >
          {STATUS_LABEL[form.status]}
        </span>
        {form.is_default ? (
          <span className="text-xs">⭐ Standaard formulier</span>
        ) : null}
        <span style={{ color: "var(--text-secondary)" }}>
          slug <code>{form.slug}</code>
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          type <code>{submissionType}</code>
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          {fieldCount ?? 0} velden
        </span>
        <Link
          href={`/tenant/intake/forms/${form.id}/builder`}
          className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-foreground, white)",
          }}
        >
          Open bouwer
        </Link>
      </div>

      <IntakeFormDetailActions
        tenantId={tenantId}
        formId={form.id}
        status={form.status}
        isDefault={form.is_default}
      />

      <div
        className="rounded-2xl p-5 text-sm"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="mb-2 font-medium">Metadata</h3>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt style={{ color: "var(--text-secondary)" }}>Aangemaakt</dt>
          <dd>{new Date(form.created_at).toLocaleString("nl-NL")}</dd>
          <dt style={{ color: "var(--text-secondary)" }}>Bijgewerkt</dt>
          <dd>{new Date(form.updated_at).toLocaleString("nl-NL")}</dd>
          <dt style={{ color: "var(--text-secondary)" }}>Form-ID</dt>
          <dd className="font-mono">{form.id}</dd>
        </dl>
      </div>
    </div>
  );
}
