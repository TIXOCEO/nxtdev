import { NextResponse, type NextRequest } from "next/server";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getMembersByTenant,
  type MemberSortKey,
  type SortOrder,
  type MemberListRow,
} from "@/lib/db/members";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

const VALID_SORTS: MemberSortKey[] = [
  "name",
  "status",
  "member_since",
  "archived_at",
  "created_at",
];

const VALID_ROLES = ["parent", "athlete", "trainer", "staff", "volunteer"];

function isUuid(s: string | null): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidIsoDate(s: string | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function csvEscape(value: string): string {
  if (value === "") return "";
  // Neutralize spreadsheet formula injection: cells starting with =, +, -,
  // @, tab or CR are interpreted as formulas by Excel/Sheets/Numbers.
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  // Keep ISO-style yyyy-mm-dd for spreadsheet-friendly sorting.
  return value.slice(0, 10);
}

function rowToCsv(r: MemberListRow): string {
  const cells = [
    r.full_name ?? "",
    r.email ?? "",
    r.member_status ?? "",
    r.roles.map((role) => ROLE_LABELS[role] ?? role).join("; "),
    r.group_names.join("; "),
    formatDate(r.member_since),
    formatDate(r.archived_at),
    r.archived_by_email ?? "",
  ];
  return cells.map(csvEscape).join(",") + "\n";
}

export async function GET(req: NextRequest) {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);

  if (result.kind === "no_access") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  if (result.kind === "needs_selection") {
    return NextResponse.json(
      { error: "Selecteer eerst een vereniging" },
      { status: 400 },
    );
  }
  if (result.kind !== "ok") {
    return NextResponse.json({ error: "Onbekende status" }, { status: 400 });
  }

  const url = new URL(req.url);
  const showArchived = url.searchParams.get("status") === "archived";
  const memberSinceFrom = isValidIsoDate(url.searchParams.get("since_from"))
    ? url.searchParams.get("since_from")
    : null;
  const memberSinceTo = isValidIsoDate(url.searchParams.get("since_to"))
    ? url.searchParams.get("since_to")
    : null;

  const requestedSort = (url.searchParams.get("sort") ?? "") as MemberSortKey;
  const sortBy: MemberSortKey = VALID_SORTS.includes(requestedSort)
    ? requestedSort
    : showArchived
      ? "archived_at"
      : "created_at";
  const sortOrder: SortOrder =
    url.searchParams.get("order") === "asc" ? "asc" : "desc";

  const selectedRoles = Array.from(
    new Set(
      url.searchParams.getAll("role").filter((r) => VALID_ROLES.includes(r)),
    ),
  );
  const groupParam = url.searchParams.get("group");
  const selectedGroupId = isUuid(groupParam) ? groupParam : null;

  const members = await getMembersByTenant(result.tenant.id, {
    onlyArchived: showArchived,
    memberSinceFrom,
    memberSinceTo,
    sortBy,
    sortOrder,
    roles: selectedRoles,
    groupId: selectedGroupId,
  });

  const tenantSlug = result.tenant.slug ?? result.tenant.id;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `leden-${tenantSlug}-${stamp}.csv`;

  const header =
    "naam,email,status,rollen,groepen,lid_sinds,archived_at,gearchiveerd_door\n";

  // BOM zodat Excel UTF-8 (é, ï, …) correct toont.
  let body = "\uFEFF" + header;
  for (const m of members) {
    body += rowToCsv(m);
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
