import { cookies } from "next/headers";

export const ACTIVE_TENANT_COOKIE = "nxt_active_tenant";

export async function readActiveTenantCookie(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(ACTIVE_TENANT_COOKIE)?.value;
  if (!v) return null;
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}
