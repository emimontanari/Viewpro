import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'

/**
 * T-12 — RED: `platform_audit_log` migration additive invariant.
 *
 * Spec: platform-audit-log — platform_audit_log Append-Only Projection (schema requirement)
 *
 * Asserts the new table exists with the required columns, AND that the
 * pre-existing `platform_mirror_events` / `platform_ingest_cursor` /
 * `platform_tenants` tables survive untouched (additive-only migration
 * invariant — A5/A6/A7).
 */
describe('platform_audit_log migration (additive invariant)', () => {
  let moduleRef: TestingModule
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
    }).compile()

    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  it('platform_audit_log table exists with id/sourceEventId/seqNo/action/tenantId/actor/previousValue/newValue/occurredAt/createdAt columns', async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'platform_audit_log'
    `
    const columns = rows.map((r) => r.column_name).sort()

    expect(columns).toEqual(
      [
        'id',
        'sourceEventId',
        'seqNo',
        'action',
        'tenantId',
        'actor',
        'previousValue',
        'newValue',
        'occurredAt',
        'createdAt',
      ].sort(),
    )
  })

  it('sourceEventId has a unique index on platform_audit_log', async () => {
    // Prisma's @unique compiles to a UNIQUE INDEX (not a table CONSTRAINT), so
    // this checks pg_indexes rather than information_schema.table_constraints.
    const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'platform_audit_log'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%sourceEventId%'
    `
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('platform_mirror_events survives the migration with its known columns intact', async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'platform_mirror_events'
    `
    const columns = rows.map((r) => r.column_name)

    expect(columns).toContain('sourceEventId')
    expect(columns).toContain('seqNo')
    expect(columns).toContain('newStatus')
  })

  it('platform_ingest_cursor survives the migration with its known columns intact', async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'platform_ingest_cursor'
    `
    const columns = rows.map((r) => r.column_name)

    expect(columns).toContain('id')
    expect(columns).toContain('seqNo')
  })

  it('platform_tenants survives the migration with its known columns intact', async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'platform_tenants'
    `
    const columns = rows.map((r) => r.column_name)

    expect(columns).toContain('id')
    expect(columns).toContain('latestStatus')
  })
})
