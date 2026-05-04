import { z } from "zod";

const tenantId = z.string().uuid({ message: "Tenant id is verplicht." });
const postId = z.string().uuid({ message: "Post id is verplicht." });
const memberId = z.string().uuid({ message: "Lid id is verplicht." });

const postType = z.enum([
  "user",
  "system",
  "achievement",
  "coach_broadcast",
  "training_recap",
  "birthday",
]);
const visibility = z.enum(["tenant", "team", "trainers", "private"], {
  errorMap: () => ({ message: "Ongeldige zichtbaarheid." }),
});
const mediaType = z.enum(["image", "video"]).nullable().optional();
const emoji = z.enum(["👍", "❤️", "👏", "🔥", "💪", "🎉"]);

export const createPostSchema = z
  .object({
    tenant_id: tenantId,
    type: postType.default("user"),
    content: z
      .string()
      .max(5000, { message: "Maximaal 5000 tekens." })
      .optional()
      .nullable(),
    media_url: z
      .string()
      .url({ message: "Ongeldige media URL." })
      .max(2000)
      .optional()
      .nullable(),
    media_type: mediaType,
    visibility,
    target_id: z.string().uuid().nullable().optional(),
    comments_enabled: z.boolean().default(true),
    coach_broadcast: z.boolean().default(false),
    mentioned_member_ids: z.array(z.string().uuid()).max(50).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.content && !v.media_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Bericht moet inhoud of media bevatten.",
      });
    }
    if ((v.visibility === "team" || v.visibility === "private") && !v.target_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_id"],
        message:
          v.visibility === "team"
            ? "Selecteer een groep voor team-zichtbaarheid."
            : "Selecteer een lid voor privé-zichtbaarheid.",
      });
    }
    if (v.media_url && !v.media_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["media_type"],
        message: "Mediatype is verplicht bij media URL.",
      });
    }
  });

export const updatePostSchema = z.object({
  tenant_id: tenantId,
  id: postId,
  content: z.string().max(5000).optional().nullable(),
  comments_enabled: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
});

export const deletePostSchema = z.object({
  tenant_id: tenantId,
  id: postId,
});

export const createCommentSchema = z.object({
  tenant_id: tenantId,
  post_id: postId,
  parent_id: z.string().uuid().nullable().optional(),
  content: z
    .string()
    .min(1, { message: "Bericht mag niet leeg zijn." })
    .max(1500, { message: "Maximaal 1500 tekens." }),
  mentioned_member_ids: z.array(z.string().uuid()).max(50).optional(),
});

export const deleteCommentSchema = z.object({
  tenant_id: tenantId,
  id: z.string().uuid(),
});

export const toggleLikeSchema = z.object({
  tenant_id: tenantId,
  post_id: postId,
  emoji: emoji.default("👍"),
});

export const updateSocialSettingsSchema = z.object({
  tenant_id: tenantId,
  allow_posts: z.boolean().optional(),
  allow_comments: z.boolean().optional(),
  allow_likes: z.boolean().optional(),
  allow_media: z.boolean().optional(),
  allow_auto_posts: z.boolean().optional(),
  allow_mentions: z.boolean().optional(),
  minor_read_only: z.boolean().optional(),
  minor_team_feed_allowed: z.boolean().optional(),
});

export const muteMemberSchema = z.object({
  tenant_id: tenantId,
  member_id: memberId,
  muted_until: z.string().datetime().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export const unmuteMemberSchema = z.object({
  tenant_id: tenantId,
  member_id: memberId,
});

export const moderationActionSchema = z.object({
  tenant_id: tenantId,
  id: z.string().uuid(),
  action: z.enum(["hide", "unhide", "toggle_comments"]),
});

export const hideCommentSchema = z.object({
  tenant_id: tenantId,
  id: z.string().uuid(),
  hide: z.boolean(),
});
