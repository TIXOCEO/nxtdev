import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { TenantForm } from "../_tenant-form";

export default function NewTenantPage() {
  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/platform/tenants" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to tenants
        </Link>
      </div>

      <PageHeading title="New tenant" description="Create a new tenant on the platform." />

      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <TenantForm mode="create" />
      </div>
    </>
  );
}
