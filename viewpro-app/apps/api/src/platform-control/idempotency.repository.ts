import type { JsonValue } from '@prisma/client/runtime/library'

export const IDEMPOTENCY_REPOSITORY = Symbol('IDEMPOTENCY_REPOSITORY')

/**
 * Result of an insertOrFind call on the idempotency store.
 * - found=false → key was new; caller should proceed with the mutation
 * - found=true  → key existed; caller must return stored result (no re-apply)
 */
export type IdempotencyCheckResult =
  | { found: false }
  | { found: true; result: JsonValue }

export type IIdempotencyRepository = {
  /**
   * Attempts to insert the key + command metadata into the store.
   * If the key already exists (unique constraint), returns the stored result.
   * Uses an insert-first pattern to close the concurrent-duplicate race.
   */
  insertOrFind(
    idempotencyKey: string,
    tenantId: string,
    commandType: string,
    result: JsonValue,
  ): Promise<IdempotencyCheckResult>
}
