import Link from "next/link";
import {
  Mail,
  Phone,
  CreditCard,
  Receipt,
  UsersRound,
  Link2,
  Tag,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { GroupSelector } from "@/components/tenant/group-selector";
import { MembershipCard } from "@/components/tenant/membership-card";
import { PaymentsTable } from "@/components/tenant/payments-table";
import { EndMembershipButton } from "@/components/tenant/end-membership-button";
import { UpcomingPaymentCard } from "@/components/tenant/upcoming-payment-card";
import { TrainerPublicSettings } from "@/components/tenant/members/trainer-public-settings";
import { FinancialTab } from "@/app/t/[slug]/profile/_financial-tab";
import { maskIban } from "@/lib/iban";
import {
  computeUpcomingPayment,
  pickVisibleUpcoming,
} from "@/lib/payments/upcoming";
import type {
  Member,
  MemberMembership,
  MembershipPaymentLog,
  MembershipPlan,
  PaymentMethod,
  EmailLog,
  Group,
  MemberFinancialDetails,
} from "@/types/database";
import type { AuditLogRow } from "@/lib/db/audit-logs";
import { AdminMemberEditForm } from "./_admin-edit-form";
import { MemberRolesChips } from "./_member-roles-chips";
import {
  LinkChildForm,
  AssignPlanForm,
  GenerateMinorCodeButton,
} from "./_member-detail-actions";
import { UnlinkChildButton } from "./_archive-controls";

const PLAYER_TYPE_LABEL: Record<string, string> = {
  player: "Veldspeler",
  goalkeeper: "Keeper",
};

// ── Overzicht ───────────────────────────────────────────────
export function OverviewTab({
  tenantId,
  member,
  roles,
  athleteCodeDisplay,
  canEditRoles,
}: {
  tenantId: string;
  member: Member;
  roles: string[];
  athleteCodeDisplay: string | null;
  canEditRoles: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card title="Basisinformatie">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Status">
            <StatusBadge status={member.member_status} />
          </Stat>
          <Stat label="E-mail" icon={<Mail className="h-3.5 w-3.5" />}>
            {member.email ?? "—"}
          </Stat>
          <Stat label="Telefoon" icon={<Phone className="h-3.5 w-3.5" />}>
            {member.phone ?? "—"}
          </Stat>
          <Stat label="Aangemaakt">
            {new Date(member.created_at).toLocaleDateString("nl-NL")}
          </Stat>
          {member.member_since && (
            <Stat label="Lid sinds">
              {new Date(member.member_since).toLocaleDateString("nl-NL")}
            </Stat>
          )}
          {athleteCodeDisplay && (
            <Stat label="Persoonlijke code">
              <span className="font-mono">{athleteCodeDisplay}</span>
            </Stat>
          )}
        </div>
      </Card>

      <Card title="Rollen" icon={<Tag className="h-4 w-4" />}>
        <MemberRolesChips
          tenantId={tenantId}
          memberId={member.id}
          initialRoles={roles as ("parent" | "athlete" | "trainer" | "staff" | "volunteer")[]}
          readOnly={!canEditRoles}
        />
      </Card>

      {member.notes && (
        <Card title="Notities">
          <p
            className="whitespace-pre-wrap text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            {member.notes}
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Persoonlijk ─────────────────────────────────────────────
export function PersonalTab({
  tenantId,
  member,
}: {
  tenantId: string;
  member: Member;
}) {
  return (
    <Card title="Persoonsgegevens & adres">
      <AdminMemberEditForm tenantId={tenantId} member={member} />
    </Card>
  );
}

// ── Sport ───────────────────────────────────────────────────
export function SportTab({
  tenantId,
  member,
  allGroups,
  currentGroups,
  isTrainerRole,
  athleteCodeDisplay,
}: {
  tenantId: string;
  member: Member;
  allGroups: Group[];
  currentGroups: Group[];
  isTrainerRole: boolean;
  athleteCodeDisplay: string | null;
}) {
  return (
    <div className="space-y-4">
      <Card title="Sportprofiel" icon={<Tag className="h-4 w-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Type speler">
            {member.player_type
              ? PLAYER_TYPE_LABEL[member.player_type] ?? member.player_type
              : "—"}
          </Stat>
          {athleteCodeDisplay && (
            <Stat label="Persoonlijke code">
              <span className="font-mono">{athleteCodeDisplay}</span>
            </Stat>
          )}
          <Stat label="Geboortedatum">
            {member.birth_date
              ? new Date(member.birth_date).toLocaleDateString("nl-NL")
              : "—"}
          </Stat>
        </div>
      </Card>

      <Card title="Groepen" icon={<UsersRound className="h-4 w-4" />}>
        <GroupSelector
          tenantId={tenantId}
          memberId={member.id}
          currentGroups={currentGroups}
          allGroups={allGroups}
        />
      </Card>

      {isTrainerRole && (
        <Card title="Publiek trainer profiel" icon={<Tag className="h-4 w-4" />}>
          <TrainerPublicSettings
            tenantId={tenantId}
            memberId={member.id}
            initialShowInPublic={member.show_in_public ?? false}
            initialBio={member.public_bio ?? ""}
          />
        </Card>
      )}
    </div>
  );
}

// ── Familie ─────────────────────────────────────────────────
export function FamilyTab({
  tenantId,
  member,
  parents,
  children,
  isAthleteRole,
  isParentRole,
  linkableChildren,
}: {
  tenantId: string;
  member: Member;
  parents: Array<{ id: string; full_name: string }>;
  children: Array<{ id: string; full_name: string }>;
  isAthleteRole: boolean;
  isParentRole: boolean;
  linkableChildren: Array<{ id: string; full_name: string }>;
}) {
  return (
    <Card title="Ouders & kinderen" icon={<Link2 className="h-4 w-4" />}>
      {isAthleteRole && (
        <div className="space-y-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Ouder(s)
          </h3>
          {parents.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Nog geen ouder gekoppeld.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {parents.map((p) => (
                <li key={p.id} className="flex flex-col items-start gap-0.5">
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
                  <UnlinkChildButton
                    tenantId={tenantId}
                    parentMemberId={p.id}
                    childMemberId={member.id}
                    childName={member.full_name}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(isParentRole || children.length > 0) && (
        <div className="mt-4 space-y-2">
          <h3
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Kind(eren)
          </h3>
          {children.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Nog geen kind gekoppeld.
            </p>
          ) : (
            <ul className="space-y-2">
              {children.map((c) => (
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
                  <div className="flex flex-wrap items-center gap-3">
                    <GenerateMinorCodeButton
                      tenantId={tenantId}
                      parentMemberId={member.id}
                      childMemberId={c.id}
                      childName={c.full_name}
                    />
                    <UnlinkChildButton
                      tenantId={tenantId}
                      parentMemberId={member.id}
                      childMemberId={c.id}
                      childName={c.full_name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <LinkChildForm
            tenantId={tenantId}
            parentMemberId={member.id}
            candidates={linkableChildren}
          />
        </div>
      )}

      {!isAthleteRole && !isParentRole && children.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen familierelaties geregistreerd.
        </p>
      )}
    </Card>
  );
}

// ── Abonnement & Betalingen ────────────────────────────────
export interface BillingTabProps {
  tenantId: string;
  member: Member;
  memberships: Array<MemberMembership & { plan: MembershipPlan | null }>;
  payments: MembershipPaymentLog[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string | null;
  activePlans: Array<{ id: string; name: string }>;
  financial: MemberFinancialDetails | null;
  canViewFinancial: boolean;
  canManageFinancial: boolean;
}

export function BillingTab({
  tenantId,
  member,
  memberships,
  payments,
  paymentMethods,
  defaultPaymentMethodId,
  activePlans,
  financial,
  canViewFinancial,
  canManageFinancial,
}: BillingTabProps) {
  const upcoming = pickVisibleUpcoming(
    memberships.map((m) =>
      computeUpcomingPayment({
        membership: m,
        plan: m.plan ?? null,
        paymentMethods,
        payments,
      }),
    ),
  );

  return (
    <div className="space-y-4">
      {canViewFinancial && (
        <Card title="Financieel" icon={<CreditCard className="h-4 w-4" />}>
          <FinancialTab
            tenantId={tenantId}
            memberId={member.id}
            initial={
              financial
                ? {
                    has_iban: !!financial.iban,
                    iban_masked: financial.iban
                      ? maskIban(financial.iban)
                      : null,
                    account_holder_name: financial.account_holder_name,
                    payment_method_id: financial.payment_method_id,
                  }
                : null
            }
            paymentMethods={paymentMethods}
            canViewIban={canViewFinancial}
            canManageIban={canManageFinancial}
          />
        </Card>
      )}

      <Card title="Abonnement" icon={<CreditCard className="h-4 w-4" />}>
        {memberships.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen abonnement toegewezen.
          </p>
        ) : (
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.id} className="space-y-2">
                <MembershipCard membership={m} plan={m.plan} />
                {m.status === "active" && (
                  <div className="flex justify-end">
                    <EndMembershipButton
                      tenantId={tenantId}
                      memberMembershipId={m.id}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <AssignPlanForm
            tenantId={tenantId}
            memberId={member.id}
            plans={activePlans}
          />
        </div>
      </Card>

      <Card title="Betalingen" icon={<Receipt className="h-4 w-4" />}>
        {upcoming.length > 0 && (
          <div className="mb-4 space-y-2">
            {upcoming.map((u) => (
              <UpcomingPaymentCard key={u.member_membership_id} upcoming={u} />
            ))}
          </div>
        )}
        <PaymentsTable
          tenantId={tenantId}
          memberId={member.id}
          memberships={memberships}
          payments={payments}
          paymentMethods={paymentMethods}
          defaultPaymentMethodId={defaultPaymentMethodId}
        />
      </Card>
    </div>
  );
}

// ── Communicatie ───────────────────────────────────────────
export function CommunicationTab({ logs }: { logs: EmailLog[] }) {
  if (logs.length === 0) {
    return (
      <Card title="Communicatie">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen e-mailhistorie gevonden voor dit lid.
        </p>
      </Card>
    );
  }
  return (
    <Card title="E-mail historie">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ color: "var(--text-secondary)" }}>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide">
              <th className="py-2 pr-3">Datum</th>
              <th className="py-2 pr-3">Onderwerp</th>
              <th className="py-2 pr-3">Template</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {logs.map((l) => (
              <tr key={l.id} style={{ color: "var(--text-primary)" }}>
                <td className="py-2 pr-3 text-xs whitespace-nowrap">
                  {new Date(l.sent_at).toLocaleString("nl-NL")}
                </td>
                <td className="py-2 pr-3">{l.subject ?? "—"}</td>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {l.template_key ?? "—"}
                </td>
                <td className="py-2 pr-3 text-xs">
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      backgroundColor:
                        l.status === "sent"
                          ? "color-mix(in oklab, #16a34a 18%, var(--surface-soft))"
                          : "color-mix(in oklab, #dc2626 22%, var(--surface-soft))",
                      color: "var(--text-primary)",
                    }}
                  >
                    {l.status === "sent" ? "Verzonden" : "Mislukt"}
                  </span>
                  {l.error_message && (
                    <span className="ml-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {l.error_message}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Logboek ────────────────────────────────────────────────
const ACTION_LABEL: Record<string, string> = {
  "member.create": "Lid aangemaakt",
  "member.update": "Lid bijgewerkt",
  "member.archive": "Lid gearchiveerd",
  "member.unarchive": "Lid hersteld",
  "member.role.add": "Rol toegevoegd",
  "member.role.remove": "Rol verwijderd",
  "member.group.add": "Toegevoegd aan groep",
  "member.group.remove": "Verwijderd uit groep",
  "member.parent.link": "Ouder gekoppeld",
  "member.parent.unlink": "Ouder ontkoppeld",
  "member.membership.assign": "Abonnement toegewezen",
  "member.membership.end": "Abonnement beëindigd",
  "member.payment.create": "Betaling vastgelegd",
  "member.payment.update": "Betaling bijgewerkt",
  "member.payment.delete": "Betaling verwijderd",
  "member.financial.update": "Financieel bijgewerkt",
};

export function AuditTab({ logs }: { logs: AuditLogRow[] }) {
  if (logs.length === 0) {
    return (
      <Card title="Logboek">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen activiteiten geregistreerd voor dit lid.
        </p>
      </Card>
    );
  }
  return (
    <Card title="Activiteit logboek">
      <ul className="space-y-2">
        {logs.map((l) => (
          <li
            key={l.id}
            className="rounded-xl border p-3 text-sm"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {ACTION_LABEL[l.action] ?? l.action}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {new Date(l.created_at).toLocaleString("nl-NL")}
              </span>
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {l.actor_email ? `Door ${l.actor_email}` : "Door systeem"}
              {Object.keys(l.meta).length > 0 && (
                <span className="ml-2 font-mono">
                  {JSON.stringify(l.meta)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Building blocks ────────────────────────────────────────
function Card({
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
