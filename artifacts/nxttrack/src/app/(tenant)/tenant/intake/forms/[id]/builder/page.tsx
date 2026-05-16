import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { assertTenantAccess } from "@/lib/actions/tenant/_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntakeFormBuilder } from "./_builder";
import type { IntakeFormFieldConfig } from "@/lib/intake/types";

interface FormRow {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "published" | "archived";
}

interface FieldRow {
  id: string;
  key: string;
  label: string;
  help_text: string | null;
  field_type: IntakeFormFieldConfig["field_type"];
  is_required: boolean;
  options_json: unknown;
  validation_json: unknown;
  show_if_json: unknown;
  sort_order: number;
  pii_class: "standard" | "sensitive";
  canonical_target: string | null;
}

export default async function IntakeFormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/login");
  await assertTenantAccess(tenantId);
  const { id } = await params;

  const admin = createAdminClient();
  const { data: formData } = await admin
    .from("intake_forms")
    .select("id, slug, name, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!formData) notFound();
  const form = formData as FormRow;

  const { data: fieldRows } = await admin
    .from("intake_form_fields")
    .select(
      "id, key, label, help_text, field_type, is_required, options_json, validation_json, show_if_json, sort_order, pii_class, canonical_target",
    )
    .eq("form_id", form.id)
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  const fields: Array<IntakeFormFieldConfig & { id: string }> = (
    (fieldRows ?? []) as FieldRow[]
  ).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    help_text: r.help_text,
    field_type: r.field_type,
    is_required: r.is_required,
    options: Array.isArray(r.options_json)
      ? (r.options_json as IntakeFormFieldConfig["options"])
      : [],
    validation:
      r.validation_json && typeof r.validation_json === "object"
        ? (r.validation_json as IntakeFormFieldConfig["validation"])
        : {},
    show_if:
      r.show_if_json &&
      typeof r.show_if_json === "object" &&
      !Array.isArray(r.show_if_json)
        ? (r.show_if_json as IntakeFormFieldConfig["show_if"])
        : null,
    sort_order: r.sort_order,
    pii_class: r.pii_class,
    canonical_target:
      (r.canonical_target as IntakeFormFieldConfig["canonical_target"]) ?? null,
  }));

  return (
    <div className="space-y-4">
      <PageHeading
        title={`Bouwer — ${form.name}`}
        description={`Sleep velden om de volgorde aan te passen, klik om te bewerken. Status: ${form.status}.`}
      />
      <div className="flex gap-2 text-sm">
        <Link
          href={`/tenant/intake/forms/${form.id}`}
          className="underline"
        >
          ← Terug naar detail
        </Link>
      </div>
      <IntakeFormBuilder
        tenantId={tenantId}
        formId={form.id}
        initialFields={fields}
        formStatus={form.status as "draft" | "published" | "archived"}
      />
    </div>
  );
}
