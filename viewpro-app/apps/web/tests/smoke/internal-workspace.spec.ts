import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const apiBasePattern = '**/api/**'
const selectedInmobiliariaId = '11111111-1111-4111-8111-111111111111'
const forbiddenCustomerCopy = /tenant|uuid|workspace|request|backend|contexto|x-tenant-id/i

const authenticatedSession = {
  memberships: [
    {
      id: 'membership-1',
      permissions: ['property_engagements:read'],
      role: 'OWNER',
      tenant: {
        id: selectedInmobiliariaId,
        name: 'Aurora Propiedades',
        slug: 'aurora-propiedades',
        status: 'ACTIVE',
      },
    },
  ],
  user: {
    email: 'operador@example.test',
    firstName: 'Operador',
    globalRole: 'USER',
    id: 'user-1',
    lastName: 'ViewPro',
    status: 'ACTIVE',
  },
}

async function mockAuthenticatedSession(page: Page) {
  await page.route(apiBasePattern, async (route) => {
    const url = route.request().url()

    if (url.endsWith('/api/auth/me')) {
      await route.fulfill({
        contentType: 'application/json',
        json: authenticatedSession,
      })
      return
    }

    if (url.includes('/api/property-engagements?')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
        },
      })
      return
    }

    if (url.endsWith('/api/analytics/pilot-summary')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          activeEngagements: 0,
          activeEngagementsWithOwnerVisibleUpdate: 0,
          activeEngagementUpdatePercentage: 0,
          documentEvents: {
            approved: 0,
            rejected: 0,
            requested: 0,
            uploaded: 0,
          },
          ownerViewedPropertyCount: 0,
          window: {
            from: '2026-05-12T00:00:00.000Z',
            to: '2026-05-19T00:00:00.000Z',
          },
        },
      })
      return
    }

    if (url.endsWith('/api/analytics/inactive-engagements')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          items: [],
          window: {
            from: '2026-05-12T00:00:00.000Z',
            to: '2026-05-19T00:00:00.000Z',
          },
        },
      })
      return
    }

    if (url.includes('/api/analytics/events?')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          items: [
            {
              actorType: 'INTERNAL_USER',
              actorUserId: 'user-1',
              documentRequestId: 'document-1',
              eventName: 'DOCUMENT_REQUESTED',
              id: 'event-1',
              metadata: {
                backendTrace: 'hidden-implementation-detail',
                requestContext: 'hidden-request-context',
                status: 'ACTIVE_PUBLICATION',
                tenantId: selectedInmobiliariaId,
              },
              movementId: null,
              occurredAt: '2026-05-19T12:00:00.000Z',
              propertyAssetId: 'property-1',
              propertyEngagementId: 'engagement-1',
              tenantId: selectedInmobiliariaId,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        },
      })
      return
    }

    await route.fulfill({ status: 404 })
  })
}

async function selectInmobiliaria(page: Page) {
  await page.addInitScript((tenantId) => {
    window.localStorage.setItem(
      'viewpro:selected-tenant:v1',
      JSON.stringify({ selectedTenantId: tenantId, updatedAt: '2026-05-19T12:00:00.000Z', version: 1 }),
    )
  }, selectedInmobiliariaId)
}

test.describe('internal inmobiliaria workspace smoke coverage', () => {
  test('dashboard presents a business-first Inicio without technical customer copy', async ({ page }) => {
    await mockAuthenticatedSession(page)
    await selectInmobiliaria(page)

    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aurora Propiedades' })).toBeVisible()

    const primaryNavigation = page.getByRole('navigation', { name: 'Navegación de la inmobiliaria' })

    for (const label of [
      'Inicio',
      'Gestiones',
      'Propiedades',
      'Propietarios',
      'Documentos',
      'Equipo',
      'Métricas',
      'Configuración',
    ]) {
      await expect(primaryNavigation.getByRole('link', { exact: true, name: label })).toBeVisible()
    }

    await expect(page.getByRole('heading', { name: 'Prioridades de hoy' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gestiones activas' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Equipo comercial' })).toBeVisible()

    await expect(page.getByText(forbiddenCustomerCopy)).toHaveCount(0)
  })

  test('select inmobiliaria page avoids technical tenant wording in the reachable state', async ({ page }) => {
    await mockAuthenticatedSession(page)

    await page.goto('/select-tenant')

    await expect(page.getByRole('heading', { name: 'Elegir inmobiliaria' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar al panel' })).toBeVisible()
    await expect(page.getByText(forbiddenCustomerCopy)).toHaveCount(0)
  })

  test('gestiones list uses inmobiliaria language without technical customer copy', async ({ page }) => {
    await mockAuthenticatedSession(page)
    await selectInmobiliaria(page)

    await page.goto('/engagements')

    await expect(page.getByRole('heading', { exact: true, name: 'Gestiones' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No hay gestiones creadas' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Crear primera gestión' })).toBeVisible()
    await expect(page.getByText(forbiddenCustomerCopy)).toHaveCount(0)
  })

  test('new gestion form uses business copy without technical customer terms', async ({ page }) => {
    await mockAuthenticatedSession(page)
    await selectInmobiliaria(page)

    await page.goto('/engagements/new')

    await expect(page.getByRole('heading', { name: 'Crear gestión' })).toBeVisible()
    await expect(page.getByLabel('Título')).toBeVisible()
    await expect(page.getByLabel('Precio publicado')).toBeVisible()
    await expect(page.getByText(forbiddenCustomerCopy)).toHaveCount(0)
  })

  test('analytics page presents metricas without technical customer copy', async ({ page }) => {
    await mockAuthenticatedSession(page)
    await selectInmobiliaria(page)

    await page.goto('/analytics')

    await expect(page.getByRole('heading', { name: 'Métricas' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Señales para conducir la operación comercial' })).toBeVisible()
    await expect(page.getByText('Estado comercial: Publicación activa')).toBeVisible()
    await expect(page.getByText(forbiddenCustomerCopy)).toHaveCount(0)
  })
})
