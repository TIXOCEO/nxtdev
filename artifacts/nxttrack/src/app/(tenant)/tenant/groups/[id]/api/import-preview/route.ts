import { NextResponse, type NextRequest } from "next/server";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

interface PreviewRow {
  raw: Record<string, string>;
  match_key: "athlete_code" | "email" | "member_id" | "—";
  match_value: string;
  member_id: string | null;
  full_name: string | null;
  reason: string | null;
}

// Minimal CSV parser: respects quoted strings and double-quote escapes.
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n" || ch === "\r") {
        if (cur.length > 0 || row.length > 0) {
          row.push(cur);
          out.push(row);
        }
        row = [];
        cur = "";
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else {
        cur += ch;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    out.push(row);
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  // Sprint 42 — verifieer dat de groep daadwerkelijk bij deze tenant hoort
  // voordat we member-data joinen. Anders zou een gebruiker met geldige
  // tenant-cookie via een vreemde group_id alsnog group_members van een
  // andere tenant kunnen previewen.
  const supabase = await createClient();
  const { data: groupRow } = await supabase
    .from("groups")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", result.tenant.id)
    .maybeSingle();
  if (!groupRow) {
    return NextResponse.json({ error: "Groep niet gevonden" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  }
  if (file.size > 1_000_000) {
    return NextResponse.json({ error: "CSV is te groot (max 1 MB)." }, { status: 400 });
  }

  const text = await file.text();
  const cleaned = text.replace(/^\uFEFF/, "");
  const rows = parseCsv(cleaned).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV is leeg." }, { status: 400 });
  }

  const header = rows[0].map((c) => c.trim().toLowerCase());
  const dataRows = rows.slice(1);
  const codeCol = header.findIndex((c) =>
    ["athlete_code", "code", "lid_code", "member_code"].includes(c),
  );
  const emailCol = header.findIndex((c) => c === "email" || c === "e-mail");
  const memberIdCol = header.findIndex((c) =>
    ["member_id", "id"].includes(c),
  );
  if (codeCol < 0 && emailCol < 0 && memberIdCol < 0) {
    return NextResponse.json(
      {
        error:
          "CSV moet minstens een 'athlete_code', 'email' of 'member_id' kolom bevatten.",
      },
      { status: 400 },
    );
  }

  // Verzamel alle te zoeken keys per type. Match-prioriteit:
  //   1. athlete_code (primair)
  //   2. email (fallback)
  //   3. member_id (uitwisselbaar via export round-trip)
  const wantedCodes = new Set<string>();
  const wantedEmails = new Set<string>();
  const wantedIds = new Set<string>();
  const parsed = dataRows.map((cells) => {
    const raw: Record<string, string> = {};
    header.forEach((h, i) => (raw[h] = (cells[i] ?? "").trim()));
    const codeVal = codeCol >= 0 ? (cells[codeCol] ?? "").trim() : "";
    const emailVal =
      emailCol >= 0 ? (cells[emailCol] ?? "").trim().toLowerCase() : "";
    const idVal = memberIdCol >= 0 ? (cells[memberIdCol] ?? "").trim() : "";
    // Sprint 42 — verzamel alle drie de keys als ze in de rij staan, zodat
    // we per-rij echte fallback (athlete_code → email → member_id) kunnen
    // doen i.p.v. alleen de hoogste prioriteit te proberen.
    if (codeVal) wantedCodes.add(codeVal);
    if (emailVal) wantedEmails.add(emailVal);
    if (idVal && UUID_RE.test(idVal)) wantedIds.add(idVal);
    return { raw, codeVal, emailVal, idVal };
  });

  const memberByCode = new Map<string, { id: string; full_name: string }>();
  const memberByEmail = new Map<string, { id: string; full_name: string }>();
  const memberById = new Map<string, { id: string; full_name: string }>();

  if (wantedCodes.size > 0) {
    const { data } = await supabase
      .from("members")
      .select("id, full_name, athlete_code")
      .eq("tenant_id", result.tenant.id)
      .in("athlete_code", Array.from(wantedCodes));
    for (const m of (data ?? []) as Array<{
      id: string;
      full_name: string;
      athlete_code: string | null;
    }>) {
      if (m.athlete_code) memberByCode.set(m.athlete_code, m);
    }
  }
  if (wantedEmails.size > 0) {
    const { data } = await supabase
      .from("members")
      .select("id, full_name, email")
      .eq("tenant_id", result.tenant.id)
      .in("email", Array.from(wantedEmails));
    for (const m of (data ?? []) as Array<{
      id: string;
      full_name: string;
      email: string | null;
    }>) {
      if (m.email) memberByEmail.set(m.email.toLowerCase(), m);
    }
  }
  if (wantedIds.size > 0) {
    const { data } = await supabase
      .from("members")
      .select("id, full_name")
      .eq("tenant_id", result.tenant.id)
      .in("id", Array.from(wantedIds));
    for (const m of (data ?? []) as Array<{ id: string; full_name: string }>) {
      memberById.set(m.id, m);
    }
  }

  // Filter al-bestaande members in deze groep.
  const candidateIds = new Set<string>();
  for (const m of memberByCode.values()) candidateIds.add(m.id);
  for (const m of memberByEmail.values()) candidateIds.add(m.id);
  for (const m of memberById.values()) candidateIds.add(m.id);
  const alreadyIn = new Set<string>();
  if (candidateIds.size > 0) {
    const { data } = await supabase
      .from("group_members")
      .select("member_id")
      .eq("group_id", id)
      .in("member_id", Array.from(candidateIds));
    for (const r of (data ?? []) as Array<{ member_id: string }>) {
      alreadyIn.add(r.member_id);
    }
  }

  // Sprint 42 — per-rij fallback: athlete_code (primair), dan email, dan
  // member_id. Pas door naar de volgende key zodra de huidige geen treffer
  // oplevert; reden vermeldt welke pogingen mislukten zodat geen
  // misverstand bestaat over wat de import wel/niet meeneemt.
  const out: PreviewRow[] = parsed.map(({ raw, codeVal, emailVal, idVal }) => {
    const tried: string[] = [];
    const attempts: Array<{
      key: PreviewRow["match_key"];
      value: string;
      hit: { id: string; full_name: string } | undefined;
    }> = [];
    if (codeVal) {
      attempts.push({ key: "athlete_code", value: codeVal, hit: memberByCode.get(codeVal) });
    }
    if (emailVal) {
      attempts.push({ key: "email", value: emailVal, hit: memberByEmail.get(emailVal) });
    }
    if (idVal && UUID_RE.test(idVal)) {
      attempts.push({ key: "member_id", value: idVal, hit: memberById.get(idVal) });
    }
    if (attempts.length === 0) {
      return {
        raw,
        match_key: "—",
        match_value: "",
        member_id: null,
        full_name: null,
        reason: "Geen athlete_code, email of member_id in deze rij",
      };
    }
    for (const a of attempts) {
      if (!a.hit) {
        tried.push(`${a.key}=${a.value}`);
        continue;
      }
      if (alreadyIn.has(a.hit.id)) {
        return {
          raw,
          match_key: a.key,
          match_value: a.value,
          member_id: null,
          full_name: a.hit.full_name,
          reason: "Zit al in de groep",
        };
      }
      return {
        raw,
        match_key: a.key,
        match_value: a.value,
        member_id: a.hit.id,
        full_name: a.hit.full_name,
        reason: null,
      };
    }
    return {
      raw,
      match_key: attempts[0].key,
      match_value: attempts[0].value,
      member_id: null,
      full_name: null,
      reason: `Niet gevonden in deze tenant (${tried.join(", ")})`,
    };
  });

  const matched = out.filter((r) => r.member_id).length;
  const unmatched = out.length - matched;
  return NextResponse.json({ rows: out, matched, unmatched });
}
