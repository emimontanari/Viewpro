import { applyDecorators } from '@nestjs/common'
import { ApiForbiddenResponse, ApiHeader, ApiUnauthorizedResponse } from '@nestjs/swagger'

export function ApiTenantContext() {
  return applyDecorators(
    ApiHeader({
      name: 'x-tenant-id',
      required: true,
      description:
        'Real tenant id for tenant-scoped API requests. The frontend may navigate by slug, but backend authorization is based on this tenant id, the authenticated user membership, and role permissions.',
    }),
    ApiUnauthorizedResponse({ description: 'Authentication required' }),
    ApiForbiddenResponse({ description: 'Tenant context missing, tenant access denied, tenant inactive, or permission missing' }),
  )
}
