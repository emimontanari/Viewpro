import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Spec: Idempotency Store
// Scenarios:
//   - Insert new key → returns { found: false }
//   - Insert duplicate key → returns { found: true, result: <stored> }
//   - Concurrent duplicate constraint → only one insert succeeds; other returns stored result
// ---------------------------------------------------------------------------

// We test PrismaIdempotencyRepository with a mocked PrismaService.
// The unique-constraint violation is simulated using Prisma's P2002 error code.

const STORED_RESULT = { status: 'updated', tenantId: 'tenant-1' }
const IDEMPOTENCY_KEY = 'key-123'
const TENANT_ID = 'tenant-1'
const COMMAND_TYPE = 'SET_STATUS'

function makePrismaStub(mode: 'insert' | 'duplicate' | 'race') {
  const existingRecord = {
    id: 'existing-id',
    idempotencyKey: IDEMPOTENCY_KEY,
    tenantId: TENANT_ID,
    commandType: COMMAND_TYPE,
    result: STORED_RESULT,
    createdAt: new Date(),
  }

  if (mode === 'insert') {
    return {
      platformCommandLog: {
        create: vi.fn().mockResolvedValue({ ...existingRecord, id: 'new-id' }),
        findUnique: vi.fn(),
      },
    }
  }

  if (mode === 'duplicate') {
    const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    return {
      platformCommandLog: {
        create: vi.fn().mockRejectedValue(p2002Error),
        findUnique: vi.fn().mockResolvedValue(existingRecord),
      },
    }
  }

  // race: first call succeeds, second call races and finds existing
  const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
  let calls = 0
  return {
    platformCommandLog: {
      create: vi.fn().mockImplementation(async () => {
        calls++
        if (calls === 1) return { ...existingRecord, id: 'new-id' }
        throw p2002Error
      }),
      findUnique: vi.fn().mockResolvedValue(existingRecord),
    },
  }
}

describe('PrismaIdempotencyRepository', () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamically imported
  let Repo: any

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../prisma-idempotency.repository')
    Repo = mod.PrismaIdempotencyRepository
  })

  it('returns { found: false } when inserting a new idempotency key', async () => {
    const prisma = makePrismaStub('insert')
    const repo = new Repo(prisma)

    const result = await repo.insertOrFind(IDEMPOTENCY_KEY, TENANT_ID, COMMAND_TYPE, STORED_RESULT)

    expect(result.found).toBe(false)
    expect(prisma.platformCommandLog.create).toHaveBeenCalledOnce()
  })

  it('returns { found: true, result: stored } on duplicate key (P2002 → findUnique)', async () => {
    const prisma = makePrismaStub('duplicate')
    const repo = new Repo(prisma)

    const result = await repo.insertOrFind(IDEMPOTENCY_KEY, TENANT_ID, COMMAND_TYPE, STORED_RESULT)

    expect(result.found).toBe(true)
    expect(result.result).toEqual(STORED_RESULT)
    expect(prisma.platformCommandLog.create).toHaveBeenCalledOnce()
    expect(prisma.platformCommandLog.findUnique).toHaveBeenCalledOnce()
  })

  it('on concurrent race (P2002 on second call), returns stored result without second mutation', async () => {
    const prisma = makePrismaStub('race')
    const repo = new Repo(prisma)

    // Simulate two concurrent calls
    const [r1, r2] = await Promise.all([
      repo.insertOrFind(IDEMPOTENCY_KEY, TENANT_ID, COMMAND_TYPE, STORED_RESULT),
      repo.insertOrFind(IDEMPOTENCY_KEY, TENANT_ID, COMMAND_TYPE, STORED_RESULT),
    ])

    // First call succeeds (new insert)
    expect(r1.found).toBe(false)
    // Second call hits P2002 → fetches stored
    expect(r2.found).toBe(true)
    expect(r2.result).toEqual(STORED_RESULT)
  })
})
