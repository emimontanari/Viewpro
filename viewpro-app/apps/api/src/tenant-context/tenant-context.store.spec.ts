import { AsyncLocalStorage } from 'node:async_hooks'
import { ClsService } from 'nestjs-cls'
import { describe, expect, it } from 'vitest'
import { TenantContextStore } from './tenant-context.store'

function buildStore() {
  const cls = new ClsService(new AsyncLocalStorage())
  return { cls, store: new TenantContextStore(cls) }
}

describe('TenantContextStore', () => {
  it('returns undefined outside a request context', () => {
    const { store } = buildStore()

    expect(store.getTenantId()).toBeUndefined()
  })

  it('propagates the tenant id within a context', () => {
    const { cls, store } = buildStore()

    cls.run(() => {
      store.setTenantId('tenant-1')
      expect(store.getTenantId()).toBe('tenant-1')
    })
  })

  it('isolates the tenant id between concurrent contexts (no cross-request bleed)', async () => {
    const { cls, store } = buildStore()
    const seen: Array<string | undefined> = []

    await Promise.all([
      new Promise<void>((resolve) => {
        void cls.run(async () => {
          store.setTenantId('tenant-A')
          // Yield across an async boundary so the other context runs in between.
          await new Promise((r) => setTimeout(r, 10))
          seen.push(store.getTenantId())
          resolve()
        })
      }),
      new Promise<void>((resolve) => {
        void cls.run(async () => {
          store.setTenantId('tenant-B')
          seen.push(store.getTenantId())
          resolve()
        })
      })
    ])

    // Each context must read back its OWN tenant id, never the other's.
    expect([...seen].sort()).toEqual(['tenant-A', 'tenant-B'])
  })
})
