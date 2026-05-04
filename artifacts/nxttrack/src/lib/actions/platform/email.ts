"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  sendRawTestEmailSchema,
  type SendRawTestEmailInput,
} from "@/lib/validation/email-settings";
import {
  sendRawEmail,
  verifyEmailProvider,
} from "@/lib/email/send-email";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Verify the SendGrid API key (no email is sent). */
export async function testSmtpConnection(): Promise<
  ActionResult<{ verified: true }>
> {
  await requirePlatformAdmin();
  const res = await verifyEmailProvider();
  if (!res.ok) return fail(res.error ?? "Verification failed.");
  return { ok: true, data: { verified: true } };
}

/**
 * Send a raw test email through SendGrid.
 *
 * If `tenant_id` is supplied, the From: identity is resolved against that
 * tenant (so platform admins can verify the domain-fallback rule).
 * Otherwise the platform default sender (`MAIL_DEFAULT_FROM_*`) is used.
 */
export async function sendRawTestEmail(
  input: SendRawTestEmailInput,
): Promise<ActionResult<{ messageId?: string; fromEmail?: string }>> {
  const parsed = sendRawTestEmailSchema.safeParse(input);
  if (!parsed.success)
    return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await requirePlatformAdmin();
  const res = await sendRawEmail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.body,
    tenantId: parsed.data.tenant_id ?? null,
    triggerSource: "platform_test",
  });
  if (!res.ok) return fail(res.error ?? "Send failed.");

  revalidatePath("/platform/email/logs");
  return {
    ok: true,
    data: { messageId: res.messageId, fromEmail: res.fromEmail },
  };
}
