import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { RequestWithTenantContext, TenantContext } from './tenant-context.types'

export const CurrentTenant = createParamDecorator((_data: unknown, context: ExecutionContext): TenantContext | undefined => {
  const request = context.switchToHttp().getRequest<Request & RequestWithTenantContext>()
  return request.tenantContext
})
