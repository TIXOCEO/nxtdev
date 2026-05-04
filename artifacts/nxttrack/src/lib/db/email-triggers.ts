import { createClient } from "@/lib/supabase/server";
import type { EmailTrigger } from "@/types/database";

export async function getEmailTriggersByTenant(
  tenantId: string,
): Promise<EmailTrigger[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_triggers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("event_key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailTrigger[];
}
