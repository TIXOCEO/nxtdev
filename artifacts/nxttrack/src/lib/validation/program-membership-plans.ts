import { z } from "zod";

const Uuid = z.string().uuid();

export const linkProgramMembershipPlanSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  membership_plan_id: Uuid,
  is_default: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type LinkProgramMembershipPlanInput = z.infer<
  typeof linkProgramMembershipPlanSchema
>;

export const unlinkProgramMembershipPlanSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  membership_plan_id: Uuid,
});
export type UnlinkProgramMembershipPlanInput = z.infer<
  typeof unlinkProgramMembershipPlanSchema
>;

export const setProgramMembershipPlanDefaultSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  membership_plan_id: Uuid,
});
export type SetProgramMembershipPlanDefaultInput = z.infer<
  typeof setProgramMembershipPlanDefaultSchema
>;
