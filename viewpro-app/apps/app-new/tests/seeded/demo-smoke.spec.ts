import { expect, test, type Locator, type Page } from '@playwright/test';

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

  await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
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
  expect(ownerTimeline.items.some((item) => item.contact.whatsappPhone === '+5493511111111')).toBe(
    true
  );
  expect(ownerTimeline.items.some((item) => !item.contact.available)).toBe(true);
});

test('viewpro admin can inspect seeded tenant limits', async ({ page }) => {
  await signIn(page, DEMO_ADMIN_EMAIL, '/owner');
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Admin ViewPro' })).toBeVisible();
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

  await page.getByRole('tab', { name: /Resueltos\s*·\s*2/i }).click();
  await page.getByRole('button', { name: /Historial\s*2 resueltas/i }).click();
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
  await expect(page.getByRole('link', { name: 'Abrir propiedad' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver seguimiento/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nueva propiedad' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Abrir propiedad' }).first().click();
  await expect(page).toHaveURL(/\/owner\/properties\/[a-f0-9-]+$/i);
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
  await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`**${redirectPath}`);
}

async function getAssignedProducts(page: Page) {
  const response = await page.request.get('/api/products?limit=50');

  expect(response.ok()).toBe(true);

  return (await response.json()) as ProductsResponse;
}

async function getJson<TResponse>(page: Page, url: string) {
  const response = await page.request.get(url);

  expect(response.ok(), `${url} should return OK`).toBe(true);

  return (await response.json()) as TResponse;
}

async function getProductByTitle(page: Page, title: string) {
  const products = await getAssignedProducts(page);
  const product = products.items.find((item) => item.property.title === title);

  expect(product, `Expected seeded property “${title}” to exist`).toBeTruthy();

  return product!;
}

type ProductsResponse = {
  items: Array<{
    id: string;
    agents: Array<{ email: string }>;
    property: { title: string };
  }>;
  total: number;
};

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
    slug: string;
    status: string;
    limits: {
      maxUsers: number | null;
      maxActivePropertyEngagements: number | null;
      maxDocumentsStorageMb: number | null;
    };
  }>;
};
