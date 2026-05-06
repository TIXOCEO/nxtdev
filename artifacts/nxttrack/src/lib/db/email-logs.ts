import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EmailLog } from "@/types/database";

/** Tenant-scoped log read (uses RLS via the request-bound client). */
export async function getEmailLogsByTenant(
  tenantId: string,
  limit = 100,
): Promise<EmailLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailLog[];
}

/**
 * Platform-only: fetch every log entry, joined with the tenant name when
 * present. Caller MUST gate with `requirePlatformAdmin()`.
 */
export interface EmailLogWithTenant extends EmailLog {
  tenant_name: string | null;
}

/**
 * Sprint 39 — Haal email-historie op voor één lid via diens e-mailadres.
 * `email_logs` heeft (nog) geen member_id-kolom; e-mail is hier de natural
 * key. Case-insensitive vergelijken voorkomt false negatives bij verschillen
 * in casing tussen Supabase Auth en `members.email`.
 */
export async function getEmailLogsByMemberEmail(
  tenantId: string,
  email: string | null,
  limit = 50,
): Promise<EmailLog[]> {
  if (!email) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .ilike("recipient_email", email)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[email-logs] member query failed:", error.message);
    return [];
  }
  return (data ?? []) as EmailLog[];
}

export async function getAllEmailLogs(limit = 200): Promise<EmailLogWithTenant[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_logs")
    .select("*, tenants(name)")
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<EmailLog & { tenants: { name: string } | null }>).map(
    (r) => {
      const { tenants, ...rest } = r;
      return { ...rest, tenant_name: tenants?.name ?? null };
    },
  );
}
