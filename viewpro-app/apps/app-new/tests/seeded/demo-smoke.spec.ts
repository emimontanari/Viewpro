import { expect, test, type Locator, type Page } from '@playwright/test';

const DEMO_EMAIL = 'demo@viewpro.local';
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
    expectedTotal: 7,
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
  await page.goto(`/auth/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`);
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
}>;
