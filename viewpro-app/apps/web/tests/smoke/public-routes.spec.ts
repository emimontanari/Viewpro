import { expect, test } from '@playwright/test'

test.describe('public route smoke coverage', () => {
  test('home links visitors to the public entry routes', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /tus propietarios ven el avance/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login')
    await expect(page.getByRole('link', { name: 'Crear agencia' })).toHaveAttribute('href', '/register')
  })

  test('login exposes the unauthenticated sign-in form', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Ingresar a ViewPro' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Contraseña')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  })

  test('register exposes the agency creation form', async ({ page }) => {
    await page.goto('/register')

    await expect(page.getByRole('heading', { name: 'Crear inmobiliaria' })).toBeVisible()
    await expect(page.getByLabel('Nombre de la inmobiliaria')).toBeVisible()
    await expect(page.getByLabel('Email laboral')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear inmobiliaria' })).toBeVisible()
  })
})
