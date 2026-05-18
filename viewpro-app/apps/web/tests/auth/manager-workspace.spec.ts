import { expect, test } from '@playwright/test'
import { loginWithApi, selectSeededTenant } from './auth-browser'
import { resetSeededAuthFixture, seededAuthFixture } from './seeded-auth-fixture'

test.describe.serial('seeded manager workspace', () => {
  test.beforeAll(async () => {
    await resetSeededAuthFixture()
  })

  test('manager opens seeded tenant engagements with real auth and tenant context', async ({ page }) => {
    const tenantHeaders: Array<string | undefined> = []

    page.on('request', (request) => {
      if (request.url().includes('/api/property-engagements')) {
        tenantHeaders.push(request.headers()['x-tenant-id'])
      }
    })

    await loginWithApi(page, seededAuthFixture.manager.email, seededAuthFixture.manager.loginValue)
    await selectSeededTenant(page, seededAuthFixture.tenant.id)
    await page.goto('/engagements')

    await expect(page.getByRole('heading', { name: 'Gestiones internas' })).toBeVisible()
    await expect(page.getByText(seededAuthFixture.tenant.name)).toBeVisible()
    await expect(page.getByRole('heading', { name: seededAuthFixture.property.title })).toBeVisible()
    await expect.poll(() => tenantHeaders.some((header) => header === seededAuthFixture.tenant.id)).toBe(true)
  })
})
