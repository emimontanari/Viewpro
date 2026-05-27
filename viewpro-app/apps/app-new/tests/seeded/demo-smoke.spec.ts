import { expect, test, type Page } from '@playwright/test';

const DEMO_EMAIL = 'demo@viewpro.local';
const DEMO_PASSWORD = process.env.VIEWPRO_DEMO_PASSWORD ?? 'viewpro-demo-local';
const DEMO_TENANT_NAME = 'ViewPro Demo Inmobiliaria';
const VISIBLE_DEMO_PROPERTY_TITLE = 'Casa compacta en Funes';
const OWNER_EMAIL = 'propietario.demo@viewpro.local';
const OWNER_VISIBLE_PROPERTY_TITLE = 'Casa familiar con pileta en Villa Centenario';
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
  });
}

test('demo owner can read the owner portal follow-up', async ({ page }) => {
  await signIn(page, OWNER_EMAIL, '/owner');

  await expect(page.getByRole('heading', { name: 'Tus propiedades' })).toBeVisible();
  await expect(page.getByText('Inmobiliaria vinculada')).toBeVisible();
  await expect(page.getByText(DEMO_TENANT_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText(OWNER_VISIBLE_PROPERTY_TITLE)).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver seguimiento/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nueva propiedad' })).toHaveCount(0);

  await page
    .getByRole('link', { name: /Ver seguimiento/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/owner\/properties\/[a-f0-9-]+$/i);
  await expect(page.getByRole('heading', { name: OWNER_VISIBLE_PROPERTY_TITLE })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Seguimiento' })).toBeVisible();
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

  return (await response.json()) as {
    items: Array<{
      agents: Array<{ email: string }>;
      property: { title: string };
    }>;
    total: number;
  };
}
