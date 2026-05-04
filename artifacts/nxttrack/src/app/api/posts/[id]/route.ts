import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import {
  getPostById,
  getViewerVisibilityContext,
  getSocialSettings,
} from "@/lib/db/social";
import { canViewPost } from "@/lib/permissions/social";
import { updatePost, deletePost } from "@/lib/actions/public/social";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const tenantId = new URL(req.url).searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id required" }, { status: 400 });
  }
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const vis = await getViewerVisibilityContext(tenantId, user.id);
  if (!vis.isAdmin && vis.viewerMemberIds.length === 0) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }
  const post = await getPostById(id, tenantId);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await getSocialSettings(tenantId);
  if (
    vis.isMinorViewer &&
    !settings.minor_team_feed_allowed &&
    post.visibility === "team"
  ) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }
  if (
    !canViewPost(post, {
      isAdmin: vis.isAdmin,
      viewerMemberIds: vis.viewerMemberIds,
      viewerGroupIds: vis.viewerGroupIds,
      viewerRoles: vis.viewerRoles,
      viewerIsTrainerLike: vis.viewerIsTrainerLike,
    })
  ) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }
  return NextResponse.json(post);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await updatePost({
    ...(body as object),
    id,
  } as Parameters<typeof updatePost>[0]);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const tenantId = new URL(req.url).searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id required" }, { status: 400 });
  }
  const result = await deletePost({ tenant_id: tenantId, id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
