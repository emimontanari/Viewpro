import { Module } from '@nestjs/common'
import { PrismaMovementsRepository } from './prisma-movements.repository'
import { MOVEMENTS_REPOSITORY } from './movements.repository'

@Module({
  providers: [{ provide: MOVEMENTS_REPOSITORY, useClass: PrismaMovementsRepository }],
  exports: [MOVEMENTS_REPOSITORY],
})
export class MovementsModule {}
