import { z } from "zod";

export const createSponsorSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(1, "Naam is verplicht").max(160),
  logo_url: z.string().trim().max(500).nullable().optional(),
  website_url: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
});
