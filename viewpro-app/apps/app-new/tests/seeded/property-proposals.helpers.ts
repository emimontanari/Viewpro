import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type { Page } from '@playwright/test'

// Mirrors PropertyProposalFixtureIds in apps/api/test/property-proposal-fixtures.ts.
export type PropertyProposalFixtureIds = {
  runId: string
  tenantIds: string[]
  userIds: string[]
  scopeTenantIds: string[]
  proposalIds: string[]
}

type ProposalFixturesModule = {
  cleanupPropertyProposalFixtures: (ids: PropertyProposalFixtureIds) => Promise<void>
}

// Loaded at runtime only: a static import would pull the API test module (and its Prisma
// client types) into the app type-check, which fails in app-only builds such as Vercel.
const proposalFixturesModule = '../../../api/test/property-proposal-fixtures'

const apiBaseUrl = `http://127.0.0.1:${Number(process.env.VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT ?? 3001)}`

export const proposalRunId = () => `u22b-${randomUUID()}`
export const proposalAccounts = {
  seller: 'martin.demo@viewpro.local',
  reviewer: 'demo@viewpro.local',
  password: process.env.VIEWPRO_DEMO_PASSWORD ?? 'viewpro-demo-local'
}

export function fixtureIds(runId: string): PropertyProposalFixtureIds {
  return { runId, tenantIds: [], userIds: [], scopeTenantIds: [], proposalIds: [] }
}

export async function signInProposalUser(page: Page, email: string, redirect = '/dashboard') {
  await page.context().clearCookies()
  await page.goto(`/auth/sign-in?redirect_url=${encodeURIComponent(redirect)}`)
  await page.evaluate(() => localStorage.clear())
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña *', { exact: true }).fill(proposalAccounts.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(`**${redirect}`)
}

export async function activeTenantId(page: Page) {
  const response = await page.request.get(`${apiBaseUrl}/api/auth/me`)
  if (!response.ok()) throw new Error(`Unable to read authenticated tenant context (${response.status()})`)
  const session = await response.json() as { memberships?: Array<{ tenant: { id: string } }> }
  const tenantId = session.memberships?.[0]?.tenant.id
  if (!tenantId) throw new Error('Seed account has no active tenant membership')
  return tenantId
}

export async function createProposal(page: Page, ids: PropertyProposalFixtureIds, tenantId: string) {
  const title = `${ids.runId} proposal`
  const response = await page.request.post('/api/property-proposals', {
    headers: { 'x-tenant-id': tenantId },
    data: { title }
  })
  if (!response.ok()) throw new Error(`Unable to create run-scoped proposal (${response.status()})`)
  const proposal = await response.json() as { id: string }
  ids.scopeTenantIds.push(tenantId)
  ids.proposalIds.push(proposal.id)
  return { id: proposal.id, title }
}

export async function cleanupProposalRun(ids: PropertyProposalFixtureIds) {
  // require (not import()) so Playwright's TypeScript loader transpiles the module.
  const fixtures = createRequire(__filename)(proposalFixturesModule) as ProposalFixturesModule
  await fixtures.cleanupPropertyProposalFixtures(ids)
}
