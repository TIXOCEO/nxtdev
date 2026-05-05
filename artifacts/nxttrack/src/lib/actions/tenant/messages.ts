"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMessagingSide,
  getMyMember,
  isParticipant,
  memberBelongsToTenant,
} from "@/lib/db/messages";
import { sendNotification } from "@/lib/notifications/send-notification";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Compose / create a new conversation ───────────────────────────────
const createSchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(8000),
  recipient_member_ids: z.array(z.string().uuid()).min(1),
});

export async function createConversation(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ conversation_id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const user = await requireAuth();
  const [memberships, adminRoleTenantIds] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const isAdmin = hasTenantAccess(memberships, parsed.data.tenant_id, adminRoleTenantIds);

  const me = await getMyMember(parsed.data.tenant_id, user.id);
  if (!me) return { ok: false, error: "Geen lidprofiel binnen deze tenant" };

  const side = await getMessagingSide(parsed.data.tenant_id, me, isAdmin);

  const recipients = Array.from(new Set(parsed.data.recipient_member_ids)).filter(
    (id) => id !== me.id,
  );
  if (recipients.length === 0) return { ok: false, error: "Kies minstens één ontvanger" };

  // Parent/athlete may not start a group conversation amongst peers — they
  // may only target trainers / admins. Verify each recipient is "staff".
  if (side === "parent") {
    const admin = createAdminClient();
    const { data: rolesData } = await admin
      .from("member_roles")
      .select("member_id, role")
      .in("member_id", recipients);
    const { data: msData } = await admin
      .from("members")
      .select("id, user_id, tenant_id")
      .in("id", recipients);
    const { data: adminUsers } = await admin
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", parsed.data.tenant_id);
    const adminUserIds = new Set(
      ((adminUsers ?? []) as Array<{ user_id: string }>).map((a) => a.user_id),
    );
    const STAFF = new Set(["trainer", "staff", "volunteer"]);
    const rolesByMember = new Map<string, Set<string>>();
    for (const r of (rolesData ?? []) as Array<{ member_id: string; role: string }>) {
      const s = rolesByMember.get(r.member_id) ?? new Set<string>();
      s.add(r.role);
      rolesByMember.set(r.member_id, s);
    }
    for (const m of (msData ?? []) as Array<{
      id: string;
      user_id: string | null;
      tenant_id: string;
    }>) {
      if (m.tenant_id !== parsed.data.tenant_id) {
        return { ok: false, error: "Ontvanger hoort niet bij deze tenant" };
      }
      const isStaffRole = [...(rolesByMember.get(m.id) ?? [])].some((r) => STAFF.has(r));
      const isStaffAdmin = !!m.user_id && adminUserIds.has(m.user_id);
      if (!isStaffRole && !isStaffAdmin) {
        return {
          ok: false,
          error: "Je kan alleen trainers of beheerders berichten",
        };
      }
    }
  } else {
    // Staff side — verify each recipient belongs to this tenant.
    for (const rid of recipients) {
      if (!(await memberBelongsToTenant(rid, parsed.data.tenant_id))) {
        return { ok: false, error: "Ontvanger hoort niet bij deze tenant" };
      }
    }
  }

  const admin = createAdminClient();

  // 1. Create conversation
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({
      tenant_id: parsed.data.tenant_id,
      title: parsed.data.title,
      created_by_member_id: me.id,
    })
    .select("id")
    .single();
  if (convErr || !conv) {
    return { ok: false, error: convErr?.message ?? "Kon gesprek niet maken" };
  }

  // 2. Insert participants (sender + recipients)
  const allParticipants = Array.from(new Set([me.id, ...recipients]));
  const partsRows = allParticipants.map((mid) => ({
    conversation_id: conv.id,
    member_id: mid,
    tenant_id: parsed.data.tenant_id,
    last_read_at: mid === me.id ? new Date().toISOString() : null,
  }));
  const { error: pErr } = await admin
    .from("conversation_participants")
    .insert(partsRows);
  if (pErr) return { ok: false, error: pErr.message };

  // 3. Insert first message
  const { error: mErr } = await admin.from("messages").insert({
    conversation_id: conv.id,
    tenant_id: parsed.data.tenant_id,
    sender_member_id: me.id,
    body: parsed.data.body,
  });
  if (mErr) return { ok: false, error: mErr.message };

  // 4. Notify recipients (best-effort)
  await fanoutNotification(
    parsed.data.tenant_id,
    parsed.data.title,
    parsed.data.body,
    recipients,
    me.full_name,
    user.id,
  );

  revalidatePath("/t");
  return { ok: true, data: { conversation_id: conv.id } };
}

// ─── Reply ────────────────────────────────────────────────────────────
const replySchema = z.object({
  tenant_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1).max(8000),
});
export async function replyToConversation(
  input: z.infer<typeof replySchema>,
): Promise<ActionResult<void>> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const user = await requireAuth();
  const me = await getMyMember(parsed.data.tenant_id, user.id);
  if (!me) return { ok: false, error: "Geen lidprofiel binnen deze tenant" };

  const [memberships, adminRoleTenantIds] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  const isAdmin = hasTenantAccess(memberships, parsed.data.tenant_id, adminRoleTenantIds);
  const part = await isParticipant(parsed.data.conversation_id, me.id);
  if (!part && !isAdmin) {
    return { ok: false, error: "Geen toegang tot dit gesprek" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("messages").insert({
    conversation_id: parsed.data.conversation_id,
    tenant_id: parsed.data.tenant_id,
    sender_member_id: me.id,
    body: parsed.data.body,
  });
  if (error) return { ok: false, error: error.message };

  // Notify the other participants (best-effort).
  const { data: parts } = await admin
    .from("conversation_participants")
    .select("member_id")
    .eq("conversation_id", parsed.data.conversation_id);
  const others = ((parts ?? []) as Array<{ member_id: string }>)
    .map((p) => p.member_id)
    .filter((id) => id !== me.id);
  const { data: conv } = await admin
    .from("conversations")
    .select("title")
    .eq("id", parsed.data.conversation_id)
    .maybeSingle();
  await fanoutNotification(
    parsed.data.tenant_id,
    `Nieuw bericht: ${conv?.title ?? ""}`.slice(0, 160),
    parsed.data.body,
    others,
    me.full_name,
    user.id,
  );

  revalidatePath(`/t`);
  return { ok: true, data: undefined };
}

// ─── Mark read ────────────────────────────────────────────────────────
const markSchema = z.object({
  tenant_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
});
export async function markConversationRead(
  input: z.infer<typeof markSchema>,
): Promise<ActionResult<void>> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await requireAuth();
  const me = await getMyMember(parsed.data.tenant_id, user.id);
  if (!me) return { ok: false, error: "Geen lidprofiel" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", parsed.data.conversation_id)
    .eq("member_id", me.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/t");
  return { ok: true, data: undefined };
}

// ─── Delete (leave) conversation ──────────────────────────────────────
const deleteConvSchema = z.object({
  tenant_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
});
export async function deleteConversationForMe(
  input: z.infer<typeof deleteConvSchema>,
): Promise<ActionResult<void>> {
  const parsed = deleteConvSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await requireAuth();
  const me = await getMyMember(parsed.data.tenant_id, user.id);
  if (!me) return { ok: false, error: "Geen lidprofiel" };
  const admin = createAdminClient();
  // Remove just my participation. If no participants remain, drop the conv.
  const { error } = await admin
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", parsed.data.conversation_id)
    .eq("member_id", me.id);
  if (error) return { ok: false, error: error.message };

  const { count } = await admin
    .from("conversation_participants")
    .select("conversation_id", { count: "exact", head: true })
    .eq("conversation_id", parsed.data.conversation_id);
  if ((count ?? 0) === 0) {
    await admin.from("conversations").delete().eq("id", parsed.data.conversation_id);
  }

  revalidatePath("/t");
  return { ok: true, data: undefined };
}

// ─── Helpers ──────────────────────────────────────────────────────────
async function fanoutNotification(
  tenantId: string,
  title: string,
  body: string,
  recipientMemberIds: string[],
  fromName: string,
  createdByUserId: string,
): Promise<void> {
  if (recipientMemberIds.length === 0) return;
  try {
    await sendNotification({
      tenantId,
      title: `Bericht van ${fromName}: ${title}`.slice(0, 200),
      contentText: body.slice(0, 600),
      targets: recipientMemberIds.map((id) => ({
        target_type: "member",
        target_id: id,
      })),
      sendEmail: false,
      sendPush: true,
      source: "messages",
      createdBy: createdByUserId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[messages] notification fanout failed:", err);
  }
}
