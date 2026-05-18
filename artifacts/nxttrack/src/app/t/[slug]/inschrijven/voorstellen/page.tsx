import { redirect } from "next/navigation";
import { resolveSubmissionByReviewToken } from "@/lib/actions/public/propose-slot";
import { scorePlacementCandidates } from "@/lib/db/placement";
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
  const candidates = await scorePlacementCandidates(sub.id).catch(() => []);
  const top3 = candidates.slice(0, 3);

  const admin = createAdminClient();
  const groupIds = Array.from(new Set(top3.map((c) => c.group_id).filter(Boolean)));
  let groupNameById: Record<string, string> = {};
  if (groupIds.length > 0) {
    const { data: gNames } = await admin
      .from("groups")
      .select("id, name")
      .eq("tenant_id", sub.tenant_id)
      .in("id", groupIds);
    groupNameById = Object.fromEntries(
      (gNames ?? []).map((g) => [g.id as string, (g.name as string) ?? ""]),
    );
  }

  const rows: ProposalRow[] = [];
  for (const c of top3) {
    const groupId = (c as { group_id: string }).group_id;
    const stageId =
      ((c as unknown) as { stage_id?: string | null }).stage_id ?? null;
    const waitWeeks = await getWaitEstimate(admin, {
      tenantId: sub.tenant_id,
      groupId,
      stageId,
    });
    rows.push({
      group_id: groupId,
      stage_id: stageId,
      group_name: groupNameById[groupId] ?? "Groep",
      total_score: Number((c as { total_score: number | null }).total_score ?? 0),
      capacity_match: Number((c as { capacity_match: number | null }).capacity_match ?? 0),
      wait_weeks: waitWeeks,
      wait_label: labelForWaitWeeks(waitWeeks),
      wait_tone: toneForWaitWeeks(waitWeeks),
      suggestion_rank: rows.length + 1,
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

  const noCapacity = rows.length === 0 || rows.every((r) => r.capacity_match === 0);
  if (noCapacity) {
    redirect(`/t/${slug}/inschrijven/geen-plek?token=${token}`);
  }

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
      <ChooseSlotList rows={rows} reviewToken={token} />
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
