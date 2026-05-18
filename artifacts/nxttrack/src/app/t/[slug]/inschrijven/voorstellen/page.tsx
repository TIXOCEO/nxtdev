import { redirect } from "next/navigation";
import { resolveSubmissionByReviewToken } from "@/lib/actions/public/propose-slot";
import { scorePlacementCandidatesPublic } from "@/lib/db/placement";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWaitEstimate, toneForWaitWeeks, labelForWaitWeeks } from "@/lib/intake/wait-time";
import { ChooseSlotList, type ProposalRow } from "@/components/public/intake/ChooseSlotList";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ProposeSlotsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { token } = await searchParams;
  if (!token) redirect(`/t/${slug}`);

  const sub = await resolveSubmissionByReviewToken(token);
  if (!sub || sub.tenant_slug !== slug) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <div
          className="rounded-2xl p-6"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <h1
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Deze link is niet langer geldig
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            De voorstellen-link is verlopen of al gebruikt. Neem contact op met de organisatie als je vragen hebt over je aanvraag.
          </p>
        </div>
      </main>
    );
  }

  // Top-3 kandidaten op match-score; daarna wachttijd-info per row.
  // Geen silent-catch: bij echte RPC-fout willen we de fout zien i.p.v.
  // de aanvrager misleidend naar /geen-plek te sturen.
  let candidates: Awaited<ReturnType<typeof scorePlacementCandidatesPublic>>;
  try {
    candidates = await scorePlacementCandidatesPublic(sub.id, token);
  } catch (err) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <div
          className="rounded-2xl p-6"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Tijdelijk geen voorstellen beschikbaar
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            We konden de voorstellen niet ophalen. Probeer het later opnieuw, of neem contact op met de organisatie.
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            {(err as Error).message}
          </p>
        </div>
      </main>
    );
  }
  // Sprint 82b post-review fix: enrich wait-time voor ALLE kandidaten
  // (capped op top-12 by score om query-blowup op tenants met veel
  // groepen te voorkomen), daarna sort op (capaciteit > wachttijd >
  // score), pas dán slice(0,3). Voorheen werd slice(0,3) vóór de
  // wachttijd-lookup gedaan, waardoor groepen met betere wachttijd buiten
  // de top-3-by-score nooit kans kregen en de noCapacity-fallback
  // foutief kon redirecten naar /geen-plek.
  const enrichmentSet = candidates.slice(0, 12);

  const admin = createAdminClient();
  const groupIds = Array.from(new Set(enrichmentSet.map((c) => c.group_id).filter(Boolean)));
  let groupNameById: Record<string, string> = {};
  type NextSessionInfo = {
    starts_at: string;
    ends_at: string | null;
    instructor_names: string[];
  };
  const nextSessionByGroup: Record<string, NextSessionInfo | undefined> = {};
  if (groupIds.length > 0) {
    const { data: gNames } = await admin
      .from("groups")
      .select("id, name")
      .eq("tenant_id", sub.tenant_id)
      .in("id", groupIds);
    groupNameById = Object.fromEntries(
      (gNames ?? []).map((g) => [g.id as string, (g.name as string) ?? ""]),
    );

    // Eerstvolgende sessie per groep (status<>cancelled, vanaf nu).
    const { data: sessions } = await admin
      .from("training_sessions")
      .select(
        "id, group_id, starts_at, ends_at, status, session_instructors(member_id, members(full_name))",
      )
      .eq("tenant_id", sub.tenant_id)
      .in("group_id", groupIds)
      .neq("status", "cancelled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    type SessionRow = {
      group_id: string;
      starts_at: string;
      ends_at: string | null;
      session_instructors?: Array<{
        members?: { full_name?: string | null } | { full_name?: string | null }[] | null;
      }> | null;
    };
    for (const s of (sessions ?? []) as SessionRow[]) {
      if (nextSessionByGroup[s.group_id]) continue;
      const names: string[] = [];
      for (const si of s.session_instructors ?? []) {
        const m = Array.isArray(si.members) ? si.members[0] : si.members;
        const name = m?.full_name?.trim();
        if (name) names.push(name);
      }
      nextSessionByGroup[s.group_id] = {
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        instructor_names: names,
      };
    }
  }

  const fmtDay = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fmtTime = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });
  // Sprint 82b — target_stage_id zit in rationale_json (gevuld door de
  // publieke RPC, identiek aan v_target_stage in de scoring-logica).
  // Wordt als stageId voor wait-estimate gebruikt — alle top-3 voorstellen
  // delen dezelfde target-stage (resolved van submission's
  // selected_stage_id / recommended_stage_id / preferred_level).
  const rows: ProposalRow[] = [];
  for (const c of enrichmentSet) {
    const groupId = c.group_id;
    const stageId = c.rationale_json.target_stage_id ?? null;
    const waitWeeks = await getWaitEstimate(admin, {
      tenantId: sub.tenant_id,
      groupId,
      stageId,
    });
    const next = nextSessionByGroup[groupId];
    let dayLabel: string | null = null;
    let timeLabel: string | null = null;
    if (next) {
      const s = new Date(next.starts_at);
      dayLabel = fmtDay.format(s);
      const startStr = fmtTime.format(s);
      const endStr = next.ends_at ? fmtTime.format(new Date(next.ends_at)) : null;
      timeLabel = endStr ? `${startStr}–${endStr}` : startStr;
    }
    rows.push({
      group_id: groupId,
      stage_id: stageId,
      group_name: groupNameById[groupId] ?? "Groep",
      total_score: c.total_score,
      capacity_match: c.capacity_match,
      wait_weeks: waitWeeks,
      wait_label: labelForWaitWeeks(waitWeeks),
      wait_tone: toneForWaitWeeks(waitWeeks),
      suggestion_rank: 0, // herberekend ná sortering
      day_label: dayLabel,
      time_label: timeLabel,
      instructor_names: next?.instructor_names ?? [],
    });
  }

  // Sorteer op (a) capaciteit-eerst, (b) kortste wachttijd, (c) score.
  rows.sort((a, b) => {
    const capDiff = (b.capacity_match > 0 ? 1 : 0) - (a.capacity_match > 0 ? 1 : 0);
    if (capDiff !== 0) return capDiff;
    const wA = a.wait_weeks ?? 99;
    const wB = b.wait_weeks ?? 99;
    if (wA !== wB) return wA - wB;
    return b.total_score - a.total_score;
  });

  // noCapacity-check op de VOLLEDIGE enriched set, niet op top-3. Anders
  // zou een aanvrager naar /geen-plek geredirect worden terwijl candidate
  // #4+ wél vrije plaatsen heeft.
  const noCapacity = rows.length === 0 || rows.every((r) => r.capacity_match === 0);
  if (noCapacity) {
    redirect(`/t/${slug}/inschrijven/geen-plek?token=${token}`);
  }

  // Nu pas top-3 (sortering boven garandeert dat dit de échte best-3 is)
  // en herbereken suggestion_rank zodat consumer (server-action +
  // audit-log) consistent 1/2/3 ontvangt.
  const top3Rows = rows.slice(0, 3).map((r, i) => ({ ...r, suggestion_rank: i + 1 }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1
          className="text-xl font-semibold sm:text-2xl"
          style={{ color: "var(--text-primary)" }}
        >
          Kies je tijdsblok
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Bedankt {sub.contact_name ?? ""}! Op basis van je aanvraag hebben we 3 mogelijke groepen gevonden. Kies de groep waar je het liefst start.
        </p>
      </header>
      <ChooseSlotList rows={top3Rows} reviewToken={token} />
      <p className="mt-6 text-xs" style={{ color: "var(--text-secondary)" }}>
        Geen van deze tijden geschikt?{" "}
        <a
          href={`/t/${slug}/inschrijven/geen-plek?token=${token}`}
          className="underline"
        >
          Op de wachtlijst plaatsen
        </a>
        .
      </p>
    </main>
  );
}
