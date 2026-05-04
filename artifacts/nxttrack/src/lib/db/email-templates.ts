import { createClient } from "@/lib/supabase/server";
import type { EmailTemplate } from "@/types/database";

export async function getEmailTemplatesByTenant(
  tenantId: string,
): Promise<EmailTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailTemplate[];
}

export async function getEmailTemplateById(
  id: string,
  tenantId: string,
): Promise<EmailTemplate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EmailTemplate | null) ?? null;
}
