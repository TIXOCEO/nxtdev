import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Users,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getGroupDetail } from "@/lib/db/groups";
import { AddMemberPopover } from "../_add-member-popover";
import { GroupMemberRow } from "./_member-row";
import { CsvImport } from "./_csv-import";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    tab?: string;
    sort?: string;
    order?: string;
    page?: string;
    size?: string;
    q?: string;
  }>;
}

export const dynamic = "force-dynamic";

const TAB_KEYS = ["athletes", "trainers", "others"] as const;
type TabKey = (typeof TAB_KEYS)[number];
const VALID_SORTS = ["name", "status", "joined_at"] as const;
type SortKey = (typeof VALID_SORTS)[number];
const VALID_PAGE_SIZES = [25, 50, 100] as const;

const TAB_LABELS: Record<TabKey, string> = {
  athletes: "Atleten",
  trainers: "Trainers",
  others: "Overig",
};

export default async function GroupDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const detail = await getGroupDetail(id, result.tenant.id);
  if (!detail) notFound();

  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as TabKey)
    : "athletes";
  const sortBy: SortKey = (VALID_SORTS as readonly string[]).includes(
    sp.sort ?? "",
  )
    ? (sp.sort as SortKey)
    : "name";
  const sortOrder: "asc" | "desc" = sp.order === "desc" ? "desc" : "asc";
  const requestedSize = Number.parseInt(sp.size ?? "", 10);
  const pageSize: number = (VALID_PAGE_SIZES as readonly number[]).includes(
    requestedSize,
  )
    ? requestedSize
    : 25;
  const requestedPage = Number.parseInt(sp.page ?? "", 10);
  const safePage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = (sp.q ?? "").toString().trim().slice(0, 120).toLowerCase();

  const baseRows =
    tab === "athletes"
      ? detail.athletes
      : tab === "trainers"
        ? detail.trainers
        : [...detail.staff, ...detail.others];

  const filtered = search
    ? baseRows.filter((r) => r.full_name.toLowerCase().includes(search))
    : baseRows.slice();

  const dir = sortOrder === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "status")
      cmp = (a.member_status ?? "").localeCompare(b.member_status ?? "");
    else if (sortBy === "joined_at")
      cmp = (a.joined_at ?? "").localeCompare(b.joined_at ?? "");
    else cmp = a.full_name.localeCompare(b.full_name, "nl", { sensitivity: "base" });
    if (cmp === 0)
      cmp = a.full_name.localeCompare(b.full_name, "nl", { sensitivity: "base" });
    return cmp * dir;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(safePage, totalPages);
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const memberCount = detail.member_count;
  const max = detail.group.max_members;
  const isFull = max != null && memberCount >= max;
  const nearFull = max != null && memberCount / max >= 0.9;

  const buildHref = (overrides: Record<string, string | null>): string => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("sort", sortBy);
    params.set("order", sortOrder);
    if (pageSize !== 25) params.set("size", String(pageSize));
    if (page !== 1) params.set("page", String(page));
    if (search) params.set("q", search);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/tenant/groups/${id}?${qs}` : `/tenant/groups/${id}`;
  };

  const buildSortHref = (key: SortKey): string => {
    const nextOrder = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    return buildHref({ sort: key, order: nextOrder, page: null });
  };

  const SortIndicator = ({ col }: { col: SortKey }) =>
    sortBy === col ? (
      sortOrder === "asc" ? (
        <ArrowUp className="ml-1 inline h-3 w-3" />
      ) : (
        <ArrowDown className="ml-1 inline h-3 w-3" />
      )
    ) : null;

  const roleFilter =
    tab === "athletes" ? "athlete" : tab === "trainers" ? "trainer" : undefined;

  return (
    <>
      <Link
        href="/tenant/groups"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar groepen
      </Link>

      <PageHeading
        title={detail.group.name}
        description={
          detail.group.description ?? "Beheer atleten en trainers in deze groep."
        }
        actions={
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                backgroundColor: isFull
                  ? "rgba(220, 38, 38, 0.12)"
                  : nearFull
                    ? "rgba(234, 179, 8, 0.18)"
                    : "var(--surface-soft)",
                color: isFull
                  ? "rgb(185, 28, 28)"
                  : nearFull
                    ? "rgb(133, 77, 14)"
                    : "var(--text-secondary)",
              }}
              title={
                max == null
                  ? "Geen maximum ingesteld"
                  : isFull
                    ? "Groep is vol"
                    : nearFull
                      ? "Bijna vol"
                      : undefined
              }
            >
              {memberCount}
              {max != null ? ` / ${max}` : ""} leden
            </span>
            <a
              href={`/tenant/groups/${id}/export`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: "var(--surface-soft)",
                color: "var(--text-primary)",
              }}
            >
              <Download className="h-3.5 w-3.5" /> Exporteer CSV
            </a>
          </div>
        }
      />

      {/* Add member bar + CSV import */}
      <section
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <AddMemberPopover
            tenantId={result.tenant.id}
            groupId={id}
            isFull={isFull}
            fullTooltip={`Groep is vol (${max})`}
            roleFilter={roleFilter}
            label={
              tab === "trainers"
                ? "Trainer toevoegen"
                : tab === "athletes"
                  ? "Atleet toevoegen"
                  : "Lid toevoegen"
            }
          />
          <div
            className="hidden h-6 w-px sm:block"
            style={{ backgroundColor: "var(--surface-border)" }}
          />
          <div className="min-w-0 flex-1">
            <p
              className="mb-1 text-xs font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              CSV-import (athlete_code, e-mail of member_id)
            </p>
            <CsvImport tenantId={result.tenant.id} groupId={id} />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mt-2 flex flex-wrap items-center gap-1 border-b" style={{ borderColor: "var(--surface-border)" }}>
        {TAB_KEYS.map((k) => {
          const count =
            k === "athletes"
              ? detail.athletes.length
              : k === "trainers"
                ? detail.trainers.length
                : detail.staff.length + detail.others.length;
          const active = tab === k;
          return (
            <Link
              key={k}
              href={buildHref({ tab: k, page: null })}
              className="-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium"
              style={{
                borderColor: active ? "var(--accent)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {TAB_LABELS[k]}
              <span
                className="rounded-full px-1.5 text-[11px]"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  color: "var(--text-secondary)",
                }}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <form
        action={`/tenant/groups/${id}`}
        method="get"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="sort" value={sortBy} />
        <input type="hidden" name="order" value={sortOrder} />
        {pageSize !== 25 && (
          <input type="hidden" name="size" value={String(pageSize)} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Filter op naam…"
          className="h-9 w-full max-w-md rounded-xl border bg-transparent px-3 text-sm outline-none"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
            backgroundColor: "var(--surface-main)",
          }}
        />
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span>Per pagina:</span>
          {VALID_PAGE_SIZES.map((s) => (
            <Link
              key={s}
              href={buildHref({ size: String(s), page: null })}
              className="rounded-lg border px-2 py-0.5"
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

      {visibleRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            search
              ? "Geen leden gevonden"
              : `Nog geen ${TAB_LABELS[tab].toLowerCase()}`
          }
          description={
            search
              ? "Pas je filter aan of voeg leden toe via de balk hierboven."
              : "Voeg leden toe via de balk hierboven."
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
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
                  <th className="px-4 py-3">
                    <Link href={buildSortHref("name")} className="inline-flex items-center hover:underline">
                      Naam <SortIndicator col="name" />
                    </Link>
                  </th>
                  <th className="px-4 py-3">
                    <Link href={buildSortHref("status")} className="inline-flex items-center hover:underline">
                      Status <SortIndicator col="status" />
                    </Link>
                  </th>
                  <th className="px-4 py-3">
                    <Link href={buildSortHref("joined_at")} className="inline-flex items-center hover:underline">
                      Sinds <SortIndicator col="joined_at" />
                    </Link>
                  </th>
                  <th className="px-4 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                {visibleRows.map((m) => (
                  <GroupMemberRow
                    key={m.id}
                    asTableRow
                    tenantId={result.tenant.id}
                    groupId={id}
                    memberId={m.id}
                    name={m.full_name}
                    status={m.member_status}
                    joinedAt={m.joined_at}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-2 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <Link
            href={page > 1 ? buildHref({ page: String(page - 1) }) : "#"}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              opacity: page <= 1 ? 0.4 : 1,
              pointerEvents: page <= 1 ? "none" : "auto",
            }}
          >
            Vorige
          </Link>
          <span>
            Pagina {page} van {totalPages} · {total} resultaten
          </span>
          <Link
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
            Volgende
          </Link>
        </nav>
      )}
    </>
  );
}
