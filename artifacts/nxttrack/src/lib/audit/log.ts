/**
 * Sprint E — lightweight audit-log shim.
 *
 * There is no `audit_log` table in the schema yet. This helper provides a
 * stable API so future sprints can wire it to a real table without a
 * migration on every caller. For now it records to `req.log`-style
 * console output (server-side only) and returns void.
 *
 * Callers should NEVER include sensitive raw values (e.g. unmasked IBAN);
 * pass references instead (e.g. member id + action name).
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
  // Intentionally lightweight: server-side log line only.
  // Sprint F/G can replace this body with a real DB insert without
  // touching call sites.
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.info("[audit]", JSON.stringify(entry));
  }
}
