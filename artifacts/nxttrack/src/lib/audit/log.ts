import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Audit-log helper.
 *
 * Schrijft naar `public.audit_logs` (zie `supabase/sprint26_audit_logs.sql`)
 * via de service-role client zodat RLS geen rol speelt op de write-pad.
 * Lezen gebeurt onder authenticated met `has_tenant_access(tenant_id)`.
 *
 * Best-effort: een falende insert mag de business-actie niet stuk maken.
 * We loggen de fout naar de console en geven `void` terug.
 *
 * Callers mogen NOOIT gevoelige raw-waarden meegeven (bv. unmasked IBAN);
 * geef referenties of booleans (`has_iban: true`).
 */

export interface AuditEntry {
  tenant_id: string;
  actor_user_id: string;
  member_id?: string | null;
  action: string;
  /** Structured context — must NOT contain secrets/PII bodies. */
  meta?: Record<string, string | number | boolean | null>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      tenant_id: entry.tenant_id,
      actor_user_id: entry.actor_user_id,
      member_id: entry.member_id ?? null,
      action: entry.action,
      meta: entry.meta ?? {},
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[audit] insert failed:", error.message, {
        action: entry.action,
        tenant_id: entry.tenant_id,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[audit] unexpected error:",
      err instanceof Error ? err.message : err,
      { action: entry.action, tenant_id: entry.tenant_id },
    );
  }
}
