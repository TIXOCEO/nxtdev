import Link from "next/link";
import {
  Users,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
  Download,
  Layers,
  UserCheck,
} from "lucide-react";
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
import {
  TenantAdminHero,
  TenantAdminMetric,
  TenantAdminSurface,
} from "@/components/tenant/tenant-backoffice-components";

export const dynamic = "force-dynamic";

// Sprint 38 — `athlete` haalt zijn label uit terminology zodat
// niet-voetbal sectoren (zwemschool → "Leerling", generic → "Deelnemer")
// niet langer "Speler" te zien krijgen. Andere rol-labels blijven NL
// generiek; instructor-naam wordt ook sector-aware gerenderd.
function buildRoleLabels(t: {
  participant_singular: string;
  guardian_singular: string;
  instructor_singular: string;
}): Record<string, string> {
  return {
    parent: t.guardian_singular,
    athlete: t.participant_singular,
    trainer: t.instructor_singular,
    staff: "Staf",
    volunteer: "Vrijwilliger",
  };
}

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
  const roleLabels = buildRoleLabels(terminology);

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
      <TenantAdminHero
        title={terminology.member_plural}
        description={terminology.members_page_description}
        action={
          <div className="flex items-center gap-2">
            <MembersFilterSheet
              groups={allGroups.map((g) => ({ id: g.id, name: g.name }))}
              plans={activePlans}
              showArchived={showArchived}
            />
            <a
              href={buildExportHref()}
              className="nxt-focus-ring nxt-shell-soft-button inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Exporteer CSV
            </a>
            <Link
              href={
                showArchived
                  ? "/tenant/members"
                  : "/tenant/members?status=archived"
              }
              className="nxt-focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors"
              style={{
                borderColor: "var(--shell-border)",
                backgroundColor: showArchived
                  ? "color-mix(in srgb, var(--shell-info) 12%, var(--shell-panel-strong))"
                  : "var(--shell-panel-strong)",
                color: showArchived ? "var(--shell-info)" : "var(--text-primary)",
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
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TenantAdminMetric
            label="Resultaten"
            value={totalCount}
            hint={showArchived ? "In archief" : "Actieve selectie"}
            icon={Users}
            tone="info"
          />
          <TenantAdminMetric
            label="Deze pagina"
            value={members.length}
            hint={`${fromIdx}-${toIdx} zichtbaar`}
            icon={UserCheck}
            tone="success"
          />
          <TenantAdminMetric
            label="Groepen"
            value={allGroups.length}
            hint="Beschikbaar voor filters"
            icon={Layers}
          />
          <TenantAdminMetric
            label="Plannen"
            value={activePlans.length}
            hint="Actieve abonnementen"
            icon={Archive}
            tone="warning"
          />
        </div>
      </TenantAdminHero>

      <ActiveFiltersStrip
        groups={allGroups.map((g) => ({ id: g.id, name: g.name }))}
        plans={activePlans}
      />

      <TenantAdminSurface
        className="mb-3 flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
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
              className="nxt-focus-ring rounded-xl border px-2.5 py-1 text-xs font-bold"
              style={{
                borderColor: pageSize === s
                  ? "color-mix(in srgb, var(--shell-info) 38%, transparent)"
                  : "var(--shell-border)",
                backgroundColor: pageSize === s
                  ? "color-mix(in srgb, var(--shell-info) 12%, var(--shell-panel-strong))"
                  : "var(--shell-panel-strong)",
                color: pageSize === s ? "var(--shell-info)" : "var(--text-primary)",
              }}
            >
              {s}
            </Link>
          ))}
        </div>
      </TenantAdminSurface>

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
          <ul className="grid gap-3 md:hidden">
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
          <TenantAdminSurface className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead
                  style={{
                    backgroundColor: "var(--shell-panel-muted)",
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
                  style={{ borderColor: "var(--shell-border)" }}
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
                          ? m.roles.map((r) => roleLabels[r] ?? r).join(", ")
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
                          className="nxt-focus-ring inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors"
                          style={{ borderColor: "var(--shell-border)", color: "var(--shell-info)" }}
                        >
                          Bekijk
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TenantAdminSurface>

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
        className="rounded-xl border px-3 py-1.5 text-xs font-semibold opacity-50"
        style={{
          borderColor: "var(--shell-border)",
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
      className="nxt-focus-ring rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors"
      style={{
        borderColor: "var(--shell-border)",
        backgroundColor: "var(--shell-panel-strong)",
        color: "var(--shell-info)",
      }}
    >
      {label}
    </Link>
  );
}
