import { Module } from '@nestjs/common'
import { PrismaTenantsRepository } from './prisma-tenants.repository'
import { TENANTS_REPOSITORY } from './tenants.repository'

@Module({
  providers: [{ provide: TENANTS_REPOSITORY, useClass: PrismaTenantsRepository }],
  exports: [TENANTS_REPOSITORY],
})
export class TenantsModule {}
