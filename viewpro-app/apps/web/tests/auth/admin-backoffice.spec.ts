import { expect, test } from '@playwright/test'
import { loginWithApi, selectSeededTenant } from './auth-browser'
import { resetSeededAuthFixture, seededAuthFixture } from './seeded-auth-fixture'

test.describe.serial('seeded admin backoffice', () => {
  test.beforeAll(async () => {
    await resetSeededAuthFixture()
  })

  test('admin opens real admin backoffice without tenant headers', async ({ page }) => {
    const adminTenantHeaders: Array<string | undefined> = []

    page.on('request', (request) => {
      if (request.url().includes('/api/admin/')) {
        adminTenantHeaders.push(request.headers()['x-tenant-id'])
      }
    })

    await loginWithApi(page, seededAuthFixture.admin.email, seededAuthFixture.admin.loginValue)
    await selectSeededTenant(page, seededAuthFixture.tenant.id)
    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Admin ViewPro' })).toBeVisible()
    await expect(page.getByRole('heading', { name: seededAuthFixture.tenant.name })).toBeVisible()
    await expect(page.getByText('Read-only v1: sin impersonación, edición, borrado, billing ni acceso a documentos privados.')).toBeVisible()
    await expect(page.getByText('DOCUMENT_REQUESTED')).toBeVisible()
    expect(adminTenantHeaders.length).toBeGreaterThan(0)
    expect(adminTenantHeaders.every((header) => header === undefined)).toBe(true)
  })
})
