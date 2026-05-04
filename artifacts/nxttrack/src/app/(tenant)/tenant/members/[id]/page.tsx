import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Users as UsersIcon,
  UsersRound,
  CreditCard,
  Receipt,
  Tag,
  Link2,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getMemberWithRelations, getMembersByTenant } from "@/lib/db/members";
import { getGroupsByTenant } from "@/lib/db/groups";
import { getPlansByTenant } from "@/lib/db/membership-plans";
import { GroupSelector } from "@/components/tenant/group-selector";
import { MembershipCard } from "@/components/tenant/membership-card";
import { PaymentLog } from "@/components/tenant/payment-log";
import { TrainerPublicSettings } from "@/components/tenant/members/trainer-public-settings";
import {
  LinkChildForm,
  AssignPlanForm,
  LogPaymentForm,
  GenerateMinorCodeButton,
} from "./_member-detail-actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params;

  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const data = await getMemberWithRelations(id, result.tenant.id);
  if (!data) notFound();

  const [allGroups, allPlans, allMembers] = await Promise.all([
    getGroupsByTenant(result.tenant.id),
    getPlansByTenant(result.tenant.id),
    getMembersByTenant(result.tenant.id),
  ]);

  const isParentRole = data.roles.some((r) => r.role === "parent");
  const isAthleteRole = data.roles.some((r) => r.role === "athlete");
  const isTrainerRole = data.roles.some((r) => r.role === "trainer");

  const linkableChildren = allMembers.filter(
    (m) =>
      m.id !== data.member.id &&
      !data.children.some((c) => c.id === m.id),
  );

  const activePlans = allPlans.filter((p) => p.is_active);

  return (
    <>
      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link
          href="/tenant/members"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar leden
        </Link>
      </div>

      <PageHeading
        title={data.member.full_name}
        description="Leddetails, koppelingen, abonnement en betalingen."
      />

      {/* Section 1: Basic info */}
      <Section title="Basisinformatie">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Status">
            <StatusBadge status={data.member.member_status} />
          </Stat>
          <Stat label="E-mail" icon={<Mail className="h-3.5 w-3.5" />}>
            {data.member.email ?? "—"}
          </Stat>
          <Stat label="Telefoon" icon={<Phone className="h-3.5 w-3.5" />}>
            {data.member.phone ?? "—"}
          </Stat>
          <Stat label="Aangemaakt">
            {new Date(data.member.created_at).toLocaleDateString("nl-NL")}
          </Stat>
        </div>
      </Section>

      {/* Section 2: Roles */}
      <Section title="Rollen" icon={<Tag className="h-4 w-4" />}>
        {data.roles.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Geen rollen toegewezen.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.roles.map((r) => (
              <li
                key={r.id}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  color: "var(--text-primary)",
                }}
              >
                {ROLE_LABELS[r.role] ?? r.role}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Section 3: Groups */}
      <Section title="Groepen" icon={<UsersRound className="h-4 w-4" />}>
        <GroupSelector
          tenantId={result.tenant.id}
          memberId={data.member.id}
          currentGroups={data.groups}
          allGroups={allGroups}
        />
      </Section>

      {/* Section 4: Parent / child relations */}
      <Section title="Ouders & kinderen" icon={<Link2 className="h-4 w-4" />}>
        {isAthleteRole && (
          <div className="space-y-2">
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Ouder(s)
            </h3>
            {data.parents.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Nog geen ouder gekoppeld.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.parents.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/tenant/members/${p.id}`}
                      className="rounded-full border px-3 py-1 text-xs hover:bg-black/5"
                      style={{
                        borderColor: "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {p.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(isParentRole || data.children.length > 0) && (
          <div className="mt-4 space-y-2">
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Kind(eren)
            </h3>
            {data.children.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Nog geen kind gekoppeld.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.children.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1">
                    <Link
                      href={`/tenant/members/${c.id}`}
                      className="self-start rounded-full border px-3 py-1 text-xs hover:bg-black/5"
                      style={{
                        borderColor: "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {c.full_name}
                    </Link>
                    <GenerateMinorCodeButton
                      tenantId={result.tenant.id}
                      parentMemberId={data.member.id}
                      childMemberId={c.id}
                      childName={c.full_name}
                    />
                  </li>
                ))}
              </ul>
            )}
            <LinkChildForm
              tenantId={result.tenant.id}
              parentMemberId={data.member.id}
              candidates={linkableChildren.map((m) => ({
                id: m.id,
                full_name: m.full_name,
              }))}
            />
          </div>
        )}
      </Section>

      {/* Section 5: Membership */}
      <Section title="Abonnement" icon={<CreditCard className="h-4 w-4" />}>
        {data.memberships.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen abonnement toegewezen.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.memberships.map((m) => (
              <li key={m.id}>
                <MembershipCard membership={m} plan={m.plan} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <AssignPlanForm
            tenantId={result.tenant.id}
            memberId={data.member.id}
            plans={activePlans.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      </Section>

      {/* Section 7: Public trainer profile (Sprint 18) */}
      {isTrainerRole && (
        <Section title="Publiek trainer profiel" icon={<Tag className="h-4 w-4" />}>
          <TrainerPublicSettings
            tenantId={result.tenant.id}
            memberId={data.member.id}
            initialShowInPublic={data.member.show_in_public ?? false}
            initialBio={data.member.public_bio ?? ""}
          />
        </Section>
      )}

      {/* Section 6: Payment history */}
      <Section title="Betaalhistorie" icon={<Receipt className="h-4 w-4" />}>
        <PaymentLog payments={data.payments} />
        {data.memberships.length > 0 && (
          <div className="mt-4">
            <LogPaymentForm
              tenantId={result.tenant.id}
              memberships={data.memberships.map((m) => ({
                id: m.id,
                label: m.plan?.name ?? "Onbekend abonnement",
              }))}
            />
          </div>
        )}
      </Section>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <h2
        className="mb-3 inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {icon}
        {label}
      </p>
      <div className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
        {children}
      </div>
    </div>
  );
}
