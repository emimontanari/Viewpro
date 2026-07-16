import { ConflictException, Inject, Injectable } from '@nestjs/common'
import type { PlatformOperatorRole } from '@prisma-platform/client'
import { OPERATOR_REPOSITORY, type IOperatorRepository, type OperatorSummary } from '../../auth/repositories/operator.repository'
import { PASSWORD_HASHER, type IPasswordHasher } from '../../auth/security/password-hasher'
import { PrismaService } from '../../database/prisma.service'
import { AuditLogRepository } from '../../platform-data/audit-log.repository'

const DUPLICATE_EMAIL_RESPONSE = {
  statusCode: 409,
  code: 'DUPLICATE_EMAIL',
  message: 'An operator with this email already exists',
}

export type CreateOperatorInput = {
  email: string
  role: PlatformOperatorRole
  tempPassword: string
}

export type OperatorActor = { id: string; email: string }

/**
 * CreateOperatorUseCase (platform-operator-management, A4) — hashes the
 * OWNER-provided temp password via the DI PASSWORD_HASHER (Argon2, NOT the
 * seed script's direct argon2 call), persists the EXPLICITLY chosen role
 * (least-privilege — never relies on the ANALYST DB default), normalizes the
 * email, and appends a native audit entry on success.
 *
 * Atomicity (JD FIX 1): the operator INSERT and its native audit write run in a
 * SINGLE `prisma.$transaction`, so they commit-or-roll-back together. If the
 * audit write throws, the operator row is NOT durably created (no silent audit
 * gap on the highest-privilege action, and no 500 for a partially-applied op).
 */
@Injectable()
export class CreateOperatorUseCase {
  constructor(
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    private readonly auditLogRepo: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreateOperatorInput, actor: OperatorActor): Promise<OperatorSummary> {
    const passwordHash = await this.passwordHasher.hash(input.tempPassword)
    const normalizedEmail = input.email.trim().toLowerCase()

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await this.operatorRepository.create(
          {
            email: normalizedEmail,
            passwordHash,
            // Explicit — never rely on the ANALYST DB default (least-privilege).
            role: input.role,
          },
          tx,
        )

        await this.auditLogRepo.appendNative(
          {
            action: 'OPERATOR_CREATED',
            actor,
            target: { id: created.id, email: created.email },
          },
          tx,
        )

        return created
      })
    } catch (err) {
      if (isDuplicateEmailError(err)) {
        throw new ConflictException(DUPLICATE_EMAIL_RESPONSE)
      }
      throw err
    }
  }
}

function isDuplicateEmailError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'P2002'
}
