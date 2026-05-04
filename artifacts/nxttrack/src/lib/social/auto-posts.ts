import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSocialSettings } from "@/lib/db/social";

interface AchievementInput {
  tenantId: string;
  memberId: string;
  title: string;
  description?: string | null;
  mediaUrl?: string | null;
}

interface SystemPostInput {
  tenantId: string;
  type: "system" | "birthday" | "training_recap";
  content: string;
  mediaUrl?: string | null;
  visibility?: "tenant" | "team" | "trainers" | "private";
  targetId?: string | null;
}

/** Optionally create an achievement post (skipped if auto_posts is disabled). */
export async function createAchievementPost(
  input: AchievementInput,
): Promise<{ id: string } | null> {
  const settings = await getSocialSettings(input.tenantId);
  if (!settings.allow_auto_posts) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .insert({
      tenant_id: input.tenantId,
      author_member_id: input.memberId,
      type: "achievement",
      content: input.description
        ? `${input.title}\n\n${input.description}`
        : input.title,
      media_url: input.mediaUrl ?? null,
      media_type: input.mediaUrl ? "image" : null,
      visibility: "tenant",
      comments_enabled: settings.allow_comments,
    })
    .select("id")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[auto-posts] achievement:", error?.message);
    return null;
  }
  return { id: (data as { id: string }).id };
}

/** Create a system post (only when auto_posts is enabled). */
export async function createSystemPost(
  input: SystemPostInput,
): Promise<{ id: string } | null> {
  const settings = await getSocialSettings(input.tenantId);
  if (!settings.allow_auto_posts) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .insert({
      tenant_id: input.tenantId,
      author_member_id: null,
      type: input.type,
      content: input.content,
      media_url: input.mediaUrl ?? null,
      media_type: input.mediaUrl ? "image" : null,
      visibility: input.visibility ?? "tenant",
      target_id: input.targetId ?? null,
      comments_enabled: settings.allow_comments,
    })
    .select("id")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[auto-posts] system:", error?.message);
    return null;
  }
  return { id: (data as { id: string }).id };
}
