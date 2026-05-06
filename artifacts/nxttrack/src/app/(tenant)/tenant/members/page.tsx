import Link from "next/link";
import { Users, Archive, ArchiveRestore, ArrowUp, ArrowDown, Download } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  countMembersByTenant,
  getMembersByTenant,
  type MemberSortKey,
  type SortOrder,
} from "@/lib/db/members";
import { getGroupsByTenant } from "@/lib/db/groups";
import { MemberCard } from "@/components/tenant/member-card";
import { AddMemberWizard } from "./_add-member-wizard";
import { getPlansByTenant } from "@/lib/db/membership-plans";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

interface Search {
  status?: string;
  since_from?: string;
  since_to?: string;
  sort?: string;
  order?: string;
  role?: string | string[];
  group?: string;
}

const VALID_SORTS: MemberSortKey[] = [
  "name",
  "status",
  "member_since",
  "archived_at",
  "created_at",
];

const VALID_ROLES = ["parent", "athlete", "trainer", "staff", "volunteer"];

function isUuid(s: string | undefined): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function normalizeRoles(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return Array.from(new Set(arr.filter((r) => VALID_ROLES.includes(r))));
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isValidIsoDate(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // Reject niet-bestaande kalenderdata zoals 2026-99-99 voordat ze in de
  // SQL-query terechtkomen.
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export default async function TenantMembersPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const showArchived = sp.status === "archived";

  const memberSinceFrom = isValidIsoDate(sp.since_from) ? sp.since_from : null;
  const memberSinceTo = isValidIsoDate(sp.since_to) ? sp.since_to : null;
  const selectedRoles = normalizeRoles(sp.role);
  const selectedGroupId = isUuid(sp.group) ? sp.group : null;

  const requestedSort = (sp.sort ?? "") as MemberSortKey;
  const sortBy: MemberSortKey = VALID_SORTS.includes(requestedSort)
    ? requestedSort
    : showArchived
      ? "archived_at"
      : "created_at";
  const sortOrder: SortOrder = sp.order === "asc" ? "asc" : "desc";

  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [members, allGroups, totalCount] = await Promise.all([
    getMembersByTenant(result.tenant.id, {
      onlyArchived: showArchived,
      memberSinceFrom,
      memberSinceTo,
      sortBy,
      sortOrder,
      roles: selectedRoles,
      groupId: selectedGroupId,
    }),
    getGroupsByTenant(result.tenant.id),
    countMembersByTenant(result.tenant.id, { onlyArchived: showArchived }),
  ]);
  const existingParents = members
    .filter((m) => m.roles.includes("parent"))
    .map((m) => ({ id: m.id, full_name: m.full_name }));

  // Sprint D: gate "Voeg toe". Alleen platform_admin, tenant_admin
  // (enum-membership) of een gebruiker met expliciete
  // `members.create` / `members.write` permissie krijgt de knop te zien.
  const isTenantAdminEnum = result.membership?.role === "tenant_admin";
  const explicitPerms = result.isPlatformAdmin || isTenantAdminEnum
    ? []
    : await getUserPermissionsInTenant(result.tenant.id, result.user.id);
  const canAdd =
    result.isPlatformAdmin ||
    isTenantAdminEnum ||
    explicitPerms.includes("members.create") ||
    explicitPerms.includes("members.write");

  // Optionele subscription-keuze tijdens aanmaken: alleen tonen als
  // de tenant lidmaatschapsplannen heeft.
  const allPlans = canAdd ? await getPlansByTenant(result.tenant.id) : [];
  const activePlans = allPlans
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, name: p.name }));

  const appendSharedFilters = (params: URLSearchParams) => {
    if (showArchived) params.set("status", "archived");
    if (memberSinceFrom) params.set("since_from", memberSinceFrom);
    if (memberSinceTo) params.set("since_to", memberSinceTo);
    for (const r of selectedRoles) params.append("role", r);
    if (selectedGroupId) params.set("group", selectedGroupId);
  };

  // Build CSV-export URL die hetzelfde filter + sortering meeneemt.
  const buildExportHref = (): string => {
    const params = new URLSearchParams();
    appendSharedFilters(params);
    params.set("sort", sortBy);
    params.set("order", sortOrder);
    const qs = params.toString();
    return qs
      ? `/tenant/members/export?${qs}`
      : "/tenant/members/export";
  };

  // Helper to build sort-toggle URLs that preserve other query params.
  const buildSortHref = (key: MemberSortKey): string => {
    const params = new URLSearchParams();
    appendSharedFilters(params);
    params.set("sort", key);
    const nextOrder: SortOrder =
      sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    params.set("order", nextOrder);
    const qs = params.toString();
    return qs ? `/tenant/members?${qs}` : "/tenant/members";
  };

  const hasFilter =
    !!memberSinceFrom ||
    !!memberSinceTo ||
    selectedRoles.length > 0 ||
    !!selectedGroupId;

  const filteredCount = members.length;
  const countLabel = hasFilter
    ? `${filteredCount} van ${totalCount} ${totalCount === 1 ? "lid" : "leden"}`
    : `${totalCount} ${totalCount === 1 ? "lid" : "leden"}`;

  const SortIndicator = ({ col }: { col: MemberSortKey }) =>
    sortBy === col ? (
      sortOrder === "asc" ? (
        <ArrowUp className="ml-1 inline h-3 w-3" />
      ) : (
        <ArrowDown className="ml-1 inline h-3 w-3" />
      )
    ) : null;

  return (
    <>
      <PageHeading
        title="Leden"
        description="Beheer ouders, sporters, trainers en staf van deze vereniging."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={
                showArchived
                  ? "/tenant/members"
                  : "/tenant/members?status=archived"
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: showArchived
                  ? "var(--accent)"
                  : "transparent",
                color: "var(--text-primary)",
              }}
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Toon actieve leden
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" /> Toon gearchiveerd
                </>
              )}
            </Link>
            {canAdd && !showArchived ? (
              <AddMemberWizard
                tenantId={result.tenant.id}
                existingParents={existingParents}
                membershipPlans={activePlans}
              />
            ) : null}
          </div>
        }
      />

      {/* Sprint G — datumfilter "Lid sinds". Plain GET-form zodat de URL
          deelbaar/bookmarkbaar blijft en server-render snel is. */}
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border p-3"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        {showArchived ? (
          <input type="hidden" name="status" value="archived" />
        ) : null}
        {sortBy ? <input type="hidden" name="sort" value={sortBy} /> : null}
        <input type="hidden" name="order" value={sortOrder} />
        <label className="flex flex-col text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Lid sinds van
          <input
            type="date"
            name="since_from"
            defaultValue={memberSinceFrom ?? ""}
            className="mt-1 h-9 rounded-lg border px-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-primary)",
            }}
          />
        </label>
        <label className="flex flex-col text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          tot
          <input
            type="date"
            name="since_to"
            defaultValue={memberSinceTo ?? ""}
            className="mt-1 h-9 rounded-lg border px-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-primary)",
            }}
          />
        </label>
        <fieldset
          className="flex flex-col text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          <legend className="mb-1">Rollen</legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {VALID_ROLES.map((role) => (
              <label
                key={role}
                className="inline-flex items-center gap-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                <input
                  type="checkbox"
                  name="role"
                  value={role}
                  defaultChecked={selectedRoles.includes(role)}
                  className="h-3.5 w-3.5"
                />
                <span>{ROLE_LABELS[role] ?? role}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Groep
          <select
            name="group"
            defaultValue={selectedGroupId ?? ""}
            className="mt-1 h-9 rounded-lg border px-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Alle groepen</option>
            {allGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg border px-3 text-xs font-semibold"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          Filter
        </button>
        {hasFilter && (
          <Link
            href={
              showArchived ? "/tenant/members?status=archived" : "/tenant/members"
            }
            className="h-9 self-end rounded-lg px-3 text-xs font-medium leading-9"
            style={{ color: "var(--text-secondary)" }}
          >
            Wis filter
          </Link>
        )}
        <a
          href={buildExportHref()}
          className="ml-auto inline-flex h-9 items-center gap-1.5 self-end rounded-lg border px-3 text-xs font-semibold transition-colors"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-soft)",
            color: "var(--text-primary)",
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Exporteer CSV
        </a>
      </form>

      <div
        className="mb-3 flex items-center justify-between text-sm"
        style={{ color: "var(--text-secondary)" }}
        aria-live="polite"
      >
        <span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {countLabel}
          </span>
          {hasFilter ? " (filters actief)" : ""}
        </span>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={showArchived ? "Geen gearchiveerde leden" : "Nog geen leden"}
          description={
            showArchived
              ? "Er zijn momenteel geen gearchiveerde leden in deze vereniging."
              : "Klik rechtsboven op 'Voeg toe' om het eerste lid aan te maken."
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {members.map((m) => (
              <li key={m.id}>
                <MemberCard
                  member={m}
                  roles={m.roles}
                  groupNames={m.group_names}
                  href={`/tenant/members/${m.id}`}
                />
                {(m.member_since || (showArchived && m.archived_at)) && (
                  <div
                    className="mt-1 px-1 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {m.member_since && (
                      <span>Lid sinds {formatDate(m.member_since)}</span>
                    )}
                    {showArchived && m.archived_at && (
                      <span>
                        {m.member_since ? " · " : ""}
                        Gearchiveerd {formatDate(m.archived_at)}
                        {m.archived_by_email ? ` door ${m.archived_by_email}` : ""}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div
            className="hidden overflow-hidden rounded-2xl border md:block"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead
                  style={{
                    backgroundColor: "var(--surface-soft)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                    <th className="px-5 py-3">
                      <Link href={buildSortHref("name")} className="inline-flex items-center hover:underline">
                        Naam
                        <SortIndicator col="name" />
                      </Link>
                    </th>
                    <th className="px-5 py-3">Rollen</th>
                    <th className="px-5 py-3">
                      <Link href={buildSortHref("status")} className="inline-flex items-center hover:underline">
                        Status
                        <SortIndicator col="status" />
                      </Link>
                    </th>
                    <th className="px-5 py-3">
                      <Link href={buildSortHref("member_since")} className="inline-flex items-center hover:underline">
                        Lid sinds
                        <SortIndicator col="member_since" />
                      </Link>
                    </th>
                    {showArchived ? (
                      <>
                        <th className="px-5 py-3">
                          <Link href={buildSortHref("archived_at")} className="inline-flex items-center hover:underline">
                            Gearchiveerd op
                            <SortIndicator col="archived_at" />
                          </Link>
                        </th>
                        <th className="px-5 py-3">Door</th>
                      </>
                    ) : (
                      <th className="px-5 py-3">Groepen</th>
                    )}
                    <th className="px-5 py-3 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y"
                  style={{ borderColor: "var(--surface-border)" }}
                >
                  {members.map((m) => (
                    <tr key={m.id} style={{ color: "var(--text-primary)" }}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{m.full_name}</p>
                        {m.email && (
                          <p
                            className="text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {m.email}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {m.roles.length > 0
                          ? m.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={m.member_status} />
                      </td>
                      <td
                        className="px-5 py-3 text-xs whitespace-nowrap"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDate(m.member_since)}
                      </td>
                      {showArchived ? (
                        <>
                          <td
                            className="px-5 py-3 text-xs whitespace-nowrap"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {formatDate(m.archived_at)}
                          </td>
                          <td
                            className="px-5 py-3 text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {m.archived_by_email ?? "—"}
                          </td>
                        </>
                      ) : (
                        <td
                          className="px-5 py-3 text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {m.group_names.length > 0 ? m.group_names.join(", ") : "—"}
                        </td>
                      )}
                      <td className="px-5 py-3 text-right">
                        <a
                          href={`/tenant/members/${m.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Bekijk
                        </a>
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
