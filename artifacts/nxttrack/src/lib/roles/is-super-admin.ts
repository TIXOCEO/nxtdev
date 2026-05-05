/**
 * Sprint 22 — pure helper, opzettelijk los van "use server" actions.
 * Server Actions mogen alleen async functies exporteren; sync helpers
 * zoals deze horen in een gewoon util-bestand.
 */
export function isSuperAdminRole(role: { is_super_admin: boolean }): boolean {
  return role.is_super_admin === true;
}
