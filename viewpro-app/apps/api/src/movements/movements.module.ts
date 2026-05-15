import { Module } from '@nestjs/common'
import { PropertyEngagementsModule } from '../property-engagements/property-engagements.module'
import { PrismaMovementsRepository } from './prisma-movements.repository'
import { MOVEMENTS_REPOSITORY } from './movements.repository'
import { CreateMovementUseCase } from './use-cases/create-movement.use-case'
import { ListMovementsUseCase } from './use-cases/list-movements.use-case'

const movementUseCases = [CreateMovementUseCase, ListMovementsUseCase]

@Module({
  imports: [PropertyEngagementsModule],
  providers: [{ provide: MOVEMENTS_REPOSITORY, useClass: PrismaMovementsRepository }, ...movementUseCases],
  exports: [MOVEMENTS_REPOSITORY, ...movementUseCases],
})
export class MovementsModule {}
