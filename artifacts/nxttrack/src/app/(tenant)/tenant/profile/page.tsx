import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { ProfileForm } from "./_profile-form";

export const dynamic = "force-dynamic";

export default async function TenantProfilePage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  return (
    <>
      <PageHeading
        title="Tenant profile"
        description="Update your tenant's branding and contact details."
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <ProfileForm tenant={result.tenant} />
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Need to change the slug or status? That's a platform-level action — ask a platform admin.
      </p>
    </>
  );
}
