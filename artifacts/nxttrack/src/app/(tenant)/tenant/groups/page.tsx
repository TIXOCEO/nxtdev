import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  UsersRound,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getGroupsPage,
  type GroupSortKey,
  type SortOrder,
} from "@/lib/db/groups";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { NewGroupDialog } from "./_new-group-dialog";
import { AddMemberPopover } from "./_add-member-popover";

export const dynamic = "force-dynamic";

interface Search {
  q?: string;
  sort?: string;
  order?: string;
  page?: string;
  size?: string;
}

const VALID_SORTS: GroupSortKey[] = [
  "name",
  "member_count",
  "trainer_count",
  "updated_at",
];
const VALID_PAGE_SIZES = [25, 50, 100] as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function TenantGroupsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const search = (sp.q ?? "").toString().slice(0, 120);
  const requestedSort = (sp.sort ?? "") as GroupSortKey;
  const sortBy: GroupSortKey = VALID_SORTS.includes(requestedSort)
    ? requestedSort
    : "name";
  const sortOrder: SortOrder = sp.order === "desc" ? "desc" : "asc";

  const requestedSize = Number.parseInt(sp.size ?? "", 10);
  const pageSize: number = (VALID_PAGE_SIZES as readonly number[]).includes(
    requestedSize,
  )
    ? requestedSize
    : 25;
  const requestedPage = Number.parseInt(sp.page ?? "", 10);
  const safePage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Sprint 42 — eerst totaal ophalen om de paginering te clampen, anders
  // levert ?page=9999 een lege pagina terwijl er wel resultaten zijn.
  const probe = await getGroupsPage(result.tenant.id, {
    search,
    sortBy,
    sortOrder,
    offset: 0,
    limit: 1,
  });
  const totalPages = Math.max(1, Math.ceil(probe.total / pageSize));
  const page = Math.min(safePage, totalPages);
  const { rows, total } = await getGroupsPage(result.tenant.id, {
    search,
    sortBy,
    sortOrder,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIdx = total === 0 ? 0 : Math.min(total, page * pageSize);

  const terminology = await getTenantTerminology(result.tenant.id);

  const buildHref = (overrides: Record<string, string | null>): string => {
    const params = new URLSearchParams();
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
    return qs ? `/tenant/groups?${qs}` : "/tenant/groups";
  };

  const buildSortHref = (key: GroupSortKey): string => {
    const nextOrder: SortOrder =
      sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    return buildHref({ sort: key, order: nextOrder, page: null });
  };

  const SortIndicator = ({ col }: { col: GroupSortKey }) =>
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
        title={terminology.group_plural}
        description={terminology.groups_page_description}
        actions={<NewGroupDialog tenantId={result.tenant.id} />}
      />

      <form
        action="/tenant/groups"
        method="get"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="relative max-w-md flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-secondary)" }}
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Zoek op naam of omschrijving…"
            className="h-9 w-full rounded-xl border bg-transparent pl-7 pr-3 text-sm outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          />
          <input type="hidden" name="sort" value={sortBy} />
          <input type="hidden" name="order" value={sortOrder} />
          {pageSize !== 25 && (
            <input type="hidden" name="size" value={String(pageSize)} />
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Per pagina:
          </span>
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
      </form>

      <div
        className="mt-3 text-xs"
        style={{ color: "var(--text-secondary)" }}
        aria-live="polite"
      >
        {total === 0
          ? "Geen groepen gevonden"
          : `${fromIdx}–${toIdx} van ${total}`}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Nog geen groepen"
          description={
            search
              ? "Geen groepen die voldoen aan de zoekopdracht."
              : "Maak je eerste groep aan via de knop \"Nieuwe groep\" rechtsboven."
          }
        />
      ) : (
        <div
          className="mt-3 hidden overflow-hidden rounded-2xl border md:block"
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
                    <Link
                      href={buildSortHref("name")}
                      className="inline-flex items-center hover:underline"
                    >
                      Naam <SortIndicator col="name" />
                    </Link>
                  </th>
                  <th className="px-5 py-3">Omschrijving</th>
                  <th className="px-5 py-3">
                    <Link
                      href={buildSortHref("member_count")}
                      className="inline-flex items-center hover:underline"
                    >
                      Leden <SortIndicator col="member_count" />
                    </Link>
                  </th>
                  <th className="px-5 py-3">Atleten</th>
                  <th className="px-5 py-3">
                    <Link
                      href={buildSortHref("trainer_count")}
                      className="inline-flex items-center hover:underline"
                    >
                      Trainers <SortIndicator col="trainer_count" />
                    </Link>
                  </th>
                  <th className="px-5 py-3">
                    <Link
                      href={buildSortHref("updated_at")}
                      className="inline-flex items-center hover:underline"
                    >
                      Laatst gewijzigd <SortIndicator col="updated_at" />
                    </Link>
                  </th>
                  <th className="px-5 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody
                className="divide-y"
                style={{ borderColor: "var(--surface-border)" }}
              >
                {rows.map((g) => {
                  const isFull =
                    (g.max_members != null && g.member_count >= g.max_members) ||
                    (g.max_athletes != null && g.athlete_count >= g.max_athletes);
                  const fullTooltip =
                    g.max_athletes != null && g.athlete_count >= g.max_athletes
                      ? `Maximum atleten bereikt (${g.max_athletes})`
                      : g.max_members != null
                        ? `Groep is vol (${g.max_members})`
                        : "Groep is vol";
                  return (
                    <tr key={g.id} style={{ color: "var(--text-primary)" }}>
                      <td className="px-5 py-3 font-medium">{g.name}</td>
                      <td
                        className="px-5 py-3 text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {g.description ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap">
                        {g.member_count}
                        {g.max_members != null && (
                          <span style={{ color: "var(--text-secondary)" }}>
                            {" "}
                            / {g.max_members}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap">
                        {g.athlete_count}
                        {g.max_athletes != null && (
                          <span style={{ color: "var(--text-secondary)" }}>
                            {" "}
                            / {g.max_athletes}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs">{g.trainer_count}</td>
                      <td
                        className="px-5 py-3 text-xs whitespace-nowrap"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDate(g.updated_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <AddMemberPopover
                            tenantId={result.tenant.id}
                            groupId={g.id}
                            isFull={isFull}
                            fullTooltip={fullTooltip}
                            compact
                          />
                          <Link
                            href={`/tenant/groups/${g.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium"
                            style={{
                              borderColor: "var(--surface-border)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <ExternalLink className="h-3 w-3" /> Bekijk
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile: cards */}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-3 md:hidden">
          {rows.map((g) => {
            const isFull =
              (g.max_members != null && g.member_count >= g.max_members) ||
              (g.max_athletes != null && g.athlete_count >= g.max_athletes);
            const fullTooltip =
              g.max_athletes != null && g.athlete_count >= g.max_athletes
                ? `Maximum atleten bereikt (${g.max_athletes})`
                : g.max_members != null
                  ? `Groep is vol (${g.max_members})`
                  : "Groep is vol";
            return (
              <li
                key={g.id}
                className="rounded-2xl border p-4"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {g.name}
                    </p>
                    {g.description && (
                      <p
                        className="mt-0.5 line-clamp-2 text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {g.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: "var(--surface-soft)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {g.member_count}
                      {g.max_members != null ? ` / ${g.max_members}` : ""} leden
                    </span>
                    {(g.athlete_count > 0 || g.max_athletes != null) && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: "var(--surface-soft)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {g.athlete_count}
                        {g.max_athletes != null ? ` / ${g.max_athletes}` : ""}{" "}
                        atleten
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <AddMemberPopover
                    tenantId={result.tenant.id}
                    groupId={g.id}
                    isFull={isFull}
                    fullTooltip={fullTooltip}
                  />
                  <Link
                    href={`/tenant/groups/${g.id}`}
                    className="inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-xs font-semibold"
                    style={{
                      borderColor: "var(--surface-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <ExternalLink className="h-3 w-3" /> Bekijk
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-2 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <Link
            aria-disabled={page <= 1}
            href={page > 1 ? buildHref({ page: String(page - 1) }) : "#"}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              opacity: page <= 1 ? 0.4 : 1,
              pointerEvents: page <= 1 ? "none" : "auto",
            }}
          >
            <ChevronLeft className="h-3 w-3" /> Vorige
          </Link>
          <span>
            Pagina {page} van {totalPages}
          </span>
          <Link
            aria-disabled={page >= totalPages}
            href={
              page < totalPages ? buildHref({ page: String(page + 1) }) : "#"
            }
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              opacity: page >= totalPages ? 0.4 : 1,
              pointerEvents: page >= totalPages ? "none" : "auto",
            }}
          >
            Volgende <ChevronRight className="h-3 w-3" />
          </Link>
        </nav>
      )}
    </>
  );
}
