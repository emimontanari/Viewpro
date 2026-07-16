import { IsIn } from 'class-validator'
import type { PlanCode } from '../../platform-plans/plan-catalog'

/**
 * DTO for PATCH /operators/tenants/:id/plan
 *
 * Only the three fixed catalog tiers (D10) are accepted. An unknown plan
 * value is rejected locally with a 400 — no outbound control-lane call is
 * ever made for an invalid tier.
 */
export class SetTenantPlanDto {
  @IsIn(['BASICO', 'PROFESIONAL', 'EMPRESA'])
  plan!: PlanCode
}
