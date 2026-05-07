import Link from "next/link";
import {
  Users,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  countFilteredMembersByTenant,
  getMembersByTenant,
  type MemberSortKey,
  type SortOrder,
} from "@/lib/db/members";
import { getGroupsByTenant } from "@/lib/db/groups";
import { MemberCard } from "@/components/tenant/member-card";
import { AddMemberWizard } from "./_add-member-wizard";
import { getPlansByTenant } from "@/lib/db/membership-plans";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import {
  MembersFilterSheet,
  ActiveFiltersStrip,
} from "./_filter-sheet";

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
  plan?: string;
  q?: string;
  st?: string | string[];
  page?: string;
  size?: string;
}

const VALID_SORTS: MemberSortKey[] = [
  "name",
  "status",
  "member_since",
  "archived_at",
  "created_at",
];
const VALID_ROLES = ["parent", "athlete", "trainer", "staff", "volunteer"];
const VALID_STATUSES = [
  "prospect",
  "invited",
  "aspirant",
  "pending",
  "active",
  "paused",
  "inactive",
  "cancelled",
];
const VALID_PAGE_SIZES = [25, 50, 100] as const;

function isUuid(s: string | undefined): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function normalizeMulti(raw: string | string[] | undefined, allowed: string[]): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return Array.from(new Set(arr.filter((r) => allowed.includes(r))));
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
  const selectedRoles = normalizeMulti(sp.role, VALID_ROLES);
  const selectedStatuses = normalizeMulti(sp.st, VALID_STATUSES);
  const selectedGroupId = isUuid(sp.group) ? sp.group : null;
  const selectedPlanId = isUuid(sp.plan) ? sp.plan : null;
  const search = (sp.q ?? "").toString().slice(0, 120);

  const requestedSort = (sp.sort ?? "") as MemberSortKey;
  const sortBy: MemberSortKey = VALID_SORTS.includes(requestedSort)
    ? requestedSort
    : showArchived
      ? "archived_at"
      : "created_at";
  const sortOrder: SortOrder = sp.order === "asc" ? "asc" : "desc";

  const requestedSize = Number.parseInt(sp.size ?? "", 10);
  const pageSize: number = (VALID_PAGE_SIZES as readonly number[]).includes(requestedSize)
    ? requestedSize
    : 25;
  const requestedPage = Number.parseInt(sp.page ?? "", 10);
  const requestedPageSafe =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const terminology = await getTenantTerminology(result.tenant.id);

  const filterOpts = {
    onlyArchived: showArchived,
    memberSinceFrom,
    memberSinceTo,
    sortBy,
    sortOrder,
    roles: selectedRoles,
    groupId: selectedGroupId,
    planId: selectedPlanId,
    search,
    statuses: selectedStatuses,
  };

  // First clamp page using the count, then fetch the page itself.
  const [allGroups, allPlans, totalCount, parentsAll] = await Promise.all([
    getGroupsByTenant(result.tenant.id),
    getPlansByTenant(result.tenant.id),
    countFilteredMembersByTenant(result.tenant.id, filterOpts),
    // Unpaginated parent set for AddMemberWizard — must not depend on
    // current page/filter state so the wizard always shows all parents.
    getMembersByTenant(result.tenant.id, { roles: ["parent"] }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, requestedPageSafe), totalPages);

  const members = await getMembersByTenant(result.tenant.id, {
    ...filterOpts,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });

  const existingParents = parentsAll.map((m) => ({
    id: m.id,
    full_name: m.full_name,
  }));

  const isTenantAdminEnum = result.membership?.role === "tenant_admin";
  const explicitPerms = result.isPlatformAdmin || isTenantAdminEnum
    ? []
    : await getUserPermissionsInTenant(result.tenant.id, result.user.id);
  const canAdd =
    result.isPlatformAdmin ||
    isTenantAdminEnum ||
    explicitPerms.includes("members.create") ||
    explicitPerms.includes("members.write");

  const activePlans = allPlans
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, name: p.name }));

  const buildHref = (overrides: Record<string, string | null>): string => {
    const params = new URLSearchParams();
    if (showArchived) params.set("status", "archived");
    if (memberSinceFrom) params.set("since_from", memberSinceFrom);
    if (memberSinceTo) params.set("since_to", memberSinceTo);
    for (const r of selectedRoles) params.append("role", r);
    for (const s of selectedStatuses) params.append("st", s);
    if (selectedGroupId) params.set("group", selectedGroupId);
    if (selectedPlanId) params.set("plan", selectedPlanId);
    if (search) params.set("q", search);
    params.set("sort", sortBy);
    params.set("order", sortOrder);
    if (pageSize !== 25) params.set("size", String(pageSize));
    if (page !== 1) params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/tenant/members?${qs}` : "/tenant/members";
  };

  const buildExportHref = (): string => {
    const params = new URLSearchParams();
    if (showArchived) params.set("status", "archived");
    if (memberSinceFrom) params.set("since_from", memberSinceFrom);
    if (memberSinceTo) params.set("since_to", memberSinceTo);
    for (const r of selectedRoles) params.append("role", r);
    if (selectedGroupId) params.set("group", selectedGroupId);
    if (search) params.set("q", search);
    params.set("sort", sortBy);
    params.set("order", sortOrder);
    const qs = params.toString();
    return qs ? `/tenant/members/export?${qs}` : "/tenant/members/export";
  };

  const buildSortHref = (key: MemberSortKey): string => {
    const nextOrder: SortOrder =
      sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    return buildHref({ sort: key, order: nextOrder, page: null });
  };

  const safePage = page;
  const fromIdx = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = totalCount === 0 ? 0 : Math.min(totalCount, safePage * pageSize);

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
        title={terminology.member_plural}
        description={terminology.members_page_description}
        actions={
          <div className="flex items-center gap-2">
            <MembersFilterSheet
              groups={allGroups.map((g) => ({ id: g.id, name: g.name }))}
              plans={activePlans}
              showArchived={showArchived}
            />
            <a
              href={buildExportHref()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: "var(--surface-soft)",
                color: "var(--text-primary)",
              }}
            >
              <Download className="h-3.5 w-3.5" /> Exporteer CSV
            </a>
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

      <ActiveFiltersStrip
        groups={allGroups.map((g) => ({ id: g.id, name: g.name }))}
        plans={activePlans}
      />

      <div
        className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm"
        style={{ color: "var(--text-secondary)" }}
        aria-live="polite"
      >
        <span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {totalCount === 0
              ? "Geen resultaten"
              : `${fromIdx}–${toIdx} van ${totalCount}`}
          </span>
          {totalCount > 0 ? (totalCount === 1 ? " lid" : " leden") : ""}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs">Per pagina:</span>
          {VALID_PAGE_SIZES.map((s) => (
            <Link
              key={s}
              href={buildHref({ size: String(s), page: null })}
              className="rounded-lg border px-2 py-0.5 text-xs"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: pageSize === s ? "var(--accent)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={showArchived ? "Geen gearchiveerde leden" : "Geen leden gevonden"}
          description={
            showArchived
              ? "Er zijn momenteel geen gearchiveerde leden in deze vereniging."
              : "Pas de filters aan of voeg een nieuw lid toe via de knop rechtsboven."
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

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Paginatie"
              className="mt-4 flex items-center justify-center gap-1"
            >
              <PaginationLink
                href={safePage > 1 ? buildHref({ page: String(safePage - 1) }) : null}
                label="Vorige"
              />
              <span
                className="px-3 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Pagina {safePage} van {totalPages}
              </span>
              <PaginationLink
                href={
                  safePage < totalPages
                    ? buildHref({ page: String(safePage + 1) })
                    : null
                }
                label="Volgende"
              />
            </nav>
          )}
        </>
      )}
    </>
  );
}

function PaginationLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span
        className="rounded-lg border px-3 py-1 text-xs opacity-50"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
      }}
    >
      {label}
    </Link>
  );
}
