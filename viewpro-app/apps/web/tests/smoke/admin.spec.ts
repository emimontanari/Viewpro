import { expect, test } from '@playwright/test'

const apiBasePattern = '**/api/**'

test.describe('admin route smoke coverage', () => {
  test('shows a forbidden state for non-admin users without loading admin read models', async ({ page }) => {
    let adminRequestCount = 0

    await page.route(apiBasePattern, async (route) => {
      const url = route.request().url()

      if (url.endsWith('/api/auth/me')) {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            memberships: [],
            user: {
              email: 'operator@example.test',
              firstName: 'Operador',
              globalRole: 'USER',
              id: 'user-1',
              lastName: null,
              status: 'ACTIVE',
            },
          },
        })
        return
      }

      if (url.includes('/api/admin/')) {
        adminRequestCount += 1
      }

      await route.fulfill({ status: 404 })
    })

    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Acceso restringido a ViewPro Admin' })).toBeVisible()
    await expect(page.getByText('Necesitás rol global VIEWPRO_ADMIN para abrir este comando operativo.')).toBeVisible()
    expect(adminRequestCount).toBe(0)
  })

  test('renders the admin command room with sanitized read models', async ({ page }) => {
    const requestedHeaders: Record<string, string | undefined> = {}

    await page.route(apiBasePattern, async (route) => {
      const request = route.request()
      const url = request.url()

      if (url.endsWith('/api/auth/me')) {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            memberships: [],
            user: {
              email: 'admin@example.test',
              firstName: 'Admin',
              globalRole: 'VIEWPRO_ADMIN',
              id: 'admin-1',
              lastName: 'ViewPro',
              status: 'ACTIVE',
            },
          },
        })
        return
      }

      if (url.includes('/api/admin/')) {
        requestedHeaders[url] = request.headers()['x-tenant-id']
      }

      if (url.endsWith('/api/admin/summary')) {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            generatedAt: '2026-05-18T15:00:00.000Z',
            recentActivityCount: 7,
            totals: {
              activeEngagements: 12,
              activeTenants: 2,
              analyticsEvents: 98,
              documentRequests: 5,
              tenants: 3,
              users: 11,
            },
          },
        })
        return
      }

      if (url.includes('/api/admin/tenants')) {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            items: [
              {
                counts: {
                  analyticsEvents: 42,
                  documentRequests: 3,
                  memberships: 4,
                  propertyAssets: 8,
                  propertyEngagements: 6,
                },
                createdAt: '2026-05-01T10:00:00.000Z',
                id: '11111111-1111-4111-8111-111111111111',
                lastActivityAt: '2026-05-18T14:30:00.000Z',
                name: 'Aurora Propiedades',
                slug: 'aurora-propiedades',
                status: 'ACTIVE',
                updatedAt: '2026-05-18T14:30:00.000Z',
              },
            ],
            page: 1,
            pageSize: 10,
            total: 1,
          },
        })
        return
      }

      if (url.includes('/api/admin/activity')) {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            items: [
              {
                actorType: 'USER',
                documentRequestId: null,
                eventName: 'MOVEMENT_CREATED',
                id: 'event-1',
                movementId: 'movement-1',
                occurredAt: '2026-05-18T14:45:00.000Z',
                propertyAssetId: 'property-1',
                propertyEngagementId: 'engagement-1',
                tenantId: '11111111-1111-4111-8111-111111111111',
              },
            ],
            page: 1,
            pageSize: 10,
            total: 1,
          },
        })
        return
      }

      await route.fulfill({ status: 404 })
    })

    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Admin ViewPro' })).toBeVisible()
    await expect(page.getByText('Read-only v1: sin impersonación, edición, borrado, billing ni acceso a documentos privados.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aurora Propiedades' })).toBeVisible()
    await expect(page.getByText('MOVEMENT_CREATED')).toBeVisible()
    await expect(page.getByText('98')).toBeVisible()
    expect(Object.values(requestedHeaders)).toEqual([undefined, undefined, undefined])
  })
})
