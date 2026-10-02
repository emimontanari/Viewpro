import { expect, test, type Page } from '@playwright/test'
import {
  activeTenantId,
  cleanupProposalRun,
  createProposal,
  fixtureIds,
  proposalAccounts,
  proposalRunId,
  signInProposalUser
} from './property-proposals.helpers'

const fields = { address: '42 Runway Street', city: 'Córdoba', province: 'Córdoba' }

test.describe('seeded property proposals', () => {
  test.describe.configure({ mode: 'serial' })
  let ids = fixtureIds(proposalRunId())

  test.beforeEach(() => { ids = fixtureIds(proposalRunId()) })
  test.afterEach(async () => { await cleanupProposalRun(ids) })

  test('seller submits and reviewer approves; localized state and result navigation are visible', async ({ page }: { page: Page }) => {
    await signInProposalUser(page, proposalAccounts.seller)
    const tenantId = await activeTenantId(page)
    const proposal = await createProposal(page, ids, tenantId)
    await page.goto(`/dashboard/property-proposals/${proposal.id}`)
    await completeProposal(page, proposal.title)
    await page.getByRole('button', { name: 'Enviar a revisión' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'EN REVISIÓN' })).toBeVisible()

    await signInProposalUser(page, proposalAccounts.reviewer, '/dashboard/property-proposals/review')
    await page.goto(`/dashboard/property-proposals/review/${proposal.id}`)
    await expect(page.getByRole('heading', { name: proposal.title })).toBeVisible()
    await page.getByRole('button', { name: 'Aprobar propuesta' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'APROBADA' })).toBeVisible()
    const resultLink = page.getByRole('link', { name: 'Ver propiedad aprobada' })
    await expect(resultLink).toBeVisible()
    await resultLink.click()
    await expect(page).toHaveURL(/\/dashboard\/product\/[a-f0-9-]+$/i)
    await expect(page.getByText('Detalle de propiedad')).toBeVisible()
  })

  test('rejection, edit and explicit resubmission retain both review rounds', async ({ page }: { page: Page }) => {
    await signInProposalUser(page, proposalAccounts.seller)
    const tenantId = await activeTenantId(page)
    const proposal = await createProposal(page, ids, tenantId)
    await page.goto(`/dashboard/property-proposals/${proposal.id}`)
    await completeProposal(page, proposal.title)
    await page.getByRole('button', { name: 'Enviar a revisión' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'EN REVISIÓN' })).toBeVisible()

    await signInProposalUser(page, proposalAccounts.reviewer, '/dashboard/property-proposals/review')
    await page.goto(`/dashboard/property-proposals/review/${proposal.id}`)
    await page.getByRole('button', { name: 'Rechazar propuesta' }).click()
    await page.getByLabel('Motivo del rechazo').fill('Falta información de la propiedad')
    await page.getByRole('button', { name: 'Confirmar rechazo' }).click()
    await expect(page.getByText(/Rechazada: Falta información de la propiedad/)).toBeVisible()

    await signInProposalUser(page, proposalAccounts.seller)
    await page.goto(`/dashboard/property-proposals/${proposal.id}`)
    await expect(page.getByRole('heading', { name: 'Ronda 1' })).toBeVisible()
    await page.getByLabel('Ciudad').fill('Rosario')
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByRole('heading', { name: 'Ronda 1' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ronda 2' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Enviar a revisión' }).click()
    await expect(page.getByRole('heading', { name: 'Ronda 2' })).toBeVisible()
    const roundTwo = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Ronda 2' }) })
    await expect(roundTwo.locator('[data-history-snapshot]')).toContainText('Rosario')
  })

  test('seller and reviewer roles remain on their permitted proposal routes', async ({ page }: { page: Page }) => {
    await signInProposalUser(page, proposalAccounts.seller)
    await page.goto('/dashboard/property-proposals')
    await expect(page.getByRole('heading', { name: 'Propuestas de propiedades' })).toBeVisible()
    await page.goto('/dashboard/property-proposals/review')
    await expect(page.getByText('No tenés acceso a la revisión de propuestas.')).toBeVisible()
    await signInProposalUser(page, proposalAccounts.reviewer)
    await page.goto('/dashboard/property-proposals')
    await expect(page.getByText('No tenés acceso a propuestas de propiedades.')).toBeVisible()
    await page.goto('/dashboard/property-proposals/review')
    await expect(page.getByRole('heading', { name: 'Revisión de propuestas' })).toBeVisible()
  })
})

async function completeProposal(page: Page, title: string) {
  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Dirección').fill(fields.address)
  await page.getByLabel('Ciudad').fill(fields.city)
  await page.getByLabel('Provincia').fill(fields.province)
  await page.getByLabel('Tipo de propiedad').selectOption('APARTMENT')
  await page.getByLabel('Operación').selectOption('SALE')
}
