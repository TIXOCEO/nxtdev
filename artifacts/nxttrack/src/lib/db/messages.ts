import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Conversation,
  ConversationParticipant,
  Member,
  Message,
} from "@/types/database";

/** Sender / recipient "side". Drives which members may be messaged. */
export type MessagingSide = "staff" | "parent";

const STAFF_ROLES = new Set(["trainer", "staff", "volunteer"]);

/** Return the member row of `userId` within `tenantId`, or null. */
export async function getMyMember(
  tenantId: string,
  userId: string,
): Promise<Member | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Member) ?? null;
}

/**
 * Return the messaging side of a member. A user is considered "staff"
 * for messaging if they are a tenant admin OR have a trainer/staff/volunteer
 * role on their member entry.
 */
export async function getMessagingSide(
  tenantId: string,
  member: Member,
  isTenantAdmin: boolean,
): Promise<MessagingSide> {
  if (isTenantAdmin) return "staff";
  const admin = createAdminClient();
  const { data } = await admin
    .from("member_roles")
    .select("role")
    .eq("member_id", member.id);
  const roles = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  return roles.some((r) => STAFF_ROLES.has(r)) ? "staff" : "parent";
}

export interface ConversationListRow {
  conversation: Conversation;
  participants: { member_id: string; full_name: string | null }[];
  last_message: { body: string; created_at: string; sender_member_id: string } | null;
  unread_count: number;
}

/** All conversations the given member participates in, newest first. */
export async function listConversationsForMember(
  tenantId: string,
  memberId: string,
): Promise<ConversationListRow[]> {
  const admin = createAdminClient();

  const { data: parts } = await admin
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("tenant_id", tenantId)
    .eq("member_id", memberId);
  const myParts = (parts ?? []) as Array<{
    conversation_id: string;
    last_read_at: string | null;
  }>;
  if (myParts.length === 0) return [];
  const ids = myParts.map((p) => p.conversation_id);

  const [{ data: convs }, { data: allParts }, { data: latestMsgs }] =
    await Promise.all([
      admin
        .from("conversations")
        .select("*")
        .in("id", ids)
        .order("last_message_at", { ascending: false }),
      admin
        .from("conversation_participants")
        .select("conversation_id, member_id, members:member_id(full_name)")
        .in("conversation_id", ids),
      admin
        .from("messages")
        .select("conversation_id, body, created_at, sender_member_id")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false }),
    ]);

  const partsByConv = new Map<string, { member_id: string; full_name: string | null }[]>();
  for (const p of (allParts ?? []) as unknown as Array<{
    conversation_id: string;
    member_id: string;
    members: { full_name: string | null } | { full_name: string | null }[] | null;
  }>) {
    const arr = partsByConv.get(p.conversation_id) ?? [];
    const m = Array.isArray(p.members) ? p.members[0] : p.members;
    arr.push({ member_id: p.member_id, full_name: m?.full_name ?? null });
    partsByConv.set(p.conversation_id, arr);
  }

  const lastByConv = new Map<
    string,
    { body: string; created_at: string; sender_member_id: string }
  >();
  for (const m of (latestMsgs ?? []) as Array<{
    conversation_id: string;
    body: string;
    created_at: string;
    sender_member_id: string;
  }>) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, {
        body: m.body,
        created_at: m.created_at,
        sender_member_id: m.sender_member_id,
      });
    }
  }

  const lastReadByConv = new Map<string, string | null>();
  for (const p of myParts) lastReadByConv.set(p.conversation_id, p.last_read_at);

  // Unread counts — messages after last_read_at, excluding own.
  const unreadByConv = new Map<string, number>();
  for (const m of (latestMsgs ?? []) as Array<{
    conversation_id: string;
    created_at: string;
    sender_member_id: string;
  }>) {
    const lr = lastReadByConv.get(m.conversation_id);
    const isUnread =
      m.sender_member_id !== memberId && (!lr || new Date(m.created_at) > new Date(lr));
    if (isUnread) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return ((convs ?? []) as Conversation[]).map((c) => ({
    conversation: c,
    participants: partsByConv.get(c.id) ?? [],
    last_message: lastByConv.get(c.id) ?? null,
    unread_count: unreadByConv.get(c.id) ?? 0,
  }));
}

/** Total unread messages across all conversations of a member. */
export async function getMessagesUnreadCount(
  tenantId: string,
  memberId: string,
): Promise<number> {
  const rows = await listConversationsForMember(tenantId, memberId);
  return rows.reduce((acc, r) => acc + r.unread_count, 0);
}

export interface ConversationDetail {
  conversation: Conversation;
  participants: Array<{ member_id: string; full_name: string | null }>;
  messages: Message[];
}

export async function getConversationDetail(
  conversationId: string,
  tenantId: string,
): Promise<ConversationDetail | null> {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!c) return null;
  const [{ data: parts }, { data: msgs }] = await Promise.all([
    admin
      .from("conversation_participants")
      .select("member_id, members:member_id(full_name)")
      .eq("conversation_id", conversationId),
    admin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);
  return {
    conversation: c as Conversation,
    participants: ((parts ?? []) as unknown as Array<{
      member_id: string;
      members: { full_name: string | null } | { full_name: string | null }[] | null;
    }>).map((p) => {
      const m = Array.isArray(p.members) ? p.members[0] : p.members;
      return { member_id: p.member_id, full_name: m?.full_name ?? null };
    }),
    messages: (msgs ?? []) as Message[],
  };
}

/** Is `memberId` a participant in `conversationId`? */
export async function isParticipant(
  conversationId: string,
  memberId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("conversation_participants")
    .select("member_id")
    .eq("conversation_id", conversationId)
    .eq("member_id", memberId)
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * List the members of a tenant that the given side may message.
 *  - "parent" → trainers + staff + tenant admins (i.e. only the staff side)
 *  - "staff"  → all other members of the tenant
 */
export async function listMessageRecipients(
  tenantId: string,
  side: MessagingSide,
  excludeMemberId: string,
): Promise<Array<{ id: string; full_name: string; is_staff: boolean }>> {
  const admin = createAdminClient();
  const [{ data: members }, { data: roles }, { data: adminships }] = await Promise.all([
    admin
      .from("members")
      .select("id, full_name, user_id")
      .eq("tenant_id", tenantId)
      .neq("id", excludeMemberId)
      .order("full_name"),
    admin
      .from("member_roles")
      .select("member_id, role")
      .in(
        "member_id",
        // we'll filter after fetching; supabase doesn't support this easily inline
        [],
      ),
    admin
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId),
  ]);

  // The above .in([]) trick doesn't work — fetch all member_roles for the tenant.
  const { data: rolesAll } = await admin
    .from("member_roles")
    .select("member_id, role, members!inner(tenant_id)")
    .eq("members.tenant_id", tenantId);

  const rolesByMember = new Map<string, Set<string>>();
  for (const r of (rolesAll ?? []) as Array<{ member_id: string; role: string }>) {
    const set = rolesByMember.get(r.member_id) ?? new Set<string>();
    set.add(r.role);
    rolesByMember.set(r.member_id, set);
  }
  const adminUserIds = new Set(
    ((adminships ?? []) as Array<{ user_id: string }>).map((a) => a.user_id),
  );

  // Suppress unused-var warning for the early `roles` placeholder.
  void roles;

  const out: Array<{ id: string; full_name: string; is_staff: boolean }> = [];
  for (const m of (members ?? []) as Array<{
    id: string;
    full_name: string;
    user_id: string | null;
  }>) {
    const memberRoles = rolesByMember.get(m.id) ?? new Set();
    const isStaffRole = [...memberRoles].some((r) => STAFF_ROLES.has(r));
    const isAdmin = !!m.user_id && adminUserIds.has(m.user_id);
    const isStaff = isStaffRole || isAdmin;
    if (side === "parent" && !isStaff) continue;
    if (side === "staff" && false) continue; // staff sees everyone
    out.push({ id: m.id, full_name: m.full_name, is_staff: isStaff });
  }
  return out;
}

/** Whether `memberId` belongs to `tenantId` (sanity check). */
export async function memberBelongsToTenant(
  memberId: string,
  tenantId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return !!data;
}

export type { Conversation, ConversationParticipant, Message };
