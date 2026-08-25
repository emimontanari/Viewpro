import type { TenantRole, User } from '@prisma/client'
import type { MembershipWithTenant } from '../../memberships/memberships.repository'

export const AUTH_REGISTRATION_REPOSITORY = Symbol('AUTH_REGISTRATION_REPOSITORY')

export type RegisterTenantRecordInput = {
  email: string
  passwordHash: string
  firstName: string
  lastName?: string
  tenantName: string
  tenantSlug: string
  role: TenantRole
  // Canonical E.164 agency contact phone, already validated by
  // `parseArContactPhone` in the use case. Lands on `Tenant.whatsappPhone`
  // ONLY — never on `User.whatsappPhone` (spec.md "Personal phone remains
  // untouched").
  whatsappPhone: string
}

export type RegisteredTenantRecord = {
  user: User
  memberships: MembershipWithTenant[]
}

export type AuthRegistrationRepository = {
  registerTenant(input: RegisterTenantRecordInput): Promise<RegisteredTenantRecord>
}
