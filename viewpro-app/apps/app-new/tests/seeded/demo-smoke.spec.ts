/**
 * Seeded smoke suite — audit-row trace (existing coverage across seeded stages)
 *
 * | Block                       | Tests                                           | Audit row                                         |
 * |-----------------------------|-------------------------------------------------|---------------------------------------------------|
 * | Manager workflow            | T01, T11, T13, T16, T17, T18a                   | Manager creates / opens / requests / rejects       |
 * | Seller workflow             | T02–T03, T10                                    | Seller assigned visibility, movement w/ chip       |
 * | Owner workflow              | T04–T05, T06, T18b, T19a                        | Owner reads, uploads, WhatsApp link                |
 * | Notifications + admin       | T07–T09                                         | Internal + owner notifications, admin limits       |
 * | Status change requests      | T12, T13 (approve)                              | Approve + reject paths                             |
 * | Engagement management       | T14 (assign), T15 (unassign)                    | Manager assigns / unassigns seller                 |
 * | WhatsApp + tracking         | T19b                                            | WhatsApp click tracking                            |
 * | Tenant limits               | T20                                             | Limit exceeded UI error                            |
 * | Notification persistence    | T-NEW-1, T-NEW-2                                | Stage 24.5 S-B1, S-B2                              |
 * | Seguimiento filters + docs  | S-8, T-28, T-29                                 | Stages 20.11 S-8; 20.9 S-15, S-16                 |
 * | Contact configuration       | S-12                                            | Stage 23.3 tenant WhatsApp persistence             |
 * | Owner movement contact      | S-10, S-9                                       | Stage 23.5 seller contact + click tracking          |
 * | Isolation                   | U-1, U-2                                        | Stage 26.4 S-5, S-7                                |
 *
 * ORDERING: Tests run serially (fullyParallel: false, workers: 1).
 * T13 (engagement creation) MUST run after T01 which asserts '20 gestiones'.
 * T14 (assign) MUST run after T13. T15 (unassign) MUST run after T14.
 * T18a (reject) MUST run after seed fixture exists (Stage 26.3 Commit B).
 * T20 (limit) has a title-guarded afterEach restore, so later tests are allowed;
 * pnpm demo:seed remains the hard-kill fallback if that hook cannot run.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  getJson,
  getAssignedProducts,
  getProductByTitle,
  signInSellerWithTenantContext,
  type ProductsResponse
} from './_helpers';

const DEMO_EMAIL = 'demo@viewpro.local';
const DEMO_ADMIN_EMAIL = 'admin.demo@viewpro.local';
const DEMO_PASSWORD = process.env.VIEWPRO_DEMO_PASSWORD ?? 'viewpro-demo-local';
const DEMO_TENANT_NAME = 'ViewPro Demo Inmobiliaria';
const VISIBLE_DEMO_PROPERTY_TITLE = 'Casa compacta en Funes';
const OWNER_EMAIL = 'propietario.demo@viewpro.local';
const OWNER_VISIBLE_PROPERTY_TITLE = 'Casa familiar con pileta en Villa Centenario';
const EXISTING_OWNER_INVITATION_TOKEN = 'seeded-existing-owner-invitation-token';
const EXISTING_OWNER_INVITED_PROPERTY_TITLE = 'Casa luminosa con patio en Los Boulevares';
const SELLER_SCENARIOS = [
  {
    email: 'martin.demo@viewpro.local',
    expectedAssignedTitle: 'Casa compacta en Funes',
    // martin has 7 default assignments + Mapuche (co-assigned in status change request seed fixture)
    expectedTotal: 8,
    unassignedTitle: 'Casa con jardín en Villa Catalina'
  },
  {
    email: 'lucia.demo@viewpro.local',
    expectedAssignedTitle: 'Casa con jardín en Villa Catalina',
    expectedTotal: 6,
    unassignedTitle: 'Casa compacta en Funes'
  }
];

test.describe.configure({ mode: 'serial' });

test('demo user can navigate the seeded operational workflow', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);

  await page.waitForURL('**/dashboard');
  await expect(
    page.getByRole('heading', { name: `Inicio operativo de ${DEMO_TENANT_NAME}` })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver propiedades/i })).toBeVisible();

  await page.goto('/dashboard/product');
  await expect(page.getByRole('heading', { name: 'Propiedades' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inventario de propiedades' })).toBeVisible();
  await expect(page.getByText('20 gestiones inmobiliarias en total')).toBeVisible();
  await expect(page.getByText(VISIBLE_DEMO_PROPERTY_TITLE).first()).toBeVisible();

  const propertyRow = page
    .getByRole('row')
    .filter({ hasText: VISIBLE_DEMO_PROPERTY_TITLE })
    .first();
  await propertyRow.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('menuitem', { name: /Ver detalle/i }).click();

  await expect(page).toHaveURL(/\/dashboard\/product\/[a-f0-9-]+$/i);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();
  await expect(page.getByText(VISIBLE_DEMO_PROPERTY_TITLE).first()).toBeVisible();

  await page.goto('/dashboard/seguimiento');
  await expect(page.getByRole('heading', { name: 'Seguimiento' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Últimas actualizaciones' })).toBeVisible();
  await expect(page.getByText(/encontrados?/i).first()).toBeVisible();
  await expect(
    page.getByText(/Ingresó una consulta calificada|Solicitud documental|Escritura/i).first()
  ).toBeVisible();
});

for (const scenario of SELLER_SCENARIOS) {
  test(`${scenario.email} sees a distinct assigned seller dashboard`, async ({ page }) => {
    await signIn(page, scenario.email);

    await expect(
      page.getByRole('heading', { name: `Tu jornada comercial en ${DEMO_TENANT_NAME}` })
    ).toBeVisible();
    await expect(page.getByText('Panel de vendedor')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver mis propiedades' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nueva propiedad' })).toHaveCount(0);

    const assignedProducts = await getAssignedProducts(page);
    const assignedTitles = assignedProducts.items.map((item) => item.property.title);

    expect(assignedProducts.total).toBe(scenario.expectedTotal);
    expect(assignedTitles).toContain(scenario.expectedAssignedTitle);
    expect(assignedTitles).not.toContain(scenario.unassignedTitle);
    expect(
      assignedProducts.items.every((item) =>
        item.agents.some((agent) => agent.email === scenario.email)
      )
    ).toBe(true);

    await page.goto('/dashboard/product');
    await expect(page.getByRole('heading', { name: 'Propiedades' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nueva propiedad' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Cambiar estado de/i })).toHaveCount(0);
    await expect(page.getByText(scenario.expectedAssignedTitle).first()).toBeVisible();

    const assignedRow = page
      .getByRole('row')
      .filter({ hasText: scenario.expectedAssignedTitle })
      .first();
    await assignedRow.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(page.getByRole('menuitem', { name: /Ver detalle/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Editar/i })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /Archivar|Restaurar/i })).toHaveCount(0);
    await page.getByRole('menuitem', { name: /Ver detalle/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/product\/[a-f0-9-]+$/i);
    await expect(page.getByRole('button', { name: /Editar propiedad/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Gestionar vendedores/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Vincular propietario/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Solicitar documento/i })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Cambiar estado de/i })).toHaveCount(0);
  });
}

test('demo owner can read the owner portal follow-up', async ({ page }) => {
  await openOwnerPropertyDetail(page);

  await expect(page.getByRole('tab', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Seguimiento' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Documentos' })).toBeVisible();
  await expect(page.getByText('Ficha técnica')).toBeVisible();
  await expect(page.getByText('Superficie cubierta')).toBeVisible();
  await expect(page.getByText('231 m²')).toBeVisible();
  await page.getByRole('tab', { name: 'Seguimiento' }).click();
  await expect(page.getByText('Estado de la gestión')).toBeVisible();
  await expect(page.getByText('Estado actual: Publicación activa')).toBeVisible();
  await expect(
    page.getByText(/Ingresó una consulta calificada|Se concretó una visita|Oferta/i).first()
  ).toBeVisible();
  await expect(page.getByText('Nueva propiedad')).toHaveCount(0);
  await expect(page.getByText('Editar')).toHaveCount(0);
});

test('demo owner can upload a requested document', async ({ page }) => {
  await openOwnerPropertyDetail(page);
  await page.getByRole('tab', { name: 'Documentos' }).click();

  const pendingRequest = page
    .locator('li')
    .filter({ has: page.getByText('Pendiente', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Subir documento' }) })
    .first();
  await expect(pendingRequest).toBeVisible();

  const requestTitle = await pendingRequest.locator('h4').innerText();
  await pendingRequest.getByLabel('Subir documento archivo').setInputFiles({
    name: 'seeded-smoke-document.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% ViewPro seeded owner upload\n', 'utf8')
  });
  await page.getByRole('button', { name: 'Confirmar carga' }).click();

  const uploadedRequest = page.locator('li').filter({ hasText: requestTitle }).first();
  await expect(uploadedRequest.getByText('En revisión', { exact: true })).toBeVisible();
  await expect(uploadedRequest.getByText(/Subido el/i)).toBeVisible();
});

test('existing demo owner can accept another property invitation', async ({ page }) => {
  await page.goto(`/owner-invitations/${EXISTING_OWNER_INVITATION_TOKEN}`);

  await expect(page.getByText('Aceptar invitación').first()).toBeVisible();
  await expect(page.getByText(EXISTING_OWNER_INVITED_PROPERTY_TITLE)).toBeVisible();
  await expect(page.getByText(OWNER_EMAIL)).toBeVisible();
  await expect(page.getByText('Este email ya tiene cuenta.')).toBeVisible();

  await page.getByLabel('Contraseña *', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Aceptar invitación' }).click();
  await page.waitForURL('**/owner');

  await expect(page.getByRole('heading', { name: 'Tus propiedades' })).toBeVisible();
  const properties = await page.request.get('/api/owner/properties');
  expect(properties.ok()).toBe(true);
  const ownerProperties = (await properties.json()) as OwnerPropertiesResponse;

  expect(ownerProperties.map((property) => property.title)).toEqual(
    expect.arrayContaining([OWNER_VISIBLE_PROPERTY_TITLE, EXISTING_OWNER_INVITED_PROPERTY_TITLE])
  );
});

test('demo manager sees seeded internal notifications', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);

  const internalNotifications = await getJson<NotificationsResponse>(
    page,
    '/api/notifications?page=1&pageSize=10'
  );
  expect(internalNotifications.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ title: 'Document uploaded', readAt: null }),
      expect.objectContaining({ title: 'Movement created' })
    ])
  );
  for (const notification of internalNotifications.items) {
    expect(notification.linkHref).toBeTruthy();
    expect(notification.linkHref).toMatch(/^\/dashboard\//);
    expect(notification.linkHref).not.toMatch(/^https?:\/\//);
  }
  const internalUnread = await getJson<UnreadNotificationsCountResponse>(
    page,
    '/api/notifications/unread-count'
  );
  expect(internalUnread.unreadCount).toBeGreaterThanOrEqual(1);
});

test('demo owner sees seeded notifications, images and contacts', async ({ page }) => {
  await signIn(page, OWNER_EMAIL, '/owner');

  const ownerNotifications = await getJson<NotificationsResponse>(
    page,
    '/api/owner/notifications?page=1&pageSize=10'
  );
  expect(ownerNotifications.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ title: 'Document requested', readAt: null }),
      expect.objectContaining({ title: 'Document rejected' })
    ])
  );
  for (const notification of ownerNotifications.items) {
    expect(notification.linkHref).toBeTruthy();
    expect(notification.linkHref).toMatch(/^\/owner\//);
    expect(notification.linkHref).not.toMatch(/^\/dashboard\//);
  }
  const ownerUnread = await getJson<UnreadNotificationsCountResponse>(
    page,
    '/api/owner/notifications/unread-count'
  );
  expect(ownerUnread.unreadCount).toBeGreaterThanOrEqual(1);

  const ownerProperties = await getJson<OwnerPropertiesResponse>(page, '/api/owner/properties');
  const ownerProperty = ownerProperties.find(
    (property) => property.title === OWNER_VISIBLE_PROPERTY_TITLE
  );
  expect(ownerProperty?.primaryImage).toBeTruthy();
  const ownerEngagements = await getJson<OwnerEngagementResponse[]>(
    page,
    `/api/owner/properties/${ownerProperty!.id}/engagements`
  );
  expect(ownerEngagements[0]?.contact).toEqual(
    expect.objectContaining({
      available: true,
      targetType: 'tenant',
      displayLabel: 'Contactar inmobiliaria',
      whatsappPhone: '+5493510000000'
    })
  );
  const ownerTimeline = await getJson<OwnerTimelineResponse>(
    page,
    `/api/owner/engagements/${ownerEngagements[0]!.id}/timeline?page=1&pageSize=20&order=desc`
  );
  // Stage 23.5: resolver now uses assigned seller (sofia.demo = +5493512222222 for index-0 engagement)
  expect(ownerTimeline.items.some((item) => item.contact.whatsappPhone === '+5493512222222')).toBe(
    true
  );
  // All movements on index-0 engagement resolve to sofia (available = true); some others may not.
  expect(ownerTimeline.items.some((item) => item.contact.available)).toBe(true);

  // T19a (Stage 26.3 S-9, FR-17..FR-18) — WhatsApp anchor href wired to tenant phone.
  // The owner is already on /owner where the OwnerPropertyCard renders the WhatsApp CTA.
  const ownerWhatsappAnchor = page.locator('a[href*="wa.me"]').first();
  await expect(ownerWhatsappAnchor).toBeVisible({ timeout: 10_000 });
  const whatsappHref = await ownerWhatsappAnchor.getAttribute('href');
  expect(whatsappHref).toContain('5493510000000');
});

test('viewpro admin can inspect seeded tenant limits', async ({ page }) => {
  await signIn(page, DEMO_ADMIN_EMAIL, '/owner');
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Admin InmoView' })).toBeVisible();
  const adminTenants = await getJson<AdminTenantsResponse>(
    page,
    '/api/admin/tenants?page=1&pageSize=10'
  );
  const demoTenant = adminTenants.items.find(
    (tenant) => tenant.slug === 'viewpro-demo-inmobiliaria'
  );
  expect(demoTenant).toEqual(
    expect.objectContaining({
      status: 'ACTIVE',
      limits: {
        maxUsers: 12,
        maxActivePropertyEngagements: 25,
        maxDocumentsStorageMb: 512
      }
    })
  );
});

test('seller can create movements with outcomes and chip appears in feed (FR-11 invariant gate)', async ({
  page
}) => {
  const MARTIN_EMAIL = 'martin.demo@viewpro.local';
  await signIn(page, MARTIN_EMAIL);

  // Find a property assigned to martin.
  const products = await getAssignedProducts(page);
  const product = products.items[0];
  expect(product, 'Expected at least one assigned product for martin').toBeTruthy();
  const productId = product!.id;

  // Navigate to the product detail page.
  await page.goto(`/dashboard/product/${productId}`);
  await expect(page).toHaveURL(/\/dashboard\/product\/[a-f0-9-]+$/i);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();

  // Capture the current engagement status before creating any movements.
  const engagementBefore = await getJson<{ status: string }>(
    page,
    `/api/products/${productId}`
  );
  const statusBefore = engagementBefore.status;

  // --- Movement 1: built-in outcome ---
  await page.getByRole('button', { name: /Agregar actualización/i }).click();
  await expect(page.getByRole('dialog', { name: /Agregar actualización/i })).toBeVisible();

  // Select built-in outcome CONSULTAS_Y_VISITAS.
  await page.getByRole('combobox', { name: /resultado del movimiento/i }).click();
  await page.getByText('Consultas y visitas').click();

  // Fill observation (required).
  await page.getByLabel('Observación').fill('Primer movimiento con resultado built-in de smoke test.');
  await page.getByRole('button', { name: /Guardar actualización/i }).click();

  // Wait for dialog to close and chip to appear in feed.
  await expect(page.getByRole('dialog', { name: /Agregar actualización/i })).not.toBeVisible();
  await expect(page.getByText('Consultas y visitas').first()).toBeVisible({ timeout: 10_000 });

  // --- Movement 2: custom label created inline ---
  await page.getByRole('button', { name: /Agregar actualización/i }).click();
  await expect(page.getByRole('dialog', { name: /Agregar actualización/i })).toBeVisible();

  // Open combobox and click "+ Agregar etiqueta".
  await page.getByRole('combobox', { name: /resultado del movimiento/i }).click();
  await page.getByText(/\+ Agregar etiqueta/i).click();

  // Fill the inline create-label form.
  await page.getByLabel('Nombre').fill('Smoke test label');
  await page.getByLabel(/Color de la etiqueta/i).fill('#10B981');
  await page.getByRole('button', { name: /Crear etiqueta/i }).click();

  // Fill observation for the second movement.
  await page.getByLabel('Observación').fill('Segundo movimiento con etiqueta personalizada de smoke test.');
  await page.getByRole('button', { name: /Guardar actualización/i }).click();

  // Wait for dialog to close and custom label chip to appear in feed.
  await expect(page.getByRole('dialog', { name: /Agregar actualización/i })).not.toBeVisible();
  await expect(page.getByText('Smoke test label').first()).toBeVisible({ timeout: 10_000 });

  // FR-11 invariant: property engagement status must not have changed.
  const engagementAfter = await getJson<{ status: string }>(
    page,
    `/api/products/${productId}`
  );
  expect(engagementAfter.status).toBe(statusBefore);
});

test('demo manager can review a submitted document request', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/product');

  const product = await getProductByTitle(page, OWNER_VISIBLE_PROPERTY_TITLE);
  await page.goto(`/dashboard/product/${product.id}`);

  await expect(page).toHaveURL(/\/dashboard\/product\/[a-f0-9-]+$/i);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();
  await expect(page.getByText(OWNER_VISIBLE_PROPERTY_TITLE).first()).toBeVisible();

  const submittedRequest = page
    .locator('li')
    .filter({ hasText: 'Escritura firmada' })
    .filter({ has: page.getByText('Subido', { exact: true }) })
    .first();
  await expect(submittedRequest).toBeVisible();

  const readUrl = await openAndVerifySignedReadUrl(page, submittedRequest);
  await expect(page.getByText(readUrl)).toHaveCount(0);

  await submittedRequest.getByRole('button', { name: 'Aprobar' }).click();

  await page.getByRole('tab', { name: /Resueltos\s*·\s*\d+/i }).click();
  await page.getByRole('button', { name: /Historial\s*\d+ resueltas/i }).click();
  const reviewedRequest = page.locator('li').filter({ hasText: 'Escritura firmada' }).first();
  await expect(reviewedRequest.getByText('Aprobado', { exact: true })).toBeVisible();
});

const MARTIN_EMAIL = 'martin.demo@viewpro.local';
const MAPUCHE_PROPERTY_TITLE = 'Casa para refaccionar en Mapuche';
const MAPUCHE_PROPERTY_TITLE_SHORT = 'Mapuche';

/**
 * T-34 reject path: manager rejects the seeded PENDING Mapuche request.
 * Runs first so it can use the seeded PENDING without needing to create a new one.
 */
test('manager can reject a pending status change request from the bandeja (T-34 reject)', async ({
  page
}) => {
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/status-change-requests');
  await expect(page.getByRole('heading', { name: 'Solicitudes de cambio de estado' })).toBeVisible();

  // Seeded PENDING request for Mapuche should appear
  await expect(page.getByText(MAPUCHE_PROPERTY_TITLE).first()).toBeVisible({ timeout: 10_000 });

  const mapucheRow = page
    .getByRole('row')
    .filter({ hasText: MAPUCHE_PROPERTY_TITLE_SHORT })
    .first();
  await mapucheRow.getByRole('button', { name: /Rechazar/i }).click();

  // Reject dialog opens
  const rejectDialog = page.getByRole('dialog');
  await expect(rejectDialog).toBeVisible({ timeout: 5_000 });

  await rejectDialog.getByLabel(/Motivo del rechazo/i).fill('Documentación incompleta');
  await rejectDialog.getByRole('button', { name: /Rechazar/i }).click();

  // Toast success
  await expect(page.getByText(/Solicitud rechazada|rechazada/i).first()).toBeVisible({
    timeout: 10_000
  });

  // Row disappears from bandeja
  await expect(
    page.getByRole('row').filter({ hasText: MAPUCHE_PROPERTY_TITLE_SHORT })
  ).toHaveCount(0, { timeout: 10_000 });
});

/**
 * T-34 approve path: martin creates a new status change request, manager approves it.
 * Runs after the reject test (which cleared the seeded PENDING).
 */
test('manager can approve a new status change request from the bandeja (T-34 approve)', async ({
  page
}) => {
  // Sign in as martin (seller) and create a new status change request via API
  await signIn(page, MARTIN_EMAIL);

  // Use the products list to find the Mapuche engagement ID
  const products = await getAssignedProducts(page);
  const mapucheProduct = products.items.find((item) =>
    item.property.title.includes(MAPUCHE_PROPERTY_TITLE_SHORT)
  );
  expect(mapucheProduct, `Mapuche should be in martin's assigned products`).toBeTruthy();
  const mapucheId = mapucheProduct!.id;

  // After the reject test the Mapuche status is still CAPTURE (reject doesn't change status).
  const createResp = await page.request.post(`/api/products/${mapucheId}/status-change-requests`, {
    data: {
      targetStatus: 'ACTIVE_PUBLICATION',
      currentStatusSnapshot: 'CAPTURE',
      requestNote: 'Listo para publicar ahora'
    }
  });
  expect(
    createResp.status() === 201 || createResp.status() === 409,
    `Expected 201/409 creating request, got ${createResp.status()}`
  ).toBe(true);

  // Switch to manager session
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/status-change-requests');
  await expect(page.getByRole('heading', { name: 'Solicitudes de cambio de estado' })).toBeVisible();

  // The new PENDING request for Mapuche should appear
  await expect(page.getByText(MAPUCHE_PROPERTY_TITLE).first()).toBeVisible({ timeout: 10_000 });

  // Approve it
  const mapucheRow = page
    .getByRole('row')
    .filter({ hasText: MAPUCHE_PROPERTY_TITLE_SHORT })
    .first();
  await mapucheRow.getByRole('button', { name: /Aprobar/i }).click();

  // Toast appears
  await expect(page.getByText(/Aprobada|Aprobado|actualizado/i).first()).toBeVisible({
    timeout: 10_000
  });

  // The row disappears from the bandeja
  await expect(
    page.getByRole('row').filter({ hasText: MAPUCHE_PROPERTY_TITLE_SHORT })
  ).toHaveCount(0, { timeout: 10_000 });

  // Navigate to Mapuche property and verify status badge shows "Publicación activa"
  await page.goto(`/dashboard/product/${mapucheId}`);
  await expect(page.getByText('Publicación activa').first()).toBeVisible({ timeout: 10_000 });
});

async function openOwnerPropertyDetail(page: Page) {
  await signIn(page, OWNER_EMAIL, '/owner');

  await expect(page.getByRole('heading', { name: 'Tus propiedades' })).toBeVisible();
  await expect(page.getByText('Inmobiliaria vinculada')).toBeVisible();
  await expect(page.getByText(DEMO_TENANT_NAME, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', { name: `Imagen principal de ${OWNER_VISIBLE_PROPERTY_TITLE}` })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Casa familiar con pileta' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver más' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /1\. Actividad reciente/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nueva propiedad' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Ver más' }).first().click();
  // owner-home.tsx builds this href with the engagement it opened, so pin the
  // parameter instead of dropping the anchor: the link is meant to carry it.
  await expect(page).toHaveURL(/\/owner\/properties\/[a-f0-9-]+\?engagement=[a-f0-9-]+$/i);
  await expect(page.getByRole('heading', { name: OWNER_VISIBLE_PROPERTY_TITLE })).toBeVisible();
}

async function openAndVerifySignedReadUrl(page: Page, requestItem: Locator) {
  const readUrlResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/document-versions\/[a-f0-9-]+\/read-url$/.test(response.url())
  );
  const popupPromise = page.waitForEvent('popup', { timeout: 5_000 }).catch(() => null);

  await requestItem.getByRole('button', { name: 'Abrir documento', exact: true }).click();

  const readUrlResponse = await readUrlResponsePromise;
  expect(readUrlResponse.ok()).toBe(true);

  const body = (await readUrlResponse.json()) as { readUrl: { url: string } };
  const storageResponse = await page.request.get(body.readUrl.url);
  expect(storageResponse.ok()).toBe(true);
  expect(await storageResponse.text()).toContain('%PDF-1.4');

  const popup = await popupPromise;
  await popup?.close();

  return body.readUrl.url;
}

async function signIn(page: Page, email: string, redirectPath = '/dashboard') {
  await page.context().clearCookies();
  await page.goto(`/auth/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`);
  await page.evaluate(() => localStorage.clear());
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña *', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL(`**${redirectPath}`);
}

// getAssignedProducts, getJson, getProductByTitle are imported from ./_helpers
// ProductsResponse type is also imported from ./_helpers

type OwnerPropertiesResponse = Array<{
  id: string;
  title: string;
  primaryImage: unknown | null;
}>;

type NotificationsResponse = {
  items: Array<{
    title: string;
    linkHref: string | null;
    readAt: string | null;
  }>;
};

type UnreadNotificationsCountResponse = {
  unreadCount: number;
};

type OwnerEngagementResponse = {
  id: string;
  contact: {
    available: boolean;
    targetType: 'tenant';
    displayLabel: string;
    whatsappPhone?: string;
  };
};

type OwnerTimelineResponse = {
  items: Array<{
    contact: {
      available: boolean;
      whatsappPhone?: string;
    };
  }>;
};

type AdminTenantsResponse = {
  items: Array<{
    id: string;
    slug: string;
    status: string;
    limits: {
      maxUsers: number | null;
      maxActivePropertyEngagements: number | null;
      maxDocumentsStorageMb: number | null;
    };
  }>;
};

// ---------------------------------------------------------------------------
// Stage 26.3 — New tests (T13..T20) covering audit gaps G-1..G-7
// ORDERING: T13 MUST run after Test 1 (asserts '20 gestiones en total').
//           T14 depends on T13 (new engagement). T15 depends on T14 (martin assigned).
//           T20 has a title-guarded afterEach restore; later tests are allowed, and
//           pnpm demo:seed remains the hard-kill fallback if that hook cannot run.
// ---------------------------------------------------------------------------

// Track the title of the engagement created in T13 so T14 and T15 can reference it.
let newEngagementTitle = '';

// T13 — G-1 (FR-1..FR-4): Manager creates a new property engagement through the UI.
// ORDERING: must run after Test 1 which asserts the 20-engagement count (Risk #4 mitigation).
test('manager can create a new property engagement through the UI', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/product');

  // Snapshot the current total before creation.
  const beforeTotal = (await getJson<ProductsResponse>(page, '/api/products?limit=50')).total;

  // Click "Nueva propiedad" link.
  await page.getByRole('link', { name: 'Nueva propiedad' }).click();
  await expect(page).toHaveURL(/\/dashboard\/product\/new$/i);

  // Generate a unique title so T14/T15 can find it.
  newEngagementTitle = `Smoke test engagement ${Date.now()}`;

  // Fill required fields.
  await page.getByLabel('Título').fill(newEngagementTitle);
  await page.getByLabel('Dirección').fill('Calle Smoke Test 123');
  await page.getByLabel('Ciudad').fill('Córdoba');
  await page.getByLabel('Provincia').fill('Córdoba');

  // Tipo de propiedad combobox.
  await page.getByRole('combobox', { name: /Tipo de propiedad/i }).click();
  await page.getByRole('option', { name: 'Casa' }).click();

  // Operación combobox.
  await page.getByRole('combobox', { name: /Operación/i }).click();
  await page.getByRole('option', { name: 'Venta' }).click();

  // Moneda combobox.
  await page.getByRole('combobox', { name: /Moneda/i }).click();
  await page.getByRole('option', { name: 'USD' }).click();

  // Submit.
  await page.getByRole('button', { name: 'Crear propiedad' }).click();
  await page.waitForURL('**/dashboard/product', { timeout: 15_000 });

  // Assertion 1: total increased by 1.
  const afterTotal = (await getJson<ProductsResponse>(page, '/api/products?limit=50')).total;
  expect(afterTotal).toBe(beforeTotal + 1);

  // Assertion 2: new property title visible in the table.
  await expect(page.getByText(newEngagementTitle).first()).toBeVisible({ timeout: 10_000 });

  // Assertion 3: navigate to the new property detail page and verify title + initial status.
  const newProduct = await getProductByTitle(page, newEngagementTitle);
  await page.goto(`/dashboard/product/${newProduct.id}`);
  await expect(page.getByText(newEngagementTitle).first()).toBeVisible();
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();

  // Assertion 4 (FR-4): martin was not assigned at creation; his product list must not include it.
  // We sign in as martin in the same page (then signIn restores manager context isn't needed here
  // since T14 will sign in freshly). Martin's assigned list is verified at the API level.
  await signIn(page, 'martin.demo@viewpro.local');
  const martinProducts = await getJson<ProductsResponse>(page, '/api/products?limit=50');
  const martinTitles = martinProducts.items.map((item) => item.property.title);
  expect(martinTitles).not.toContain(newEngagementTitle);
});

// T14 — G-2 (FR-5..FR-6): Manager assigns martin to the new engagement via Gestionar vendedores.
test('manager can assign martin to the new engagement via Gestionar vendedores', async ({
  page
}) => {
  await signIn(page, DEMO_EMAIL);

  // Navigate to the engagement created in T13.
  const newProduct = await getProductByTitle(page, newEngagementTitle);
  await page.goto(`/dashboard/product/${newProduct.id}`);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();

  // Open Gestionar vendedores dialog.
  await page.getByRole('button', { name: /Gestionar vendedores/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  // Wait for the "Disponibles para asignar" section and martin's row to appear.
  await expect(dialog.getByText(/Disponibles para asignar/i)).toBeVisible({ timeout: 10_000 });
  const martinAvailableRow = dialog
    .locator('section')
    .filter({ hasText: /Disponibles para asignar/i })
    .locator('li')
    .filter({ hasText: 'martin.demo@viewpro.local' })
    .first();
  await expect(martinAvailableRow).toBeVisible({ timeout: 10_000 });
  await martinAvailableRow.getByRole('button', { name: /Asignar/i }).click();

  // Wait for assignment to complete: martin should appear in "Asignados actualmente".
  const martinAssignedRow = dialog
    .locator('section')
    .filter({ hasText: /Asignados actualmente/i })
    .locator('li')
    .filter({ hasText: 'martin.demo@viewpro.local' })
    .first();
  await expect(martinAssignedRow).toBeVisible({ timeout: 10_000 });

  // Close dialog via the X button or Escape.
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });

  // Assertion: martin's product list now includes the new engagement.
  await signIn(page, 'martin.demo@viewpro.local');
  const martinProducts = await getJson<ProductsResponse>(page, '/api/products?limit=50');
  const martinTitles = martinProducts.items.map((item) => item.property.title);
  expect(martinTitles).toContain(newEngagementTitle);
});

// T15 — G-2 (FR-7): Manager removes martin's assignment via Gestionar vendedores.
test("manager can remove martin's assignment via Gestionar vendedores", async ({ page }) => {
  await signIn(page, DEMO_EMAIL);

  const newProduct = await getProductByTitle(page, newEngagementTitle);
  await page.goto(`/dashboard/product/${newProduct.id}`);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();

  // Open Gestionar vendedores dialog.
  await page.getByRole('button', { name: /Gestionar vendedores/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  // In "Asignados actualmente" find martin and click Quitar.
  const martinAssignedRow = dialog
    .locator('section')
    .filter({ hasText: /Asignados actualmente/i })
    .locator('li')
    .filter({ hasText: 'martin.demo@viewpro.local' })
    .first();
  await expect(martinAssignedRow).toBeVisible({ timeout: 10_000 });
  await martinAssignedRow.getByRole('button', { name: /Quitar/i }).click();

  // Wait for removal to complete: martin should appear in "Disponibles para asignar".
  const martinAvailableRow = dialog
    .locator('section')
    .filter({ hasText: /Disponibles para asignar/i })
    .locator('li')
    .filter({ hasText: 'martin.demo@viewpro.local' })
    .first();
  await expect(martinAvailableRow).toBeVisible({ timeout: 10_000 });

  // Close dialog.
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });

  // Assertion: martin's product list no longer includes the new engagement.
  await signIn(page, 'martin.demo@viewpro.local');
  const martinProductsAfter = await getJson<ProductsResponse>(page, '/api/products?limit=50');
  const martinTitlesAfter = martinProductsAfter.items.map((item) => item.property.title);
  expect(martinTitlesAfter).not.toContain(newEngagementTitle);
});

// T16 — G-3 (FR-8..FR-10): Manager creates a plain movement without an outcome label.
test('manager can create a plain movement without an outcome label', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);

  // Navigate directly using the API to get the product ID, avoiding table pagination issues.
  const movementProduct = await getProductByTitle(page, VISIBLE_DEMO_PROPERTY_TITLE);
  await page.goto(`/dashboard/product/${movementProduct.id}`);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();

  // Snapshot the current engagement status (FR-10 invariant).
  const productId = movementProduct.id;
  const engagementBefore = await getJson<{ status: string }>(page, `/api/products/${productId}`);
  const statusBefore = engagementBefore.status;

  // Open "Agregar actualización" dialog.
  await page.getByRole('button', { name: /Agregar actualización/i }).click();
  await expect(page.getByRole('dialog', { name: /Agregar actualización/i })).toBeVisible();

  // Do NOT select any outcome. Only fill Observación.
  const observationText = 'Actualización smoke test sin resultado.';
  await page.getByLabel('Observación').fill(observationText);
  await page.getByRole('button', { name: /Guardar actualización/i }).click();

  // Assertion 1: dialog closes.
  await expect(page.getByRole('dialog', { name: /Agregar actualización/i })).not.toBeVisible({
    timeout: 10_000
  });

  // Assertion 2: new movement entry is visible in the feed.
  await expect(page.getByText(observationText).first()).toBeVisible({ timeout: 10_000 });

  // Assertion 3: no outcome chip from any seeded label or the custom 'Smoke test label'.
  const outcomeLabels = [
    'Esperando documentos',
    'En negociación avanzada',
    'Propietario no responde',
    'Consultas y visitas',
    'Smoke test label'
  ];
  for (const label of outcomeLabels) {
    // Just check the observation-text row does NOT contain a chip.
    // The page may have chips from other movements — we only assert the new one has none.
    const newMovementRow = page.locator('li, article, [role="listitem"]').filter({ hasText: observationText }).first();
    await expect(newMovementRow.getByText(label)).toHaveCount(0);
  }

  // Assertion 4 (FR-10): engagement status must be unchanged.
  const engagementAfter = await getJson<{ status: string }>(page, `/api/products/${productId}`);
  expect(engagementAfter.status).toBe(statusBefore);
});

// T17 — G-4 (FR-11..FR-13): Manager creates a document request through the UI.
test('manager can create a document request through the UI', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);

  // Navigate directly to property index 0 (Villa Centenario) which has propietario.demo linked.
  // Use API to get the product ID to avoid table pagination issues.
  const villaProduct = await getProductByTitle(page, OWNER_VISIBLE_PROPERTY_TITLE);
  await page.goto(`/dashboard/product/${villaProduct.id}`);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();

  // Click "Solicitar documento".
  await page.getByRole('button', { name: /Solicitar documento/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  // Select the owner (Propietario select is required).
  // The dialog renders a Select with label "Propietario".
  const ownerSelect = dialog.getByRole('combobox');
  await expect(ownerSelect).toBeVisible({ timeout: 10_000 });
  await ownerSelect.click();
  // Select the first option available (propietario.demo is the only linked owner on Villa Centenario).
  const firstOption = page.getByRole('option').first();
  await expect(firstOption).toBeVisible({ timeout: 5_000 });
  await firstOption.click();

  // Fill the document title (label: "Documento solicitado").
  const requestTitle = 'Constancia adicional smoke test';
  await dialog.getByLabel(/Documento solicitado/i).fill(requestTitle);

  // Submit.
  await dialog.getByRole('button', { name: /Solicitar documento/i }).click();

  // Assertion 1: dialog closes.
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Assertion 2: document list shows new entry with "Pendiente" badge.
  await expect(
    page.locator('li').filter({ hasText: requestTitle }).filter({ has: page.getByText('Pendiente', { exact: true }) }).first()
  ).toBeVisible({ timeout: 10_000 });

  // Assertion 3 (FR-13): owner receives a DOCUMENT_REQUESTED notification.
  // Sign in as owner and check notifications.
  await signIn(page, OWNER_EMAIL, '/owner');
  const ownerNotifications = await getJson<NotificationsResponse>(
    page,
    '/api/owner/notifications?page=1&pageSize=10'
  );
  expect(ownerNotifications.items).toEqual(
    expect.arrayContaining([expect.objectContaining({ title: 'Document requested' })])
  );
});

// T18a — G-5 (FR-14..FR-15): Manager rejects an uploaded document request with a reason.
// Pre-condition: Stage 26.3 Commit B added a SUBMITTED fixture 'Constancia de servicios
// pendiente de revisión' on property index 1 (Los Boulevares).
test('manager can reject an uploaded document request with a reason', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);

  // Navigate directly to property index 1 (Los Boulevares) using API to get the ID.
  const boulevaresProduct = await getProductByTitle(page, EXISTING_OWNER_INVITED_PROPERTY_TITLE);
  await page.goto(`/dashboard/product/${boulevaresProduct.id}`);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();

  // Find the document row with the seeded SUBMITTED fixture.
  const submittedFixtureTitle = 'Constancia de servicios pendiente de revisión';
  const documentRow = page
    .locator('li')
    .filter({ hasText: submittedFixtureTitle })
    .filter({ has: page.getByText('Subido', { exact: true }) })
    .first();
  await expect(documentRow).toBeVisible({ timeout: 10_000 });

  // Click "Rechazar".
  await documentRow.getByRole('button', { name: 'Rechazar' }).click();
  const rejectDialog = page.getByRole('dialog');
  await expect(rejectDialog).toBeVisible({ timeout: 5_000 });

  // Fill rejection reason.
  const rejectionReason = 'Falta firma del titular en página 2';
  await rejectDialog.getByLabel(/Motivo de rechazo/i).fill(rejectionReason);
  await rejectDialog.getByRole('button', { name: /Rechazar documento/i }).click();

  // Assertion 1: toast "Documento rechazado" appears.
  await expect(page.getByText(/Documento rechazado/i).first()).toBeVisible({ timeout: 10_000 });

  // Assertion 2: document row badge transitions to "Rechazado".
  // After rejection the row moves to the "Resueltos" tab. The tab has a count badge.
  // We also need to expand the "Historial" accordion within the Resueltos tab.
  const resolutosTab = page.getByRole('tab', { name: /Resueltos/i });
  await resolutosTab.click();
  // Expand the Historial accordion (shows collapsed resolved items).
  const historialButton = page.getByRole('button', { name: /Historial\s*\d+\s*resueltas/i });
  await expect(historialButton).toBeVisible({ timeout: 10_000 });
  await historialButton.click();
  const rejectedRow = page
    .locator('li')
    .filter({ hasText: submittedFixtureTitle })
    .first();
  await expect(rejectedRow.getByText('Rechazado', { exact: true })).toBeVisible({ timeout: 10_000 });

  // Assertion 3: rejection reason visible.
  await expect(rejectedRow.getByText(rejectionReason)).toBeVisible({ timeout: 10_000 });

  // Assertion 4 (FR-16): owner receives a DOCUMENT_REJECTED notification.
  await signIn(page, OWNER_EMAIL, '/owner');
  const ownerNotifications = await getJson<NotificationsResponse>(
    page,
    '/api/owner/notifications?page=1&pageSize=10'
  );
  expect(ownerNotifications.items).toEqual(
    expect.arrayContaining([expect.objectContaining({ title: 'Document rejected' })])
  );
});

// T18b — G-5 (FR-16): Owner sees rejection reason and re-upload option.
// Pre-condition: T18a completed (document is now REJECTED on Los Boulevares).
test('owner sees rejection reason and re-upload action on the rejected document', async ({
  page
}) => {
  // Sign in as owner — propietario.demo is linked to Los Boulevares via the existing invitation
  // which Test 6 accepted. After acceptance, they can see the Los Boulevares property.
  await signIn(page, OWNER_EMAIL, '/owner');

  // Find the Los Boulevares property in owner portal.
  const ownerProperties = await getJson<OwnerPropertiesResponse>(page, '/api/owner/properties');
  const boulevaresProperty = ownerProperties.find(
    (property) => property.title === EXISTING_OWNER_INVITED_PROPERTY_TITLE
  );
  expect(boulevaresProperty, `Expected ${EXISTING_OWNER_INVITED_PROPERTY_TITLE} in owner properties`).toBeTruthy();

  // Navigate to the property with the documents tab active.
  await page.goto(`/owner/properties/${boulevaresProperty!.id}?tab=documents`);
  await expect(page.getByRole('tab', { name: 'Documentos' })).toBeVisible({ timeout: 10_000 });

  const submittedFixtureTitle = 'Constancia de servicios pendiente de revisión';
  const rejectionReason = 'Falta firma del titular en página 2';

  // Assertion 1: entry shows the rejected state.
  // Owner portal uses "Acción requerida" badge label for REJECTED status (not "Rechazado").
  // The accessible status label includes "rechazado" text in the ARIA role.
  const rejectedEntry = page.locator('li').filter({ hasText: submittedFixtureTitle }).first();
  await expect(rejectedEntry).toBeVisible({ timeout: 10_000 });
  // Check either the visible badge text or the accessible label.
  await expect(
    rejectedEntry.getByText('Acción requerida', { exact: true })
  ).toBeVisible({ timeout: 10_000 });

  // Assertion 2: rejection reason text is visible.
  await expect(rejectedEntry.getByText(rejectionReason)).toBeVisible({ timeout: 10_000 });

  // Assertion 3: re-upload button is visible ("Subir nueva versión" for REJECTED state).
  // Use exact:true to avoid matching the hidden <input type="file"> with aria-label "Subir nueva versión archivo".
  await expect(
    rejectedEntry.getByRole('button', { name: 'Subir nueva versión', exact: true })
  ).toBeVisible({ timeout: 10_000 });
});

// T19b — G-6 (FR-19): Owner WhatsApp click POSTs a tracking event.
// Pre-condition: T-1 confirmed onClick={handleContactClick} is wired in owner-home.tsx.
test('owner WhatsApp click POSTs a tracking event', async ({ page }) => {
  await signIn(page, OWNER_EMAIL, '/owner');

  // Intercept the tracking endpoint BEFORE clicking.
  let trackingHits = 0;
  await page.route('**/api/owner/engagements/*/whatsapp-contact-click', (route) => {
    trackingHits++;
    return route.continue();
  });

  // Find the WhatsApp anchor (rendered on /owner by OwnerPropertyCard).
  const whatsappAnchor = page.locator('a[href*="wa.me"]').first();
  await expect(whatsappAnchor).toBeVisible({ timeout: 10_000 });

  // Click with Meta modifier (or new-tab handling) to avoid navigating away.
  // Use waitForEvent('popup') to absorb the new-tab open and close it.
  const popupPromise = page.waitForEvent('popup', { timeout: 5_000 }).catch(() => null);
  await whatsappAnchor.click({ modifiers: ['Meta'] });
  const popup = await popupPromise;
  await popup?.close();

  // Wait briefly for the tracking POST to complete.
  await page.waitForTimeout(500);

  // Assertion: tracking endpoint was called at least once.
  expect(trackingHits).toBeGreaterThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// Stage 24.5 — S-B1 + S-B2: mark-read + reload persistence (owner and manager).
// These two tests mutate readAt on seeded notifications (mark-one-read / mark-all-read).
// CLEANUP: there is NO HTTP mark-unread endpoint to surgically restore readAt, so the
// afterEach below runs a FULL `pnpm demo:seed` re-seed as the cleanup fallback. It is a
// blunt restore, not a per-id surgical undo. Its purpose is forward-safety: keeping seeded
// readAt state deterministic for any subsequent test under retries or test reordering.
// NEXT-RESEED FALLBACK: if the afterEach itself fails (e.g. hard kill), run
// 'pnpm demo:seed' manually to restore the seeded readAt state.
// ---------------------------------------------------------------------------

// Workspace root + document-storage root — same calculation as global-setup.ts so the
// re-seed writes document fixtures to the storage root the seeded server actually serves.
const seededWorkspaceRoot = resolve(process.cwd(), '../..');
const seededDocumentStorageRoot = resolve(seededWorkspaceRoot, 'apps/api/.document-storage-seeded');
const seededApiPort = Number(process.env.VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT ?? 3001);
const seededApiBaseUrl = `http://127.0.0.1:${seededApiPort}`;
const seededDocumentStorageSecret =
  process.env.VIEWPRO_APP_NEW_SEEDED_E2E_ACCESS_TOKEN_SECRET ?? 'app-new-seeded-auth-e2e-local';

// Playwright injects fixtures as the first hook arg and requires it to be an object-destructure
// pattern; this hook needs no fixtures, only testInfo, so the empty pattern is intentional.
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  const isMarkReadTest =
    testInfo.title.includes('owner mark-one-read persists after re-fetch') ||
    testInfo.title.includes('manager mark-all-read yields unread-count zero after re-fetch');
  if (!isMarkReadTest) {
    return;
  }
  // Full re-seed cleanup fallback (no mark-unread endpoint exists). Must pass the SAME
  // DOCUMENT_STORAGE_* / API_PUBLIC_URL env block as global-setup.ts so document fixtures
  // land in the storage root the server reads from; passing only process.env would seed
  // documents to the wrong (default) root. Only runs for the two title-matched tests above.
  try {
    execFileSync('pnpm', ['demo:seed'], {
      cwd: seededWorkspaceRoot,
      env: {
        ...process.env,
        API_PUBLIC_URL: seededApiBaseUrl,
        DOCUMENT_STORAGE_DRIVER: 'local',
        DOCUMENT_STORAGE_LOCAL_ROOT: seededDocumentStorageRoot,
        DOCUMENT_STORAGE_SIGNING_SECRET: seededDocumentStorageSecret
      },
      stdio: 'pipe'
    });
  } catch (err) {
    console.warn(
      'Stage 24.5 afterEach restore failed — run pnpm demo:seed to restore seeded readAt state.',
      err
    );
  }
});

// T-NEW-1 (S-B1) — owner mark-one-read persists after re-fetch.
// Auth: propietario.demo@viewpro.local (the demo owner). No tenant header required.
// FR-B1: the write must persist to the real DB and be observable across a separate GET request.
// FR-B3: the title-guarded afterEach re-seeds (full demo:seed) as the cleanup fallback,
//        keeping seeded readAt state deterministic for any later test under retries/reordering.
// FR-B4: isolation via afterEach cleanup, not serial ordering.
test('owner mark-one-read persists after re-fetch', async ({ page }) => {
  await signIn(page, OWNER_EMAIL, '/owner');

  // Capture the current set of unread owner notification IDs before any mutation.
  type NotificationItem = { id: string; readAt: string | null };
  type NotificationsPage = { items: NotificationItem[] };

  const unreadResponse = await getJson<NotificationsPage>(
    page,
    '/api/owner/notifications?unreadOnly=true'
  );
  const unreadIds = unreadResponse.items.map((n) => n.id);
  expect(
    unreadIds.length,
    'Expected at least one unread owner notification in demo seed'
  ).toBeGreaterThan(0);

  const targetId = unreadIds[0]!;

  // Mark the first unread notification read.
  const markResp = await page.request.post(`/api/owner/notifications/${targetId}/read`);
  expect(markResp.ok(), `POST /api/owner/notifications/${targetId}/read should return OK`).toBe(true);

  // Re-fetch the notification list and find the target record.
  const refetchResponse = await getJson<NotificationsPage>(
    page,
    '/api/owner/notifications?page=1&pageSize=10'
  );
  const refetched = refetchResponse.items.find((n) => n.id === targetId);
  expect(refetched, `Expected to find notification ${targetId} in re-fetched list`).toBeTruthy();
  // FR-B1: readAt must be non-null and non-empty on re-fetch (proves real-DB persistence).
  expect(refetched!.readAt).toBeTruthy();
  expect(typeof refetched!.readAt).toBe('string');
});

// T-NEW-2 (S-B2) — manager mark-all-read yields unread-count zero after re-fetch.
// Auth: demo@viewpro.local (the demo manager). The session context auto-selects the
// primary demo tenant (memberships[0]); no manual x-tenant-id header is needed — this
// mirrors T07's pattern (line 207). See _helpers.ts:113.
// FR-B2: unread-count must be 0 on re-fetch after mark-all-read.
// FR-B3: the title-guarded afterEach re-seeds (full demo:seed) as the cleanup fallback,
//        keeping seeded readAt state deterministic for any later test under retries/reordering.
// FR-B4: isolation via afterEach cleanup, not serial ordering.
test('manager mark-all-read yields unread-count zero after re-fetch', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);

  type CountResponse = { unreadCount: number };
  type NotificationItem = { id: string; readAt: string | null };
  type NotificationsPage = { items: NotificationItem[] };

  // Confirm there is at least one unread internal notification before mutation.
  const unreadBefore = await getJson<NotificationsPage>(page, '/api/notifications?unreadOnly=true');
  expect(
    unreadBefore.items.length,
    'Expected at least one unread internal notification in demo seed'
  ).toBeGreaterThan(0);

  // Mark all internal notifications read.
  const markAllResp = await page.request.post('/api/notifications/read-all');
  expect(markAllResp.ok(), 'POST /api/notifications/read-all should return OK').toBe(true);

  // Re-fetch unread-count — must be 0 (FR-B2).
  const countData = await getJson<CountResponse>(page, '/api/notifications/unread-count');
  expect(countData.unreadCount).toBe(0);
});

// T20 — G-7 (FR-20..FR-22): Tenant engagement limit blocks creation with a clear UI error.
// Its title-guarded afterEach restores maxActivePropertyEngagements to 25, so later tests
// are allowed. If the hook cannot run (e.g. hard kill), use 'pnpm demo:seed' as the fallback.
// The afterEach is scoped so it only runs for this test (guard on test title).
// Allowed duration: 12–15s (exceeds 10s soft budget — R4: admin PATCH + sign-in switch required).
const KNOWN_LIMITS = { maxActivePropertyEngagements: 25 };
let t20TenantId = '';

test.afterEach(async ({ page }, testInfo) => {
  if (!testInfo.title.includes('tenant engagement limit blocks creation')) {
    return;
  }
  if (!t20TenantId) {
    return;
  }
  try {
    // Admin users redirect to /owner after login; navigate to /admin before making admin API calls.
    await signIn(page, DEMO_ADMIN_EMAIL, '/owner');
    await page.goto('/admin');
    // All three limit fields are required by the BFF validation.
    await page.request.patch(`/api/admin/tenants/${t20TenantId}/limits`, {
      data: {
        maxUsers: 12,
        maxActivePropertyEngagements: KNOWN_LIMITS.maxActivePropertyEngagements,
        maxDocumentsStorageMb: 512
      }
    });
  } catch (err) {
    console.warn(
      'T20 afterEach restore failed — run pnpm demo:seed to restore the tenant limit.',
      err
    );
  }
});

test('tenant engagement limit blocks creation with a clear UI error', async ({ page }) => {
  // Step 1: get admin context and find tenant ID.
  // Admin users redirect to /owner after login; navigate explicitly to /admin.
  await signIn(page, DEMO_ADMIN_EMAIL, '/owner');
  await page.goto('/admin');
  const adminTenants = await getJson<AdminTenantsResponse>(
    page,
    '/api/admin/tenants?page=1&pageSize=10'
  );
  const demoTenant = adminTenants.items.find(
    (tenant) => tenant.slug === 'viewpro-demo-inmobiliaria'
  );
  expect(demoTenant, 'Expected viewpro-demo-inmobiliaria tenant to exist').toBeTruthy();
  t20TenantId = demoTenant!.id;

  // Step 2: snapshot the current limit (should be 25 from seed).
  const snapshotLimit = demoTenant!.limits.maxActivePropertyEngagements ?? 25;
  expect(snapshotLimit).toBe(KNOWN_LIMITS.maxActivePropertyEngagements);

  // Step 3: count active engagements (as manager — the products endpoint scopes by role).
  // We use the admin session here since the admin can also view all products via a manager session.
  // Actually we need to sign in as manager to get the correct product count.
  await signIn(page, DEMO_EMAIL);
  const currentProducts = await getJson<ProductsResponse>(page, '/api/products?limit=50');
  const activeCount = currentProducts.total;

  // Step 4: lower the limit to the current active count (prevents any new creation).
  // Admin redirects to /owner after login; navigate explicitly then patch via API.
  // The PATCH requires all three limit fields (any omitted field fails validation).
  await signIn(page, DEMO_ADMIN_EMAIL, '/owner');
  await page.goto('/admin');
  const patchResp = await page.request.patch(`/api/admin/tenants/${t20TenantId}/limits`, {
    data: {
      maxUsers: demoTenant!.limits.maxUsers,
      maxActivePropertyEngagements: activeCount,
      maxDocumentsStorageMb: demoTenant!.limits.maxDocumentsStorageMb
    }
  });
  expect(
    patchResp.ok(),
    `Expected PATCH to succeed, got ${patchResp.status()}: ${await patchResp.text().catch(() => '')}`
  ).toBe(true);

  // Step 5: sign in as manager and attempt to create a new engagement.
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/product/new');

  const timestamp = Date.now();
  await page.getByLabel('Título').fill(`Limite test ${timestamp}`);
  await page.getByLabel('Dirección').fill('Calle Límite 1');
  await page.getByLabel('Ciudad').fill('Córdoba');
  await page.getByLabel('Provincia').fill('Córdoba');
  await page.getByRole('combobox', { name: /Tipo de propiedad/i }).click();
  await page.getByRole('option', { name: 'Casa' }).click();
  await page.getByRole('combobox', { name: /Operación/i }).click();
  await page.getByRole('option', { name: 'Venta' }).click();
  await page.getByRole('combobox', { name: /Moneda/i }).click();
  await page.getByRole('option', { name: 'USD' }).click();
  await page.getByRole('button', { name: 'Crear propiedad' }).click();

  // Assertion 1: toast shows limit-exceeded message (Stage 26.3 MUI-1).
  await expect(
    page.getByText(/Alcanzaste el límite de propiedades activas/i).first()
  ).toBeVisible({ timeout: 10_000 });

  // Assertion 2: URL remains on /dashboard/product/new (no redirect on error).
  expect(page.url()).toContain('/dashboard/product/new');

  // Assertion 3 (FR-21): total is unchanged — no new engagement was created.
  const afterProducts = await getJson<ProductsResponse>(page, '/api/products?limit=50');
  expect(afterProducts.total).toBe(activeCount);

  // Assertion 4 (FR-22): form remains interactive (title input is still editable).
  await expect(page.getByLabel('Título')).toBeEditable();

  // Cleanup is handled by the afterEach hook above (restores maxActivePropertyEngagements to 25).
});

// ---------------------------------------------------------------------------
// Stage 20.11 — S-8: Seguimiento filter smoke (date + Responsable = Martín)
//
// Pre-conditions (seeded by Stage 20.11 S-8 fixture in seed-demo.mjs):
//   - Martín is assigned to Los Boulevares (index 1).
//   - A manager-authored movement ("Manager note on Boulevares") was created at
//     DEMO_NOW (2026-06-01T12:00:00Z) on Boulevares — i.e. on the seed-clock day.
//
// Under the old broken code (createdByUserId filter), filtering by Responsable=Martín
// would HIDE that movement because it was created by the manager.
// Under the fixed code (assignedAgentUserId filter), it APPEARS because Martín is assigned.
//
// The seed-clock date is 2026-06-01 — used for both dateFrom and dateTo to scope the feed
// to that single day. The manager-authored movement must appear; Sofia/Lucía items must not.
// ---------------------------------------------------------------------------

// Seed clock anchor — must match DEMO_NOW in seed-demo.mjs
const SEED_CLOCK_DATE = '2026-06-01';
const BOULEVARES_PROPERTY_TITLE = 'Casa luminosa con patio en Los Boulevares';

test('Seguimiento filter smoke: date=seed-clock-day + Responsable=Martín shows Boulevares movement (S-8)', async ({
  page
}) => {
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/seguimiento');
  await expect(page.getByRole('heading', { name: 'Seguimiento' })).toBeVisible();

  // Apply date filter: both from and to set to the seed-clock day
  await page.locator('#activity-date-from').fill(SEED_CLOCK_DATE);
  await page.locator('#activity-date-to').fill(SEED_CLOCK_DATE);

  // Apply Responsable = Martín
  await page.getByRole('combobox', { name: /Responsable/i }).click();
  await page.getByRole('option', { name: /Martín/i }).click();

  // Wait for feed to reload
  await page.waitForTimeout(600);

  // Assert: the manager-authored movement on Boulevares is visible in the feed
  // The feed shows property titles alongside movements
  await expect(page.getByText(BOULEVARES_PROPERTY_TITLE).first()).toBeVisible({ timeout: 10_000 });

  // Assert: no items from properties assigned only to Sofía or Lucía appear
  // (Casa con jardín en Villa Catalina is Lucía's only, not Martín's)
  const LUCIAS_ONLY_TITLE = 'Casa con jardín en Villa Catalina';
  await expect(page.getByText(LUCIAS_ONLY_TITLE)).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Stage 26.4 — Isolation block (U-1, U-2)
//
// Audit-row trace:
//   U-1 / S-5  — B-2 (FB-1 / Coverage matrix — Seller unassigned)
//   U-2 / S-7  — B-3 (JD-2 / Coverage matrix — Owner unauthorised)
//
// ORDERING: These tests may run after T20. They are independent of each other.
// IMPORTANT: U-1 must establish active tenant context before navigating to any
//   product deep link — see signInSellerWithTenantContext in _helpers.ts.
// ---------------------------------------------------------------------------

// Isolation tenant constants (Stage 26.4 seed fixture)
const ISOLATION_MANAGER_EMAIL = 'manager.isolation@viewpro.local';
const ISOLATION_PROPERTY_TITLE = 'Propiedad isolation';

/**
 * Signs in as the isolation manager and returns the isolation engagement ID and
 * the isolation asset ID, both required for the isolation UI tests.
 * The isolation manager belongs only to the isolation tenant, so the session
 * context auto-selects it, and /api/products returns the 1 isolation engagement.
 */
async function getIsolationIds(page: Page, demoPassword: string): Promise<{
  isolationEngagementId: string;
  isolationAssetId: string;
}> {
  await page.context().clearCookies();
  await page.goto('/auth/sign-in');
  await page.evaluate(() => localStorage.clear());
  await page.getByLabel('Email').fill(ISOLATION_MANAGER_EMAIL);
  await page.getByLabel('Contraseña *', { exact: true }).fill(demoPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard');

  // Fetch the isolation engagement list (only 1 row)
  const isolationProducts = await getJson<ProductsResponse>(page, '/api/products?limit=10');
  expect(
    isolationProducts.total,
    'Isolation tenant must have exactly 1 engagement'
  ).toBe(1);
  const isolationEngagement = isolationProducts.items[0]!;
  const isolationEngagementId = isolationEngagement.id;

  // Fetch the isolation asset ID from the engagement detail
  const engDetail = await getJson<{ property: { id: string } }>(
    page,
    `/api/products/${isolationEngagementId}`
  );
  const isolationAssetId = engDetail.property.id;

  return { isolationEngagementId, isolationAssetId };
}

test.describe('isolation', () => {
  test.describe.configure({ mode: 'serial' });

  // U-1 / S-5 — B-2 (Seller unassigned denial, UI surface)
  // Seller navigates to an engagement in the demo tenant they are NOT assigned to.
  // Expected: the product error state renders "No se pudo cargar la propiedad."
  // and the property title is absent (no data leak).
  test('isolation: seller direct deep-link to unassigned property is denied', async ({ page }) => {
    // Step 1: sign in as manager first to fetch the unassigned product ID via API.
    // "Casa con jardín en Villa Catalina" is known to be unassigned for martin.
    const unassignedTitle = 'Casa con jardín en Villa Catalina';
    await signIn(page, DEMO_EMAIL);
    const unassignedProduct = await getProductByTitle(page, unassignedTitle);
    const unassignedEngagementId = unassignedProduct.id;

    // Step 2: sign in as martin with active tenant context established first.
    // signInSellerWithTenantContext navigates to /dashboard/product and waits for the
    // product list heading — ensuring the tenant context is resolved in localStorage before
    // any deep-link navigation. Without this step, MissingTenantState may render instead.
    await signInSellerWithTenantContext(page, 'martin.demo@viewpro.local', DEMO_PASSWORD);

    // Step 3: navigate directly to the unassigned engagement deep link.
    await page.goto(`/dashboard/product/${unassignedEngagementId}`);

    // Assertion 1: the Next.js not-found page renders.
    // When the API returns 404 with allowedErrorStatuses=[404] in the service, the BFF
    // returns the error body as data. product-view-page.tsx detects !isPropertyEngagement(product)
    // and calls notFound() → src/app/not-found.tsx renders.
    // Design MUI-1 resolution: reuse notFound() → existing src/app/not-found.tsx.
    await expect(
      page.getByText("Something's missing").first()
    ).toBeVisible({ timeout: 15_000 });

    // Assertion 2: the property title does NOT appear (no data leak).
    await expect(page.getByText(unassignedTitle)).toHaveCount(0);
  });

  // U-2 / S-7 — B-3 (Owner unauthorised access, UI surface)
  // Owner navigates to an asset in the isolation tenant they do NOT own.
  // Expected: OwnerDetailState renders "No pudimos cargar esta propiedad."
  // and the isolation property title is absent (no data leak).
  test('isolation: owner direct deep-link to unowned property is denied', async ({ page }) => {
    // Fetch isolation IDs as the isolation manager first, then switch to demo owner
    const { isolationAssetId } = await getIsolationIds(page, DEMO_PASSWORD);

    // Sign in as the demo owner
    await signIn(page, OWNER_EMAIL, '/owner');
    await expect(page.getByRole('heading', { name: 'Tus propiedades' })).toBeVisible();

    // Navigate directly to the isolation asset deep link
    await page.goto(`/owner/properties/${isolationAssetId}`);

    // Assertion 1: OwnerDetailState renders the empty/error block
    // (owner-property-detail.tsx:54-61 renders this when propertyQuery.isError)
    await expect(
      page.getByText('No pudimos cargar esta propiedad').first()
    ).toBeVisible({ timeout: 10_000 });

    // Assertion 2: the isolation property title does NOT appear (no data leak)
    await expect(page.getByText(ISOLATION_PROPERTY_TITLE)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Stage 20.9 — Seguimiento document activity proof (S-15, S-16)
//
// Pre-conditions:
//   - Seed has APPROVED doc request on Villa Centenario (T-23, FR-10).
//   - Seed has CANCELLED doc request on Villa Centenario (T-24, D1).
//   - Manager is signed in at /dashboard/seguimiento.
//
// T-28 (S-15): asserts a doc card renders with the 'Solicitud documental' header
//   badge, at least one lifecycle status label, and a valid 'Ver propiedad' link.
// T-29 (S-16): asserts the 'Documentos' pill scopes the feed to doc cards only
//   and that movement-only text ('Ingresó una consulta calificada') is absent.
// ---------------------------------------------------------------------------

test.describe('Seguimiento document activity (Stage 20.9)', () => {
  test.describe.configure({ mode: 'serial' });

  // T-28 — S-15 (FR-12): doc card renders with stable structure.
  test('seeded smoke: doc card renders with stable structure (S-15)', async ({ page }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto('/dashboard/seguimiento');
    await expect(page.getByRole('heading', { name: 'Seguimiento' })).toBeVisible();

    // Apply the Documentos pill so at least one doc card appears on the first page.
    await page.getByRole('button', { name: 'Documentos' }).click();
    await page.waitForTimeout(600);

    // At least one 'Solicitud documental' badge must be visible in the feed.
    // After applying the Documentos filter all rendered cards are doc cards.
    const firstBadge = page.getByText('Solicitud documental', { exact: true }).first();
    await expect(firstBadge).toBeVisible({ timeout: 10_000 });

    // At least one lifecycle status label must be visible on the page.
    await expect(
      page.getByText(/^(Pendiente|Subida|Aprobada|Rechazada|Cancelada)$/).first()
    ).toBeVisible();

    // 'Ver propiedad' link must be present and point to /dashboard/product/<engagementId>.
    const verPropiedadLink = page.getByRole('link', { name: /Ver propiedad/ }).first();
    await expect(verPropiedadLink).toBeVisible();
    const href = await verPropiedadLink.getAttribute('href');
    expect(href).toMatch(/^\/dashboard\/product\/[a-f0-9-]+$/);
  });

  // T-29 — S-16 (FR-13): Documentos pill scopes feed to doc cards only.
  test('seeded smoke: Documentos filter shows only doc cards (S-16)', async ({ page }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto('/dashboard/seguimiento');
    await expect(page.getByRole('heading', { name: 'Seguimiento' })).toBeVisible();

    await page.getByRole('button', { name: 'Documentos' }).click();
    await page.waitForTimeout(600);

    // All visible cards must carry the doc-card header badge — count must be > 0.
    const allHeaderBadges = page.getByText('Solicitud documental', { exact: true });
    const docBadgeCount = await allHeaderBadges.count();
    expect(docBadgeCount).toBeGreaterThan(0);

    // No movement-only card text should be visible after the docs-only filter.
    // 'Ingresó una consulta calificada' is a movement-only string seeded by the demo
    // and is never rendered by doc cards (see spec FR-13, design risk 5).
    await expect(page.getByText('Ingresó una consulta calificada')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Stage 23.3 — Tenant WhatsApp contact configuration (S-12)
//
// Pre-conditions:
//   - seed-demo.mjs seeds Tenant.whatsappPhone = VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE ?? '+5493510000000'.
//   - demo@viewpro.local is PRINCIPAL_MANAGER with TENANT_MANAGE_SETTINGS.
//
// S-12: PRINCIPAL_MANAGER edits the tenant WhatsApp phone, verifies DB persistence
//       via page reload, then restores the original seeded value for idempotency.
// ---------------------------------------------------------------------------

const SEEDED_WHATSAPP_PHONE = '+5493510000000';
const TEST_WHATSAPP_PHONE = '+5491166554433';

test.describe('Stage 23.3 — tenant WhatsApp contact', () => {
  test.describe.configure({ mode: 'serial' });

  test('S-12: PRINCIPAL_MANAGER can edit the tenant WhatsApp phone and the change persists across reload', async ({
    page
  }) => {
    await signIn(page, DEMO_EMAIL);

    // Navigate directly to the tenant contact settings page.
    await page.goto('/dashboard/settings/tenant-contact');

    // Assert the page heading is visible (confirms permission gate passed and page rendered).
    await expect(
      page.getByText('Contacto WhatsApp del workspace')
    ).toBeVisible({ timeout: 10_000 });

    // Locate the phone input by role+label anchor (D9 convention).
    const phoneInput = page.getByRole('textbox', { name: /Teléfono WhatsApp del equipo/i });
    await expect(phoneInput).toBeVisible({ timeout: 10_000 });

    // Change the value to the test phone.
    await phoneInput.clear();
    await phoneInput.fill(TEST_WHATSAPP_PHONE);

    // Submit via the "Guardar" button.
    await page.getByRole('button', { name: /Guardar/i }).click();

    // Wait for the success toast.
    await expect(page.getByText('Teléfono actualizado')).toBeVisible({ timeout: 10_000 });

    // Reload the page to prove DB persistence and React Query invalidation.
    await page.reload();
    await expect(
      page.getByText('Contacto WhatsApp del workspace')
    ).toBeVisible({ timeout: 10_000 });

    const phoneInputAfterReload = page.getByRole('textbox', { name: /Teléfono WhatsApp del equipo/i });
    await expect(phoneInputAfterReload).toBeVisible({ timeout: 10_000 });
    await expect(phoneInputAfterReload).toHaveValue(TEST_WHATSAPP_PHONE);

    // Idempotency restore: set the phone back to the seeded default.
    await phoneInputAfterReload.clear();
    await phoneInputAfterReload.fill(SEEDED_WHATSAPP_PHONE);
    await page.getByRole('button', { name: /Guardar/i }).click();
    await expect(page.getByText('Teléfono actualizado')).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Stage 23.5 — S-10: Owner timeline resolves contact to assigned seller
//
// Pre-conditions:
//   - sofia.demo has whatsappPhone = '+5493512222222' (seeded by Phase 5).
//   - sofia.demo is the assigned agent for the Villa Centenario engagement (index 0, 0 % 3 = 0).
//   - After Phase 2, mapAssignedSellerWhatsappContact resolves the CTA from the engagement's
//     agents[] instead of the movement creator's phone.
//
// S-10: Owner sees the assigned seller phone on a movement card (not 'Contacto no configurado').
//   The CTA renders as a link (<a href="https://wa.me/...">) when the contact is resolved.
//   No click, no analytics assertion (23.4 boundary).
// ---------------------------------------------------------------------------

test.describe('Stage 23.5 — owner timeline resolves contact to assigned seller', () => {
  test.describe.configure({ mode: 'serial' });

  test('S-10: owner sees assigned seller phone on a movement card (not Contacto no configurado)', async ({
    page
  }) => {
    // Sign in as the demo owner.
    await signIn(page, OWNER_EMAIL, '/owner');
    await expect(page.getByRole('heading', { name: 'Tus propiedades' })).toBeVisible();

    // Locate the Villa Centenario property (assigned to sofia.demo, index 0).
    const ownerProperties = await getJson<OwnerPropertiesResponse>(page, '/api/owner/properties');
    const villaProperty = ownerProperties.find(
      (property) => property.title === OWNER_VISIBLE_PROPERTY_TITLE
    );
    expect(villaProperty, `Expected '${OWNER_VISIBLE_PROPERTY_TITLE}' in owner properties`).toBeTruthy();

    // Navigate to the property detail page.
    await page.goto(`/owner/properties/${villaProperty!.id}`);
    await expect(page).toHaveURL(/\/owner\/properties\/[a-f0-9-]+$/i);
    await expect(page.getByRole('heading', { name: OWNER_VISIBLE_PROPERTY_TITLE })).toBeVisible();

    // Open the Seguimiento (timeline) tab.
    await page.getByRole('tab', { name: 'Seguimiento' }).click();
    await expect(page.getByText('Estado de la gestión')).toBeVisible({ timeout: 10_000 });

    // Find a movement card whose CTA is a link (contact resolved) with 'Consultar responsable' label.
    // When the assigned seller has a valid phone, owner-timeline.tsx renders:
    //   <Button asChild><a href="https://wa.me/...">{displayLabel}</a></Button>
    // Using role=link because the Button with asChild renders as an anchor element.
    const resolvedContactLink = page.getByRole('link', { name: 'Consultar responsable' }).first();
    await expect(resolvedContactLink).toBeVisible({ timeout: 10_000 });

    // Assert the CTA label is NOT the unavailable fallback.
    const linkText = await resolvedContactLink.innerText();
    expect(linkText).not.toBe('Contacto no configurado');

    // Assert href points to sofia.demo's wa.me URL containing her digits (5493512222222).
    const href = await resolvedContactLink.getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/\d{8,}\?text=/);
    expect(href).toContain('5493512222222');
  });

  // S-9 — movement-level click tracking smoke.
  // Mirrors T19b at demo-smoke.spec.ts:990 (D4).
  // Auth: re-authenticate as owner (serial mode shares the browser context but session may not
  //        survive across tests — signing in mirrors T19b which also calls signIn explicitly).
  // Navigation: navigate to the property timeline fresh to avoid depending on S-10 page state.
  test('S-9: clicking Consultar responsable on a movement card POSTs to the tracking endpoint', async ({
    page
  }) => {
    // Sign in as the demo owner (mirrors T19b pattern; serial mode does not guarantee session).
    await signIn(page, OWNER_EMAIL, '/owner');
    await expect(page.getByRole('heading', { name: 'Tus propiedades' })).toBeVisible();

    // Locate the Villa Centenario property.
    const ownerProperties = await getJson<{ id: string; title: string }[]>(
      page,
      '/api/owner/properties'
    );
    const villaProperty = ownerProperties.find(
      (property) => property.title === OWNER_VISIBLE_PROPERTY_TITLE
    );
    expect(villaProperty, `Expected '${OWNER_VISIBLE_PROPERTY_TITLE}' in owner properties`).toBeTruthy();

    // Navigate to the property detail page.
    await page.goto(`/owner/properties/${villaProperty!.id}`);
    await expect(page).toHaveURL(/\/owner\/properties\/[a-f0-9-]+$/i);

    // Open the Seguimiento (timeline) tab.
    await page.getByRole('tab', { name: 'Seguimiento' }).click();
    await expect(page.getByText('Estado de la gestión')).toBeVisible({ timeout: 10_000 });

    // Register the route intercept BEFORE clicking (mirrors T19b sequencing + handler).
    let trackingHits = 0;
    await page.route('**/api/owner/engagements/*/movements/*/whatsapp-contact-click', (route) => {
      trackingHits += 1;
      return route.continue();
    });

    // Locate the movement contact link.
    const resolvedContactLink = page.getByRole('link', { name: 'Consultar responsable' }).first();
    await expect(resolvedContactLink).toBeVisible({ timeout: 10_000 });

    // Click with Meta modifier to avoid navigation; absorb new-tab popup (mirrors T19b).
    const popupPromise = page.waitForEvent('popup', { timeout: 5_000 }).catch(() => null);
    await resolvedContactLink.click({ modifiers: ['Meta'] });
    const popup = await popupPromise;
    await popup?.close();

    // Settle window for the tracking POST to complete.
    await page.waitForTimeout(500);

    // Assert: movement tracking endpoint was hit at least once.
    expect(trackingHits).toBeGreaterThanOrEqual(1);
  });
});
