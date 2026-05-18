import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { UsersModule } from '../users/users.module'
import { ADMIN_READ_MODELS_REPOSITORY } from './admin-read-models.repository'
import { AdminReadModelsService } from './admin-read-models.service'
import { AdminController } from './admin.controller'
import { GlobalAdminGuard } from './guards/global-admin.guard'
import { PrismaAdminReadModelsRepository } from './prisma-admin-read-models.repository'

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AdminController],
  providers: [
    GlobalAdminGuard,
    AdminReadModelsService,
    { provide: ADMIN_READ_MODELS_REPOSITORY, useClass: PrismaAdminReadModelsRepository },
  ],
})
export class AdminModule {}
