import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Newsletter } from "@/types/database";

export async function listNewslettersByTenant(
  tenantId: string,
): Promise<Newsletter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Newsletter[];
}

export async function getNewsletterById(
  id: string,
  tenantId: string,
): Promise<Newsletter | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Newsletter | null) ?? null;
}

export async function getNewsletterByIdAdmin(
  id: string,
  tenantId: string,
): Promise<Newsletter | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Newsletter | null) ?? null;
}
