import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProgressSettingsPanels } from "./_panels";

export const dynamic = "force-dynamic";

type RenderStyle = "text" | "stars" | "emoji";

interface ScoringLabelRow {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  emoji: string | null;
  star_value: number | null;
  sort_order: number;
}

async function readPageData(tenantId: string): Promise<{
  render_style: RenderStyle;
  labels: ScoringLabelRow[];
}> {
  const admin = createAdminClient();
  const [tenantRes, labelRes] = await Promise.all([
    admin.from("tenants").select("settings_json").eq("id", tenantId).maybeSingle(),
    admin
      .from("scoring_labels")
      .select("id, slug, name, color, emoji, star_value, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);
  const s = (tenantRes.data?.settings_json ?? {}) as Record<string, unknown>;
  const raw = s.progress_render_style;
  const render_style: RenderStyle =
    raw === "stars" || raw === "emoji" ? raw : "text";
  return {
    render_style,
    labels: (labelRes.data ?? []) as ScoringLabelRow[],
  };
}

export default async function VoortgangSettingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const data = await readPageData(result.tenant.id);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Voortgang"
        description="Stel in hoe scores worden weergegeven en beheer de positieve scoring-labels die trainers kunnen toekennen."
      />
      <ProgressSettingsPanels
        tenantId={result.tenant.id}
        initialRenderStyle={data.render_style}
        initialLabels={data.labels}
      />
    </div>
  );
}
