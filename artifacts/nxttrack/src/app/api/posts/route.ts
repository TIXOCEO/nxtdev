import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth/get-user";
import { getFeedPosts, getViewerVisibilityContext } from "@/lib/db/social";
import { createPost } from "@/lib/actions/public/social";

const querySchema = z.object({
  tenant_id: z.string().uuid(),
  limit: z.coerce.number().min(1).max(50).optional(),
  cursor: z.string().nullable().optional(),
  filter: z.enum(["all", "team", "coach", "achievements"]).optional(),
});

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige query" }, { status: 400 });
  }
  // Tenant membership check.
  const vis = await getViewerVisibilityContext(parsed.data.tenant_id, user.id);
  if (!vis.isAdmin && vis.viewerMemberIds.length === 0) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const data = await getFeedPosts({
    tenantId: parsed.data.tenant_id,
    userId: user.id,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor ?? null,
    filter: parsed.data.filter ?? "all",
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }
  const result = await createPost(body as Parameters<typeof createPost>[0]);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data);
}
