import { NextResponse, type NextRequest } from "next/server";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { streamAuditLogs, type AuditLogRow } from "@/lib/db/audit-logs";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  if (value === "") return "";
  // Neutralize spreadsheet formula injection: cells starting with =, +, -,
  // @, tab or CR are interpreted as formulas by Excel/Sheets/Numbers.
  // Prefix with a single quote so the literal text is preserved.
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function rowToCsv(r: AuditLogRow): string {
  const cells = [
    r.created_at,
    r.action,
    r.actor_email ?? "",
    r.member_name ?? "",
    JSON.stringify(r.meta ?? {}),
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

  const url = new URL(req.url);
  const action = url.searchParams.get("action")?.trim() || null;
  const from = url.searchParams.get("from")?.trim() || null;
  const to = url.searchParams.get("to")?.trim() || null;

  const tenantId = result.tenant.id;
  const tenantSlug = result.tenant.slug ?? tenantId;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `audit-${tenantSlug}-${stamp}.csv`;

  const encoder = new TextEncoder();
  const header =
    "timestamp,action,actor_email,member_naam,meta\n";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(header));
        for await (const row of streamAuditLogs({
          tenantId,
          action,
          fromDate: from,
          toDate: to,
        })) {
          controller.enqueue(encoder.encode(rowToCsv(row)));
        }
        controller.close();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[audit-export] stream failed:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
