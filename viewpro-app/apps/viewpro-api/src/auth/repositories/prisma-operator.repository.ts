import { Injectable } from '@nestjs/common'
import type { Operator, OperatorStatus, PlatformOperatorRole, Prisma } from '@prisma-platform/client'
import { PrismaService } from '../../database/prisma.service'
import type { IOperatorRepository, OperatorSummary } from './operator.repository'

// Never selects passwordHash — the ONE place the "no passwordHash in
// create/list responses" invariant is enforced (Decision 3).
const SAFE_SELECT = {
  id: true,
  email: true,
  status: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class PrismaOperatorRepository implements IOperatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<Operator | null> {
    return this.prisma.operator.findUnique({ where: { email } })
  }

  findById(id: string): Promise<Operator | null> {
    return this.prisma.operator.findUnique({ where: { id } })
  }

  create(input: { email: string; passwordHash: string; role: PlatformOperatorRole }): Promise<OperatorSummary> {
    return this.prisma.operator.create({
      data: {
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        // Explicitly persisted — least-privilege (never rely on the ANALYST
        // DB default, Decision/hard-rule).
        role: input.role,
      },
      select: SAFE_SELECT,
    })
  }

  list(): Promise<OperatorSummary[]> {
    return this.prisma.operator.findMany({ select: SAFE_SELECT, orderBy: { createdAt: 'asc' } })
  }

  updateRole(
    id: string,
    role: PlatformOperatorRole,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<OperatorSummary> {
    return tx.operator.update({ where: { id }, data: { role }, select: SAFE_SELECT })
  }

  updateStatus(
    id: string,
    status: OperatorStatus,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<OperatorSummary> {
    return tx.operator.update({ where: { id }, data: { status }, select: SAFE_SELECT })
  }

  countActiveOwners(excludeId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<number> {
    return tx.operator.count({
      where: { role: 'OWNER', status: 'ACTIVE', id: { not: excludeId } },
    })
  }
}
