import { NextResponse, type NextRequest } from "next/server";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

function csvEscape(value: string): string {
  if (value === "") return "";
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "groep"
  );
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", id)
    .eq("tenant_id", result.tenant.id)
    .maybeSingle();
  if (!group) {
    return NextResponse.json({ error: "Groep niet gevonden" }, { status: 404 });
  }

  const { data: gm } = await supabase
    .from("group_members")
    .select("member_id, created_at")
    .eq("group_id", id);
  const links = (gm ?? []) as Array<{ member_id: string; created_at: string }>;
  const memberIds = links.map((r) => r.member_id);

  const joinedByMember = new Map<string, string>();
  for (const r of links) joinedByMember.set(r.member_id, r.created_at);

  // Volgens de task-spec heeft het export-bestand de volgorde:
  //   member_id, athlete_code, voornaam, achternaam, e-mail, role, joined_at
  // Dutch column-names matchen de rest van de tenant-UI.
  const rows: Array<{
    member_id: string;
    athlete_code: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    joined_at: string;
  }> = [];

  if (memberIds.length > 0) {
    const [{ data: members }, { data: roles }] = await Promise.all([
      supabase
        .from("members")
        .select("id, full_name, first_name, last_name, email, athlete_code")
        .eq("tenant_id", result.tenant.id)
        .in("id", memberIds)
        .order("full_name", { ascending: true }),
      supabase
        .from("member_roles")
        .select("member_id, role")
        .in("member_id", memberIds),
    ]);

    const rolesByMember = new Map<string, string[]>();
    for (const r of (roles ?? []) as Array<{ member_id: string; role: string }>) {
      const arr = rolesByMember.get(r.member_id) ?? [];
      arr.push(r.role);
      rolesByMember.set(r.member_id, arr);
    }

    for (const m of (members ?? []) as Array<{
      id: string;
      full_name: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      athlete_code: string | null;
    }>) {
      // Splits full_name als first/last leeg zijn — admins kunnen historisch
      // alleen full_name hebben ingevoerd.
      let first = m.first_name ?? "";
      let last = m.last_name ?? "";
      if (!first && !last && m.full_name) {
        const parts = m.full_name.trim().split(/\s+/);
        first = parts[0] ?? "";
        last = parts.slice(1).join(" ");
      }
      rows.push({
        member_id: m.id,
        athlete_code: m.athlete_code ?? "",
        first_name: first,
        last_name: last,
        email: m.email ?? "",
        role: (rolesByMember.get(m.id) ?? []).join("; "),
        joined_at: joinedByMember.get(m.id)?.slice(0, 10) ?? "",
      });
    }
  }

  const header =
    "member_id,athlete_code,voornaam,achternaam,e-mail,role,joined_at\n";
  let body = "\uFEFF" + header;
  for (const r of rows) {
    const cells = [
      r.member_id,
      r.athlete_code,
      r.first_name,
      r.last_name,
      r.email,
      r.role,
      r.joined_at,
    ];
    body += cells.map(csvEscape).join(",") + "\n";
  }

  const filename = `groups-${slugify(group.name)}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
