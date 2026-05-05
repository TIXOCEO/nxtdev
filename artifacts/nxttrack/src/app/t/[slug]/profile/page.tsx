import { notFound, redirect } from "next/navigation";
import { UserRound, Layers, Bell, Smartphone } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext } from "@/lib/auth/user-role-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { ProfileClientStatus } from "./_status";
import { ProfileShell } from "./_profile-shell";
import { getMemberFinancialDetails } from "@/lib/db/financial-details";
import { getActivePaymentMethods } from "@/lib/db/payment-methods";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";
import { getMemberships } from "@/lib/auth/get-memberships";
import { isPlatformAdmin, isTenantAdmin } from "@/lib/permissions";
import { maskIban } from "@/lib/iban";
import type { MemberProfilePicture } from "@/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  parent: "Ouder",
  athlete: "Atleet",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();
  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/profile`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  const admin = createAdminClient();

  const primary = ctx.members[0] ?? null;
  if (!primary) {
    // User is logged in but heeft geen member in deze tenant — render een
    // minimale variant met enkel status-info zodat de pagina niet faalt.
    return (
      <PublicTenantShell tenant={tenant} pageTitle="Mijn profiel" active="profile">
        <p
          className="rounded-2xl border p-4 text-sm"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          Je hebt nog geen ledenprofiel bij deze vereniging.
        </p>
      </PublicTenantShell>
    );
  }

  // Groups for own member rows.
  const memberIds = ctx.members.map((m) => m.id);
  let groupNames: string[] = [];
  if (memberIds.length > 0) {
    const { data } = await admin
      .from("group_members")
      .select("groups!inner(id, tenant_id, name)")
      .in("member_id", memberIds);
    type RawRow = { groups: { name: string } | { name: string }[] | null };
    const rows = (data ?? []) as unknown as RawRow[];
    groupNames = Array.from(
      new Set(
        rows
          .flatMap((r) => (Array.isArray(r.groups) ? r.groups : r.groups ? [r.groups] : []))
          .map((g) => g.name)
          .filter((n): n is string => !!n),
      ),
    );
  }

  // Profile picture (first own member only — typical case).
  let profilePicId: string | null = null;
  const { data: pic } = await admin
    .from("member_profile_pictures")
    .select("template_id")
    .eq("member_id", primary.id)
    .maybeSingle();
  profilePicId = (pic as Pick<MemberProfilePicture, "template_id"> | null)?.template_id ?? null;

  // Financial + payment methods + permissions.
  const [memberships, perms, financialRow, paymentMethods] = await Promise.all([
    getMemberships(user.id),
    getUserPermissionsInTenant(tenant.id, user.id),
    getMemberFinancialDetails(primary.id, tenant.id),
    getActivePaymentMethods(tenant.id),
  ]);

  const platformOrTenantAdmin =
    isPlatformAdmin(memberships) || isTenantAdmin(memberships, tenant.id);
  const ownsMember = primary.user_id === user.id;
  const canViewIban =
    ownsMember || platformOrTenantAdmin || perms.includes("members.financial.view");
  const canManageIban =
    ownsMember || platformOrTenantAdmin || perms.includes("members.financial.manage");

  const isParentRole =
    ctx.roles.includes("parent") || ctx.children.length > 0 || primary.account_type === "parent";
  const isAthleteOrTrainer =
    ctx.roles.includes("athlete") ||
    ctx.roles.includes("trainer") ||
    primary.account_type === "adult_athlete" ||
    primary.account_type === "trainer";

  // Derived athlete code (geen kolom op members; UUID-prefix als korte
  // identifier zodat trainers/admins een lid snel terug kunnen vinden).
  const athleteCodeDisplay = isAthleteOrTrainer
    ? `ATH-${primary.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
    : null;

  // Children with player_type voor mooiere lijst.
  let childrenVM: { id: string; full_name: string; player_type: string | null }[] = [];
  if (ctx.children.length > 0) {
    childrenVM = ctx.children.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      player_type: c.player_type ?? null,
    }));
  }

  const primaryName = primary.full_name ?? user.email ?? "Lid";

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Mijn profiel" active="profile">
      <div className="space-y-4">
        <header
          className="flex items-center gap-4 rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
              color: "var(--tenant-accent)",
            }}
          >
            <UserRound className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {primaryName}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
              {user.email}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {ctx.roles.length === 0 ? (
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Geen rollen toegekend
                </span>
              ) : (
                ctx.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {ROLE_LABEL[r] ?? r}
                  </span>
                ))
              )}
            </div>
          </div>
        </header>

        <ProfileShell
          tenantId={tenant.id}
          primaryMember={{
            id: primary.id,
            first_name: primary.first_name,
            last_name: primary.last_name,
            phone: primary.phone,
            birth_date: primary.birth_date,
            gender: primary.gender,
            street: primary.street,
            house_number: primary.house_number,
            postal_code: primary.postal_code,
            city: primary.city,
            email: primary.email,
          }}
          sportMember={
            isAthleteOrTrainer
              ? { id: primary.id, player_type: primary.player_type }
              : null
          }
          financial={
            financialRow
              ? {
                  has_iban: !!financialRow.iban,
                  iban_masked: financialRow.iban ? maskIban(financialRow.iban) : null,
                  account_holder_name: financialRow.account_holder_name,
                  payment_method_id: financialRow.payment_method_id,
                }
              : null
          }
          paymentMethods={paymentMethods}
          isParent={isParentRole}
          isAthleteOrTrainer={isAthleteOrTrainer}
          canViewIban={canViewIban}
          canManageIban={canManageIban}
          children={childrenVM}
          athleteCodeDisplay={athleteCodeDisplay}
        />

        {groupNames.length > 0 && (
          <Section icon={Layers} title="Mijn groepen">
            <div className="flex flex-wrap gap-1">
              {groupNames.map((g) => (
                <span
                  key={g}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--surface-soft)",
                    color: "var(--text-primary)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section icon={Bell} title="Pushmeldingen">
          <ProfileClientStatus kind="push" />
        </Section>

        <Section icon={Smartphone} title="App geïnstalleerd">
          <ProfileClientStatus kind="install" />
        </Section>

        {profilePicId !== null && (
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Profielafbeelding: {profilePicId ?? "standaard"}
          </p>
        )}
      </div>
    </PublicTenantShell>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: "var(--tenant-accent)" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
