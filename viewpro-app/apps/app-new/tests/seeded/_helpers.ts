/**
 * Shared helpers for the seeded Playwright smoke suite.
 *
 * Extracted in Stage 26.3 commit A. Rules:
 *   - Only extract functions with ≥ 3 callers across the suite.
 *   - signIn, openOwnerPropertyDetail, and openAndVerifySignedReadUrl stay inline in demo-smoke.spec.ts.
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
