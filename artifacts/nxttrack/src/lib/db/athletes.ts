import { createClient } from "@/lib/supabase/server";
import type { Athlete } from "@/types/database";

export async function getAthleteByCode(code: string): Promise<Athlete | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("athletes")
    .select("*")
    .eq("athlete_code", code.toUpperCase())
    .maybeSingle();

  if (error || !data) return null;
  return data as Athlete;
}

export async function getLinkedAthletesForParent(
  parentUserId: string,
): Promise<Athlete[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parent_athlete_links")
    .select("athletes(*)")
    .eq("parent_user_id", parentUserId)
    .eq("link_status", "active");

  if (error) {
    throw new Error(`Failed to fetch linked athletes: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as Array<{ athletes: Athlete | Athlete[] | null }>;
  return rows.flatMap((row) => {
    if (!row.athletes) return [];
    return Array.isArray(row.athletes) ? row.athletes : [row.athletes];
  });
}
