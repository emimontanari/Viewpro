import { IsIn } from 'class-validator'

/**
 * DTO for PATCH /operators/tenants/:id/status
 *
 * ACTIVE, SUSPENDED, and CANCELLED are accepted: these are the writable
 * target statuses InmoView's AdminTenantStatusService supports (CANCELLED
 * added — vision D6, tenant CANCELLED lifecycle). CANCELLED is forwarded
 * unchanged to InmoView, which enforces terminality server-side (a tenant
 * that is already CANCELLED rejects any further transition with 400,
 * relayed unchanged — see platform-control-lane-outbound spec). TRIAL
 * remains rejected locally: it is an initial-only status, never a settable
 * target, so sending it would be rejected by InmoView anyway; we reject it
 * locally with a 400 so no outbound call is ever made.
 */
export class SetTenantStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
}
