import { PrismaClient } from '@prisma/client'
import { runCleanupSteps } from './cleanup-steps'

// Disposable local databases only: `*_test` (optionally per worker) or the seeded E2E `*_seeded` database.
const testDatabasePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*(?:_test(?:_w[1-9][0-9]*|_worker_[A-Za-z0-9_-]+)?|_seeded)$/
const guardError = 'Property proposal fixtures require a guarded localhost *_test or *_seeded DATABASE_URL'

export type PropertyProposalFixtureIds = {
  runId: string
  /** Only fixture-created identities; seeded tenant/user IDs must never be listed here. */
  tenantIds: string[]
  userIds: string[]
  /** Existing tenant scopes for proposals created by the run. */
  scopeTenantIds: string[]
  proposalIds: string[]
}

function guardedDatabaseUrl() {
  const value = process.env.DATABASE_URL
  if (!value) throw new Error(guardError)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(guardError)
  }
  const database = decodeURIComponent(url.pathname).split('/').filter(Boolean).at(-1) ?? ''
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !testDatabasePattern.test(database)) {
    throw new Error(guardError)
  }
  return value
}

/** Deletes only this run's proposal IDs/run tag; importing this file has no DB effects. */
export async function cleanupPropertyProposalFixtures(ids: PropertyProposalFixtureIds) {
  const url = guardedDatabaseUrl()
  const client = new PrismaClient({ datasources: { db: { url } } })
  const tenantScope = [...new Set([...ids.tenantIds, ...ids.scopeTenantIds])]
  try {
    await client.$connect()
    const proposals = await client.propertyProposal.findMany({
      where: {
        tenantId: { in: tenantScope },
        OR: [{ id: { in: ids.proposalIds } }, { title: { startsWith: `${ids.runId} ` } }]
      },
      select: { id: true }
    })
    const proposalIds = proposals.map(({ id }) => id)
    const sources = await client.propertyEngagement.findMany({
      where: { sourceProposalId: { in: proposalIds }, tenantId: { in: tenantScope } },
      select: { id: true, propertyAssetId: true }
    })
    const engagementIds = sources.map(({ id }) => id)
    const assetIds = sources.map(({ propertyAssetId }) => propertyAssetId)
    const failures: unknown[] = []

    try {
      await runCleanupSteps([
        { name: 'assignments', run: async () => { await client.propertyAgent.deleteMany({ where: { propertyEngagementId: { in: engagementIds }, tenantId: { in: tenantScope } } }) } },
        { name: 'source engagements', run: async () => { await client.propertyEngagement.deleteMany({ where: { id: { in: engagementIds }, tenantId: { in: tenantScope } } }) } },
        { name: 'asset images', run: async () => { await client.propertyAssetImage.deleteMany({ where: { propertyAssetId: { in: assetIds } } }) } },
        { name: 'asset owners', run: async () => { await client.propertyAssetOwner.deleteMany({ where: { propertyAssetId: { in: assetIds } } }) } },
        { name: 'captured assets', run: async () => { await client.propertyAsset.deleteMany({ where: { id: { in: assetIds } } }) } },
        { name: 'review decisions', run: async () => { await client.propertyProposalReviewDecision.deleteMany({ where: { reviewRound: { proposalId: { in: proposalIds }, tenantId: { in: tenantScope } } } }) } },
        { name: 'review rounds', run: async () => { await client.propertyProposalReviewRound.deleteMany({ where: { proposalId: { in: proposalIds }, tenantId: { in: tenantScope } } }) } },
        { name: 'proposals', run: async () => { await client.propertyProposal.deleteMany({ where: { id: { in: proposalIds }, tenantId: { in: tenantScope } } }) } },
        { name: 'fixture memberships', run: async () => { await client.tenantMembership.deleteMany({ where: { tenantId: { in: ids.tenantIds }, userId: { in: ids.userIds } } }) } },
        { name: 'fixture tenants', run: async () => { await client.tenant.deleteMany({ where: { id: { in: ids.tenantIds } } }) } },
        { name: 'fixture users', run: async () => { await client.user.deleteMany({ where: { id: { in: ids.userIds } } }) } }
      ])
    } catch (error) {
      failures.push(error)
    }

    try {
      const residue = await Promise.all([
        client.propertyProposal.count({ where: { id: { in: proposalIds } } }),
        client.propertyProposalReviewRound.count({ where: { proposalId: { in: proposalIds } } }),
        client.propertyProposalReviewDecision.count({ where: { reviewRound: { proposalId: { in: proposalIds } } } }),
        client.propertyEngagement.count({ where: { id: { in: engagementIds } } }),
        client.propertyAgent.count({ where: { propertyEngagementId: { in: engagementIds } } }),
        client.propertyAssetImage.count({ where: { propertyAssetId: { in: assetIds } } }),
        client.propertyAssetOwner.count({ where: { propertyAssetId: { in: assetIds } } }),
        client.propertyAsset.count({ where: { id: { in: assetIds } } }),
        client.tenantMembership.count({ where: { tenantId: { in: ids.tenantIds }, userId: { in: ids.userIds } } }),
        client.tenant.count({ where: { id: { in: ids.tenantIds } } }),
        client.user.count({ where: { id: { in: ids.userIds } } })
      ])
      if (residue.some(Boolean)) failures.push(new Error(`Property proposal fixture ${ids.runId} cleanup left scoped residue: ${residue.join(',')}`))
    } catch (error) {
      failures.push(error)
    }
    if (failures.length) throw new AggregateError(failures, `Property proposal fixture ${ids.runId} cleanup failed`)
  } finally {
    await client.$disconnect()
  }
}
