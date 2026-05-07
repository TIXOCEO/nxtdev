import { NextResponse, type NextRequest } from "next/server";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { searchMembersForGroup } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

const VALID_ROLES = ["parent", "athlete", "trainer", "staff", "volunteer"];

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const groupId = url.searchParams.get("group_id") ?? id;
  const roleParam = url.searchParams.get("role");
  const role = roleParam && VALID_ROLES.includes(roleParam) ? [roleParam] : undefined;

  const hits = await searchMembersForGroup(result.tenant.id, q, {
    excludeGroupId: groupId,
    roles: role,
    limit: 20,
  });

  return NextResponse.json({ hits });
}
