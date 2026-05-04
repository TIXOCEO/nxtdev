import { z } from "zod";

export const notificationTargetSchema = z.discriminatedUnion("target_type", [
  z.object({ target_type: z.literal("member"), target_id: z.string().uuid() }),
  z.object({ target_type: z.literal("group"),  target_id: z.string().uuid() }),
  z.object({ target_type: z.literal("role"),   target_id: z.string().min(1).max(40) }),
  z.object({ target_type: z.literal("all") }),
]);

export type NotificationTargetInput = z.infer<typeof notificationTargetSchema>;

export const createNotificationSchema = z
  .object({
    tenant_id: z.string().uuid(),
    title: z.string().trim().min(2, "Titel is verplicht").max(200),
    content_html: z.string().nullable().optional(),
    content_text: z.string().nullable().optional(),
    targets: z.array(notificationTargetSchema).min(1, "Selecteer minstens één ontvanger"),
    send_email: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    const hasContent =
      (val.content_html && val.content_html.replace(/<[^>]*>/g, "").trim().length > 0) ||
      (val.content_text && val.content_text.trim().length > 0);
    if (!hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content_html"],
        message: "Bericht mag niet leeg zijn",
      });
    }
  });

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
