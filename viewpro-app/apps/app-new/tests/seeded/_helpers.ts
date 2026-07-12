/**
 * Shared helpers for the seeded Playwright smoke suite.
 *
 * Extracted in Stage 26.3 commit A. Rules:
 *   - Only extract functions with ≥ 3 callers across the suite.
 *   - signIn, openOwnerPropertyDetail, and openAndVerifySignedReadUrl stay inline in demo-smoke.spec.ts.
 *
 * Stage 26.4 additions:
 *   - signInSellerWithTenantContext: signs in a seller and waits for the active tenant to be set.
 *     IMPORTANT: must establish active tenant context (demo tenant) before navigating to any
 *     product deep link; without it, MissingTenantState renders instead of the denial surface.
 */

import { expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types (shared across the suite)
// ---------------------------------------------------------------------------

export type ProductsResponse = {
  items: Array<{
    id: string;
    agents: Array<{ email: string }>;
    property: { title: string };
  }>;
  total: number;
};

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a URL using the browser request context and returns the parsed JSON.
 * Asserts that the response is OK before parsing.
 */
export async function getJson<T>(page: Page, url: string): Promise<T> {
  const response = await page.request.get(url);
  expect(response.ok(), `${url} should return OK`).toBe(true);
  return (await response.json()) as T;
}

/**
 * Returns the list of property engagements visible to the currently signed-in user.
 * Uses the /api/products?limit=50 endpoint.
 */
export async function getAssignedProducts(page: Page): Promise<ProductsResponse> {
  const response = await page.request.get('/api/products?limit=50');
  expect(response.ok()).toBe(true);
  return (await response.json()) as ProductsResponse;
}

/**
 * Finds a property engagement by exact title from the currently signed-in user's product list.
 * Fails the test if the product is not found.
 */
export async function getProductByTitle(
  page: Page,
  title: string
): Promise<ProductsResponse['items'][number]> {
  const products = await getAssignedProducts(page);
  const product = products.items.find((item) => item.property.title === title);
  expect(product, `Expected seeded property "${title}" to exist`).toBeTruthy();
  return product!;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigates to the property list page and opens the detail page for a property
 * identified by exact title, using the kebab-menu "Ver detalle" action.
 * Assumes the user is already signed in as a manager.
 */
export async function openManagerPropertyDetail(page: Page, title: string): Promise<void> {
  await page.goto('/dashboard/product');
  await expect(page.getByRole('heading', { name: 'Propiedades' }).first()).toBeVisible();

  const propertyRow = page.getByRole('row').filter({ hasText: title }).first();
  await propertyRow.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('menuitem', { name: /Ver detalle/i }).click();

  await expect(page).toHaveURL(/\/dashboard\/product\/[a-f0-9-]+$/i);
  await expect(page.getByText('Detalle de propiedad')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that at least one visible item in the Seguimiento feed matches the given regex.
 * Looks inside elements that hold the feed items (li or article with text).
 */
export async function assertFeedContains(page: Page, regex: RegExp): Promise<void> {
  await expect(page.locator('[data-testid="movement-feed"], ul, ol').getByText(regex).first()).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Stage 26.4 — Isolation block helpers
// ---------------------------------------------------------------------------

/**
 * Signs in a seller and ensures the demo tenant is the active context before
 * navigating to any product deep link.
 *
 * IMPORTANT: must select the active tenant (demo tenant) before navigating to
 * any product deep link, otherwise MissingTenantState renders instead of the
 * 404/denial surface.
 *
 * Strategy: sign in with redirect to /dashboard, which triggers the session
 * context auto-select of `memberships[0]` (the only/primary demo tenant).
 * Wait for the products heading to confirm the tenant context is resolved
 * before any deep-link navigation.
 *
 * @param page - Playwright Page instance
 * @param email - Seller email (e.g. 'martin.demo@viewpro.local')
 * @param demoPassword - Demo password string
 */
export async function signInSellerWithTenantContext(
  page: Page,
  email: string,
  demoPassword: string
): Promise<void> {
  await page.context().clearCookies();
  await page.goto(`/auth/sign-in?redirect_url=${encodeURIComponent('/dashboard/product')}`);
  await page.evaluate(() => localStorage.clear());
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(demoPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Wait for the product list to render — confirms the active tenant context is set.
  // Without this, a deep-link navigation to /dashboard/product/:id may render
  // MissingTenantState before the session context hydrates.
  await page.waitForURL('**/dashboard/product');
  await expect(page.getByRole('heading', { name: 'Propiedades' }).first()).toBeVisible({
    timeout: 15_000
  });
}
