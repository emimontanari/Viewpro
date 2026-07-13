import { IsIn } from 'class-validator'

/**
 * DTO for PATCH /operators/tenants/:id/status
 *
 * Only ACTIVE and SUSPENDED are accepted: these are the two statuses that
 * InmoView's AdminTenantStatusService supports as write targets. Sending
 * TRIAL or CANCELLED would be rejected by InmoView anyway; we reject them
 * locally with a 400 so no outbound call is ever made.
 */
export class SetTenantStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED'
}
