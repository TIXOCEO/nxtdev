import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getTenantNewsPostById,
  getTenantNewsCategories,
} from "@/lib/db/tenant-news";
import { deleteNewsPost } from "@/lib/actions/tenant/news";
import { PostForm } from "../_post-form";

export const dynamic = "force-dynamic";

export default async function EditNewsPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const tenantId = result.tenant.id;
  const [post, categories] = await Promise.all([
    getTenantNewsPostById(id, tenantId),
    getTenantNewsCategories(tenantId),
  ]);
  if (!post) notFound();

  async function handleDelete() {
    "use server";
    await deleteNewsPost(id, tenantId);
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/tenant/news" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to news
        </Link>
      </div>
      <PageHeading
        title={post.title}
        description={`/${post.slug}`}
        actions={<StatusBadge status={post.status} />}
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <PostForm
          mode="edit"
          tenantId={tenantId}
          categories={categories}
          initial={post}
          onDelete={handleDelete}
        />
      </div>
    </>
  );
}
