import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Award, Download, Sparkles, Users } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isParent, isAthlete } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { listDiplomasForMembers } from "@/lib/db/child-diplomas";
import {
  UserBadgeTile,
  UserEmptyState,
  UserMetricCard,
  UserReferenceHero,
  UserSectionHeader,
  UserStatusPill,
  UserSurface,
} from "@/components/public/user-shell-components";

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
  const downloadable = diplomas.filter((d) => d.certificate_url).length;

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Diploma's" active="diplomas">
      <UserReferenceHero
        eyebrow="Diploma vault"
        title="Diploma's"
        description="Behaalde diploma's, certificaten en downloads op een veilige plek."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <UserMetricCard
            label="Behaald"
            value={`${diplomas.length}`}
            helper="Diploma's in de kluis"
            icon={Award}
            toneKey={diplomas.length > 0 ? "success" : "neutral"}
          />
          <UserMetricCard
            label="Downloads"
            value={`${downloadable}`}
            helper="Met certificaatlink"
            icon={Download}
            toneKey={downloadable > 0 ? "accent" : "neutral"}
          />
          <UserMetricCard
            label="Leerlingen"
            value={`${memberIds.length}`}
            helper="In dit account"
            icon={Users}
            toneKey="info"
          />
        </div>
      </UserReferenceHero>
      {diplomas.length === 0 ? (
        <UserEmptyState
          icon={Award}
          title="Nog geen diploma's"
          body="Zodra een diploma is toegekend verschijnt het hier."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <UserBadgeTile title="Diploma behaald" subtitle="Trots moment opgeslagen" unlocked />
            <UserBadgeTile title="Download klaar" subtitle="Open certificaat als link" unlocked={downloadable > 0} />
            <UserBadgeTile title="Volgende reis" subtitle="Nieuwe mijlpalen volgen vanzelf" unlocked={diplomas.length > 0} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
              {diplomas.map((d) => (
                <UserSurface key={d.id} className="p-4" interactive>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
                    style={{ backgroundColor: "color-mix(in srgb, var(--shell-success) 10%, var(--shell-panel-strong))", borderColor: "var(--shell-border)", color: "var(--shell-success)" }}
                  >
                    <Award className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {d.diploma_name}
                      {d.level ? ` - ${d.level}` : ""}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {memberNames.get(d.member_id) ?? "Lid"} -{" "}
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
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <UserStatusPill toneKey="success" icon={Sparkles}>Behaald</UserStatusPill>
                    {d.certificate_url && (
                      <a
                        href={d.certificate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nxt-focus-ring inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold"
                        style={{ borderColor: "var(--shell-border)", color: "var(--shell-info)" }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    )}
                  </div>
                </div>
                </UserSurface>
              ))}
          </div>
        </div>
      )}
    </PublicTenantShell>
  );
}
