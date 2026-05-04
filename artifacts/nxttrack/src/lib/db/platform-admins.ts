import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformAdminRow {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

/**
 * Returns all rows in `tenant_memberships` with role='platform_admin'
 * and tenant_id IS NULL, joined with the auth user's email + profile name.
 * Service-role only (bypasses RLS).
 */
export async function listPlatformAdmins(): Promise<PlatformAdminRow[]> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("tenant_memberships")
    .select("id, user_id, created_at")
    .eq("role", "platform_admin")
    .is("tenant_id", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to list platform admins: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const userIds = rows.map((r) => r.user_id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      { email: p.email as string, full_name: (p.full_name as string | null) ?? null },
    ]),
  );

  // Fallback: any user without a profile row — fetch via auth.admin.
  const missing = userIds.filter((id) => !profileMap.has(id));
  if (missing.length > 0) {
    // listUsers does not support filtering by ids; paginate up to 1000.
    let page = 1;
    while (missing.length > 0 && page <= 5) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (!list || list.users.length === 0) break;
      for (const u of list.users) {
        if (missing.includes(u.id)) {
          profileMap.set(u.id, {
            email: (u.email ?? "").toLowerCase(),
            full_name: (u.user_metadata?.full_name as string | undefined) ?? null,
          });
        }
      }
      if (list.users.length < 200) break;
      page += 1;
    }
  }

  return rows.map((r) => {
    const p = profileMap.get(r.user_id) ?? { email: "(onbekend)", full_name: null };
    return {
      membership_id: r.id as string,
      user_id: r.user_id as string,
      email: p.email,
      full_name: p.full_name,
      created_at: r.created_at as string,
    };
  });
}
