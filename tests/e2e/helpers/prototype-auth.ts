import { expect, type Page } from '@playwright/test'

export async function prototypeLogin(page: Page, destination = '/') {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`)
  await completePrototypeLogin(page)
}

export async function completePrototypeLogin(page: Page) {
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill('operador demo')
  await page.getByLabel('Contraseña', { exact: true }).fill('!')
  await page.getByRole('button', { name: 'Continuar a MFA' }).click()
  await expect(page.getByRole('heading', { name: 'Confirmar MFA simulado' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Código MFA simulado', exact: true }).fill('texto')
  await page.getByRole('button', { name: 'Confirmar acceso simulado' }).click()
  await expect(page).not.toHaveURL(/\/(?:login|mfa)(?:\?|$)/)
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
}
