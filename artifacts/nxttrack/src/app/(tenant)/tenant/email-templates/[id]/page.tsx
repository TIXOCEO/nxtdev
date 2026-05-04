import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getEmailTemplateById } from "@/lib/db/email-templates";
import { TemplateEditor } from "./_template-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmailTemplateEditPage({ params }: PageProps) {
  const { id } = await params;

  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const template = await getEmailTemplateById(id, result.tenant.id);
  if (!template) notFound();

  return (
    <>
      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link
          href="/tenant/email-templates"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar templates
        </Link>
      </div>

      <PageHeading
        title={template.name}
        description={
          <>
            Sleutel: <span className="font-mono">{template.key}</span>
          </>
        }
      />

      <TemplateEditor template={template} tenant={result.tenant} />
    </>
  );
}
