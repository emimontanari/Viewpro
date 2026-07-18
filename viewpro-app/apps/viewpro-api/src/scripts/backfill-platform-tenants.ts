// NOTE: safe to re-run — all writes are idempotent upserts on platform_tenants.id
//
// T-22 — Nest standalone backfill command (A12/A14).
//
// Pulls all pre-existing tenants from InmoView's internal registry endpoint
// (GET /internal/platform/tenants, PlatformControlGuard) via ChangeFeedClient
// and idempotent-upserts each into platform_tenants. Reuses NestJS DI
// (NestFactory.createApplicationContext) rather than a raw ts-node script so
// it shares config, token minting, and the repository layer with the runtime
// app.
//
// Run: pnpm --filter @viewpro/platform-api exec ts-node src/scripts/backfill-platform-tenants.ts
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { ChangeFeedClient } from '../platform-data/change-feed.client'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformTenantRepository } from '../platform-data/platform-tenant.repository'

export interface RunBackfillDeps {
  changeFeedClient: Pick<ChangeFeedClient, 'fetchAllTenants'>
  tenantRepo: Pick<PlatformTenantRepository, 'upsertFromRegistered'>
}

/**
 * runBackfill — pulls all tenants from InmoView's internal registry endpoint
 * and idempotent-upserts each into `platform_tenants` (A12/A14).
 *
 * Pure orchestration, no NestJS bootstrap here — kept side-effect-free
 * (besides the injected deps) so it is directly unit-testable without
 * spinning up a full application context.
 */
export async function runBackfill(deps: RunBackfillDeps): Promise<{ count: number }> {
  const { tenants } = await deps.changeFeedClient.fetchAllTenants()

  for (const tenant of tenants) {
    await deps.tenantRepo.upsertFromRegistered({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      newStatus: tenant.status,
      limits: tenant.limits,
    })
  }

  return { count: tenants.length }
}

/**
 * main — Nest standalone application context bootstrap.
 * Resolves ChangeFeedClient + PlatformTenantRepository via DI, runs the
 * backfill, then closes the context and exits.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule)

  try {
    const changeFeedClient = app.get(ChangeFeedClient)
    const tenantRepo = app.get(PlatformTenantRepository)

    const result = await runBackfill({ changeFeedClient, tenantRepo })

    console.log(`Backfill complete: upserted ${result.count} tenant(s) into platform_tenants.`)
  } finally {
    await app.close()
  }
}

// Only run main() when this file is executed directly (e.g. via `ts-node`) —
// NOT when imported by tests (backfill.spec.ts imports `runBackfill` only).
if (require.main === module) {
  main().catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
}
