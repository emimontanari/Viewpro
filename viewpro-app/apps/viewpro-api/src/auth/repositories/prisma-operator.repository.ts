import { Injectable } from '@nestjs/common'
import type { Operator } from '@prisma-platform/client'
import { PrismaService } from '../../database/prisma.service'
import type { IOperatorRepository } from './operator.repository'

@Injectable()
export class PrismaOperatorRepository implements IOperatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<Operator | null> {
    return this.prisma.operator.findUnique({ where: { email } })
  }

  findById(id: string): Promise<Operator | null> {
    return this.prisma.operator.findUnique({ where: { id } })
  }
}
