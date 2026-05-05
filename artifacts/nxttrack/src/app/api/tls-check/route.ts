import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public lookup endpoint, used in twee contexten:
 *
 * 1. **Caddy on-demand TLS** — Caddy bevraagt deze URL voordat hij een
 *    Let's Encrypt certificaat aanvraagt. 200 = "ja, dit domein hoort
 *    bij ons, mag een cert hebben"; 404 = afwijzen. Dit is essentieel
 *    om te voorkomen dat willekeurige hosts ons cert-quotum opvreten.
 *
 * 2. **Middleware host→slug lookup** — onze edge middleware roept
 *    hetzelfde endpoint aan om een custom domein om te zetten naar de
 *    juiste tenant-slug zonder DB-lookup vanuit de Edge runtime. Body
 *    bevat dan ook de slug.
 *
 * Beveiliging: het endpoint geeft enkel "ja, dit domein hoort bij een
 * actieve tenant + welke slug" terug. De slug-info is sowieso publiek
 * (zichtbaar in middleware-rewrites en als subdomein op de apex), dus
 * geen auth vereist. Wel rate-limit overwegen op nginx/caddy-niveau
 * als misbruik wordt vermoed (bv. brute-force enumeration).
 *
 * Service-role client wordt gebruikt zodat RLS geen invloed heeft op
 * de domain-lookup.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(domain: string) {
  return NextResponse.json(
    { ok: false, domain, reason: "unknown_domain" },
    { status: 404 },
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Caddy stuurt `?domain=`, sommige clients `?host=`; accepteer beide.
  const raw = (url.searchParams.get("domain") ?? url.searchParams.get("host") ?? "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return NextResponse.json(
      { ok: false, reason: "missing_domain" },
      { status: 400 },
    );
  }

  // Apex en subdomeinen onder onze apex zijn ALTIJD geldig (we hebben
  // daarvoor een wildcard cert of we vertrouwen Cloudflare proxy).
  const APEX = (process.env.APEX_DOMAIN || "nxttrack.nl").toLowerCase();
  if (raw === APEX || raw === `www.${APEX}` || raw.endsWith(`.${APEX}`)) {
    return NextResponse.json({ ok: true, domain: raw, kind: "apex" });
  }

  // Strip leading "www." voor de DB-match: we slaan alleen het kale
  // domein op maar accepteren beide varianten.
  const candidates = raw.startsWith("www.") ? [raw.slice(4), raw] : [raw, `www.${raw}`];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("slug, domain, status")
    .in("domain", candidates)
    .limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db_error", message: error.message },
      { status: 500 },
    );
  }

  const row = (data ?? [])[0] as
    | { slug: string; domain: string; status: string }
    | undefined;
  if (!row) return notFound(raw);
  if (row.status !== "active") {
    return NextResponse.json(
      { ok: false, domain: raw, reason: "tenant_inactive" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    domain: raw,
    kind: "tenant",
    slug: row.slug,
  });
}
