import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Award } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isParent, isAthlete } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PageHeader } from "@/components/public/page-header";
import { listDiplomasForMembers } from "@/lib/db/child-diplomas";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  return { title: `${tenant.name} | Diploma's` };
}

export default async function DiplomasPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/diplomas`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isParent(ctx) && !isAthlete(ctx)) redirect(`/t/${slug}`);

  const memberIds = [...ctx.members.map((m) => m.id), ...ctx.children.map((c) => c.id)];
  const memberNames = new Map<string, string>();
  for (const m of [...ctx.members, ...ctx.children]) {
    memberNames.set(m.id, `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Lid");
  }

  const diplomas = await listDiplomasForMembers(tenant.id, memberIds);

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Diploma's" active="diplomas">
      <PageHeader
        title="Diploma's"
        description="Behaalde diploma's en certificaten."
      />
      {diplomas.length === 0 ? (
        <PublicCard className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--accent-tint)", color: "var(--brand-navy)" }}
            >
              <Award className="h-7 w-7" />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Nog geen diploma's
            </h2>
            <p className="max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
              Zodra een diploma is toegekend verschijnt het hier.
            </p>
          </div>
        </PublicCard>
      ) : (
        <PublicCard>
          <div className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {diplomas.map((d) => (
              <div key={d.id} className="flex items-start gap-3 px-4 py-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "var(--accent-tint)", color: "var(--brand-navy)" }}
                >
                  <Award className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {d.diploma_name}
                    {d.level ? ` · ${d.level}` : ""}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {memberNames.get(d.member_id) ?? "Lid"} ·{" "}
                    {new Date(d.awarded_on).toLocaleDateString("nl-NL", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {d.notes && (
                    <p className="mt-1 text-xs italic" style={{ color: "var(--text-secondary)" }}>
                      {d.notes}
                    </p>
                  )}
                </div>
                {d.certificate_url && (
                  <a
                    href={d.certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium underline"
                    style={{ color: "var(--brand-navy)" }}
                  >
                    Bekijk
                  </a>
                )}
              </div>
            ))}
          </div>
        </PublicCard>
      )}
    </PublicTenantShell>
  );
}
