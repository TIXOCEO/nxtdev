import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantNewsCategories } from "@/lib/db/tenant-news";
import { PostForm } from "../_post-form";

export const dynamic = "force-dynamic";

export default async function NewNewsPostPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const categories = await getTenantNewsCategories(result.tenant.id);

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/tenant/news" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to news
        </Link>
      </div>
      <PageHeading title="New post" description="Write a new announcement." />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <PostForm mode="create" tenantId={result.tenant.id} categories={categories} />
      </div>
    </>
  );
}
