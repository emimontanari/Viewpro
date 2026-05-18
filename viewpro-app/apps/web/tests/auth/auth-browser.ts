import type { Page } from '@playwright/test'

const apiPort = process.env.VIEWPRO_SEEDED_E2E_API_PORT ?? '3001'
const apiBaseUrl = process.env.VIEWPRO_SEEDED_E2E_API_URL ?? `http://127.0.0.1:${apiPort}/api`

export async function loginWithApi(page: Page, email: string, password: string) {
  const response = await page.request.post(`${apiBaseUrl}/auth/login`, {
    data: { email, password },
  })

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${await response.text()}`)
  }
}

export async function selectSeededTenant(page: Page, tenantId: string) {
  await page.addInitScript((selectedTenantId) => {
    window.localStorage.setItem(
      'viewpro:selected-tenant:v1',
      JSON.stringify({
        selectedTenantId,
        updatedAt: new Date().toISOString(),
        version: 1,
      }),
    )
  }, tenantId)
}
