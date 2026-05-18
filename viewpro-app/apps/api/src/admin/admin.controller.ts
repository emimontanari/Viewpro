import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/guards/auth.guard'
import { GlobalAdminGuard } from './guards/global-admin.guard'
import { createAdminAccessCheckResponse, type AdminAccessCheckResponse } from './responses/admin-access-check.response'

@Controller('admin')
@UseGuards(AuthGuard, GlobalAdminGuard)
export class AdminController {
  @Get('access-check')
  accessCheck(): AdminAccessCheckResponse {
    return createAdminAccessCheckResponse()
  }
}
