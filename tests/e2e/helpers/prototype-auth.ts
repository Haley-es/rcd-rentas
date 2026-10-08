import { expect, type Page } from '@playwright/test'

export async function prototypeLogin(page: Page, destination = '/', credentials?: { username: string; password: string; mfaCode?: string }) {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`)
  await completePrototypeLogin(page, credentials)
}

export async function completePrototypeLogin(page: Page, credentials: { username: string; password: string; mfaCode?: string } = { username: 'operador demo', password: '!' }) {
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill(credentials.username)
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Continuar a MFA' }).click()
  await expect(page.getByRole('heading', { name: 'Confirmar MFA simulado' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Código MFA simulado', exact: true }).fill(credentials.mfaCode ?? 'texto')
  await page.getByRole('button', { name: 'Confirmar acceso simulado' }).click()
  await expect(page).not.toHaveURL(/\/(?:login|mfa)(?:\?|$)/)
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
}
