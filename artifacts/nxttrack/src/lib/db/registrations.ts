import { createClient } from "@/lib/supabase/server";
import type { Registration } from "@/types/database";

export interface CreateRegistrationInput {
  tenant_id: string;
  parent_name: string;
  parent_email: string;
  parent_phone?: string | null;
  child_name: string;
  child_age?: number | null;
  message?: string | null;
}

export async function createRegistration(
  input: CreateRegistrationInput,
): Promise<Registration> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create registration: ${error?.message ?? "unknown error"}`);
  }
  return data as Registration;
}
