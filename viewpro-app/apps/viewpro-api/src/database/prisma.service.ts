import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma-platform/client'
import { assertSafeTestDatabaseUrl } from './test-database-url.guard'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    assertSafeTestDatabaseUrl()
    super()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
