import { Injectable } from '@nestjs/common'
import type { JsonValue } from '@prisma/client/runtime/library'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaService } from '../database/prisma.service'
import type { IdempotencyCheckResult, IIdempotencyRepository } from './idempotency.repository'

/**
 * Prisma implementation of IIdempotencyRepository using platform_command_log.
 *
 * Strategy: insert-first.
 * 1. Try to CREATE the record (with the caller-supplied result JSON).
 * 2. If Prisma throws P2002 (unique constraint), the key was already processed.
 *    Fetch and return the stored result so the caller can short-circuit.
 *
 * This pattern closes the concurrent-duplicate race: whichever writer wins the
 * unique constraint gets { found: false }; all losers get { found: true, result }.
 */
@Injectable()
export class PrismaIdempotencyRepository implements IIdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertOrFind(
    idempotencyKey: string,
    tenantId: string,
    commandType: string,
    result: JsonValue,
  ): Promise<IdempotencyCheckResult> {
    try {
      await this.prisma.platformCommandLog.create({
        data: { idempotencyKey, tenantId, commandType, result },
      })
      return { found: false }
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        const existing = await this.prisma.platformCommandLog.findUnique({
          where: { idempotencyKey },
          select: { result: true },
        })
        // If somehow the record is gone between the constraint error and the
        // findUnique (extremely unlikely), propagate as a new insert.
        if (!existing) {
          return { found: false }
        }
        return { found: true, result: existing.result }
      }
      throw err
    }
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}
