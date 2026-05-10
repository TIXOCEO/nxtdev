import { createClient } from "@/lib/supabase/server";

export interface ProgramMembershipPlanRow {
  membership_plan_id: string;
  plan_name: string;
  price: number | null;
  billing_period: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface AvailableMembershipPlanRow {
  id: string;
  name: string;
  price: number | null;
  billing_period: string | null;
}

type MaybeArray<T> = T | T[] | null;
function flat<T>(v: MaybeArray<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function listProgramMembershipPlans(
  tenantId: string,
  programId: string,
): Promise<ProgramMembershipPlanRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_membership_plans")
    .select(
      "membership_plan_id, is_default, sort_order, membership_plans!inner(id, name, price, billing_period, is_active, tenant_id)",
    )
    .eq("tenant_id", tenantId)
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listProgramMembershipPlans: ${error.message}`);

  return ((data ?? []) as Array<{
    membership_plan_id: string;
    is_default: boolean;
    sort_order: number;
    membership_plans: MaybeArray<{
      id: string;
      name: string;
      price: number | null;
      billing_period: string | null;
      is_active: boolean;
      tenant_id: string;
    }>;
  }>)
    .map((r) => {
      const p = flat(r.membership_plans);
      if (!p || p.tenant_id !== tenantId) return null;
      return {
        membership_plan_id: r.membership_plan_id,
        plan_name: p.name,
        price: p.price,
        billing_period: p.billing_period,
        is_active: p.is_active,
        is_default: r.is_default,
        sort_order: r.sort_order,
      };
    })
    .filter((x): x is ProgramMembershipPlanRow => x !== null)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.plan_name.localeCompare(b.plan_name, "nl"),
    );
}

export async function listAvailableMembershipPlansForProgram(
  tenantId: string,
  programId: string,
): Promise<AvailableMembershipPlanRow[]> {
  const supabase = await createClient();
  const [{ data: plans, error }, { data: existing }] = await Promise.all([
    supabase
      .from("membership_plans")
      .select("id, name, price, billing_period, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("program_membership_plans")
      .select("membership_plan_id")
      .eq("tenant_id", tenantId)
      .eq("program_id", programId),
  ]);
  if (error) throw new Error(`listAvailableMembershipPlansForProgram: ${error.message}`);

  const taken = new Set(
    ((existing ?? []) as Array<{ membership_plan_id: string }>).map(
      (r) => r.membership_plan_id,
    ),
  );
  return ((plans ?? []) as Array<{
    id: string;
    name: string;
    price: number | null;
    billing_period: string | null;
    is_active: boolean;
  }>)
    .filter((p) => !taken.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      billing_period: p.billing_period,
    }));
}
