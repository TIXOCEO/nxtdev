import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberFinancialDetails } from "@/types/database";

/**
 * Sprint E — read the financial details for a single member.
 * Returns null when no row exists yet (member never set IBAN).
 *
 * Authorization is the caller's responsibility — this is a raw fetch.
 */
export async function getMemberFinancialDetails(
  memberId: string,
  tenantId: string,
): Promise<MemberFinancialDetails | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_financial_details")
    .select("*")
    .eq("member_id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load financial details: ${error.message}`);
  }
  return (data as MemberFinancialDetails | null) ?? null;
}

/**
 * Sprint E — return the masked + minimal projection that is safe to
 * embed in initial server-rendered HTML. Never includes the raw IBAN.
 */
export interface FinancialPublicView {
  has_iban: boolean;
  iban_masked: string | null;
  account_holder_name: string | null;
  payment_method_id: string | null;
}

export function toPublicView(
  row: MemberFinancialDetails | null,
  maskIban: (s: string | null | undefined) => string,
): FinancialPublicView {
  if (!row) {
    return {
      has_iban: false,
      iban_masked: null,
      account_holder_name: null,
      payment_method_id: null,
    };
  }
  return {
    has_iban: !!row.iban,
    iban_masked: row.iban ? maskIban(row.iban) : null,
    account_holder_name: row.account_holder_name,
    payment_method_id: row.payment_method_id,
  };
}
