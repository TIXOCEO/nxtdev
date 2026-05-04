import Link from "next/link";
import { Newspaper, Plus, Pencil } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantNewsPosts } from "@/lib/db/tenant-news";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function TenantNewsListPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const posts = await getTenantNewsPosts(result.tenant.id);

  return (
    <>
      <PageHeading
        title="News"
        description="Manage announcements for this tenant."
        actions={
          <Link
            href="/tenant/news/new"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> New post
          </Link>
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No posts yet"
          description="Create your first news post to get started."
          action={
            <Link
              href="/tenant/news/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <Plus className="h-4 w-4" /> New post
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="space-y-3 md:hidden">
            {posts.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border p-4"
                style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
              >
                <Link href={`/tenant/news/${p.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {p.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                        /{p.slug}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>{p.category?.name ?? "—"}</span>
                    <span>·</span>
                    <span>Created {fmt(p.created_at)}</span>
                    {p.published_at && (
                      <>
                        <span>·</span>
                        <span>Published {fmt(p.published_at)}</span>
                      </>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div
            className="hidden overflow-hidden rounded-2xl border md:block"
            style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3">Published</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                  {posts.map((p) => (
                    <tr key={p.id} style={{ color: "var(--text-primary)" }}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>/{p.slug}</p>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {p.category?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {fmt(p.created_at)}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {fmt(p.published_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/tenant/news/${p.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
