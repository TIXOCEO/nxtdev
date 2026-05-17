import "server-only";

/**
 * Sprint 77 — feature-flag helper voor parent-portal notificatie-types.
 *
 * Tenants kunnen in `tenants.settings_json.parent_notifications` per
 * notification-source-key aan/uit zetten of een specifiek type ouders
 * bereikt. Ontbrekende keys = aan (default-on).
 *
 * Hoort logisch bij send-notification.ts: voor een `child_*`-key wordt
 * deze helper eerst geraadpleegd; bij `false` slaan we de notify-call
 * volledig over (resolve + insert).
 *
 * Wordt pas in Sprint 78 daadwerkelijk aangeroepen door de UI/triggers.
 * Voor Sprint 77 reserveren we alleen de helper + key-set zodat de
 * downstream sprints meteen aan kunnen koppelen zonder schema-werk.
 */

export const PARENT_NOTIFICATION_KEYS = [
  "child_attendance_recorded",
  "child_attendance_missed",
  "child_session_cancelled",
  "child_membership_expiring",
  "child_placement_offered",
  "child_note_published",
] as const;

export type ParentNotificationKey = (typeof PARENT_NOTIFICATION_KEYS)[number];

export function isParentNotificationKey(
  key: string,
): key is ParentNotificationKey {
  return (PARENT_NOTIFICATION_KEYS as readonly string[]).includes(key);
}

/**
 * Lees uit een `tenants.settings_json`-blob of een specifiek parent-notif-
 * type aan staat. Onbekende of ontbrekende keys → true (default-on).
 */
export function isParentNotificationEnabled(
  settingsJson: Record<string, unknown> | null | undefined,
  key: ParentNotificationKey,
): boolean {
  if (!settingsJson || typeof settingsJson !== "object") return true;
  const flags = (settingsJson as { parent_notifications?: unknown })
    .parent_notifications;
  if (!flags || typeof flags !== "object") return true;
  const value = (flags as Record<string, unknown>)[key];
  if (value === undefined || value === null) return true;
  return Boolean(value);
}
