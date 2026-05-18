import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UsersModule } from '../users/users.module'
import { AdminController } from './admin.controller'
import { GlobalAdminGuard } from './guards/global-admin.guard'

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AdminController],
  providers: [GlobalAdminGuard],
})
export class AdminModule {}
