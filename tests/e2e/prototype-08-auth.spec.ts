import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { completePrototypeLogin, prototypeLogin } from './helpers/prototype-auth'
import { loginPrototypeAPI, resetPrototypeDemo } from './helpers/prototype-state'

const origin = 'http://127.0.0.1:3011'
const sessionCookie = 'rcd-prototype-session'
const challengeCookie = 'rcd-prototype-challenge'
const protectedApi = '/api/prototype/state'
const mutationApi = '/api/prototype/commands'

test.beforeEach(async ({ request }) => {
  await loginPrototypeAPI(request, origin)
  await resetPrototypeDemo(request, origin)
})

async function ready(page: Page) {
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
}
async function begin(request: APIRequestContext, base = origin, username = 'x') {
  const response = await request.post(`${base}/api/auth/login`, {
    headers: { Origin: base }, data: { username, password: '!' },
  })
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ next: '/mfa' })
}
async function verify(request: APIRequestContext, base = origin) {
  return request.post(`${base}/api/auth/mfa`, { headers: { Origin: base }, data: { code: 'texto' } })
}

test('P08-CA01 todas las superficies bloqueadas, SSR y API sin datos', async ({ page, context }) => {
  for (const path of [
    '/', '/expedientes', '/expedientes/DEMO-R08', '/campanas', '/tareas',
    '/portal/DEMO-R01?token=demo-DEMO-R01',
  ]) {
    const response = await context.request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    expect(response.headers().location).toMatch(/^\/login\?returnTo=/)
    const html = await response.text()
    expect(html).not.toContain('Clara Martínez')
    expect(html).not.toContain('Coincidencia ficticia')
    const navigation = await page.goto(path)
    await expect(page).toHaveURL(/\/login\?returnTo=/)
    const payload = await navigation!.text()
    expect(payload).not.toContain('Clara Martínez')
    expect(payload).not.toContain('Coincidencia ficticia')
    expect(await page.locator('body').innerText()).not.toContain('Clara Martínez')
  }
  const response = await context.request.get(protectedApi)
  expect(response.status()).toBe(401)
  expect(response.headers()['content-type']).toContain('application/json')
  expect((await response.json()).data.code).toBe('AUTH_REQUIRED')
})

test('P08-CA02 campos vacíos rechazados y x/!/texto aceptados', async ({ page, context }) => {
  await page.goto('/login')
  await ready(page)
  for (const [username, password] of [['', '!'], ['   ', '!'], ['x', ''], ['x', '   ']]) {
    await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill(username!)
    await page.getByLabel('Contraseña', { exact: true }).fill(password!)
    await page.getByRole('button', { name: 'Continuar a MFA' }).click()
    await expect(page.getByRole('alert')).toContainText('no vacío')
    await expect(page).toHaveURL(/\/login$/)
    expect((await context.cookies()).filter(cookie => [sessionCookie, challengeCookie].includes(cookie.name))).toEqual([])
  }
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill(' x ')
  await page.getByLabel('Contraseña', { exact: true }).fill('!')
  await page.getByRole('button', { name: 'Continuar a MFA' }).click()
  await expect(page).toHaveURL(/\/mfa/)
  for (const code of ['', '   ']) {
    await page.getByRole('textbox', { name: 'Código MFA simulado' }).fill(code)
    await page.getByRole('button', { name: 'Confirmar acceso simulado' }).click()
    await expect(page.getByRole('alert')).toContainText('no vacío')
    await expect(page).toHaveURL(/\/mfa/)
    expect((await context.cookies()).find(cookie => cookie.name === sessionCookie)).toBeUndefined()
  }
  await page.getByRole('textbox', { name: 'Código MFA simulado' }).fill('texto')
  await page.getByRole('button', { name: 'Confirmar acceso simulado' }).click()
  await expect(page.getByRole('heading', { name: 'Vista general.' })).toBeVisible()
  const response = await context.request.get('/api/auth/session')
  expect(response.headers()['cache-control']).toBe('no-store')
  const dto = await response.json()
  expect(dto).toEqual({ authenticated: true, user: { username: 'x', accessRole: 'Empleado' }, expiresAt: expect.any(String) })
  expect(new Date(dto.expiresAt).toISOString()).toBe(dto.expiresAt)
})

test('P08-CA03 desafío pendiente no concede acceso; ausente y consumido fallan', async ({ page, context, playwright }) => {
  await page.goto('/mfa')
  await ready(page)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('alert')).toContainText('Desafío MFA')
  expect((await verify(context.request)).status()).toBe(401)
  await begin(context.request)
  const cookies = await context.cookies()
  const challenge = cookies.find(cookie => cookie.name === challengeCookie)!
  expect(challenge.value).toMatch(/^[a-f0-9]{64}$/)
  expect(challenge.httpOnly).toBe(true)
  expect(challenge.sameSite).toBe('Lax')
  expect(challenge.path).toBe('/')
  expect(challenge.secure).toBe(false)
  expect(cookies.find(cookie => cookie.name === sessionCookie)).toBeUndefined()
  expect(await (await context.request.get('/api/auth/session')).json()).toEqual({ authenticated: false, pendingMfa: true })
  await page.goto('/expedientes/DEMO-R08')
  await expect(page).toHaveURL(/\/login/)
  expect((await context.request.get(protectedApi)).status()).toBe(401)
  expect((await verify(context.request)).status()).toBe(200)
  expect((await context.cookies()).find(cookie => cookie.name === challengeCookie)).toBeUndefined()
  expect((await context.cookies()).find(cookie => cookie.name === sessionCookie)!.value).not.toBe(challenge.value)
  const reused = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: `${challengeCookie}=${challenge.value}` } })
  try {
    const response = await verify(reused)
    expect(response.status()).toBe(401)
    expect((await response.json()).data.code).toBe('MFA_CHALLENGE_INVALID')
  } finally { await reused.dispose() }
})

test('P08-CA04 cookie opaca HttpOnly, recarga y pestaña sin almacenamiento web', async ({ page, context }) => {
  const started = Date.now() / 1000
  await prototypeLogin(page)
  const cookie = (await context.cookies()).find(entry => entry.name === sessionCookie)!
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', secure: false, domain: '127.0.0.1' })
  expect(cookie.value).toMatch(/^[a-f0-9]{64}$/)
  expect(cookie.expires).toBeGreaterThan(started + 28_795)
  expect(cookie.expires).toBeLessThan(started + 28_815)
  const state = await page.evaluate(() => ({
    cookies: document.cookie, local: { ...localStorage }, session: { ...sessionStorage },
  }))
  expect(state.cookies).not.toContain(sessionCookie)
  expect(state.cookies).not.toContain(challengeCookie)
  expect(state.local).toEqual({})
  expect(state.session).toEqual({})
  const first = await (await context.request.get('/api/auth/session')).json()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Vista general.' })).toBeVisible()
  const other = await context.newPage()
  await other.goto('/expedientes')
  await expect(other.getByRole('heading', { name: 'Expedientes.' })).toBeVisible()
  expect((await (await context.request.get('/api/auth/session')).json()).expiresAt).toBe(first.expiresAt)
})

test('P08-CA05 portal conserva token, proyecta un caso y rechaza destinos inseguros', async ({ page, context }) => {
  const destination = '/portal/DEMO-R08?token=demo-DEMO-R08'
  await page.goto(destination)
  await expect(page).toHaveURL(/\/login\?returnTo=/)
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(destination)
  await completePrototypeLogin(page)
  await expect(page).toHaveURL(`${origin}${destination}`)
  await expect(page.getByRole('heading', { name: /Daniel Pérez/ })).toBeVisible()
  const html = await (await context.request.get(destination)).text()
  expect(html).not.toContain('Clara Martínez')
  expect(html).not.toContain('Coincidencia ficticia')
  expect(html).not.toContain('DEMO-R06')
  for (const destination of ['https://example.test', '//example.test', '/\\example.test', '/login', '/mfa', '/%5cexample.test']) {
    await context.request.post('/api/auth/logout', { headers: { Origin: origin }, data: {} })
    await prototypeLogin(page, destination)
    await expect(page).toHaveURL(`${origin}/`)
  }
  await page.goto('/portal/DEMO-R01?token=expirado')
  await expect(page.getByRole('alert')).toContainText('Enlace inválido o expirado')
  expect(await page.locator('body').innerText()).not.toContain('Clara Martínez')
})

for (const [surface, destination] of [
  ['gestión', '/expedientes/DEMO-R01'],
  ['portal', '/portal/DEMO-R01?token=demo-DEMO-R01'],
]) {
  test(`P08-CA06 logout desde ${surface} revoca cookie, limpia datos y bloquea atrás`, async ({ page, context, playwright }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await prototypeLogin(page, destination)
    await expect(page.getByText('Clara Martínez').first()).toBeVisible()
    const previous = (await context.cookies()).find(cookie => cookie.name === sessionCookie)!.value
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await expect(page).toHaveURL(`${origin}/login`)
    await ready(page)
    expect(await page.locator('body').innerText()).not.toContain('Clara Martínez')
    expect((await context.cookies()).filter(cookie => [sessionCookie, challengeCookie].includes(cookie.name))).toEqual([])
    const reused = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: `${sessionCookie}=${previous}` } })
    try {
      expect((await reused.get(protectedApi)).status()).toBe(401)
      expect((await reused.post(protectedApi, { headers: { Origin: origin }, data: {} })).status()).toBe(401)
    } finally { await reused.dispose() }
    await page.goBack()
    await expect(page).toHaveURL(/\/login/)
    await page.reload()
    await ready(page)
    expect(await page.locator('body').innerText()).not.toContain('Clara Martínez')
    expect((await context.request.post('/api/auth/logout', { headers: { Origin: origin }, data: {} })).status()).toBe(200)
    expect(errors).toEqual([])
  })
}

test('P08-CA07 servidor aislado: caducidad real, 401 y limpieza de estado cliente', async ({ browser, playwright }) => {
  test.setTimeout(120_000)
  const base = 'http://127.0.0.1:3012'
  const child = spawn(process.execPath, [
    resolve('node_modules', 'nuxt', 'bin', 'nuxt.mjs'), 'dev',
    resolve('tests', 'e2e', 'fixtures', 'auth'), '--host', '127.0.0.1', '--port', '3012', '--no-fork',
  ], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  child.stdout.on('data', chunk => { logs = `${logs}${chunk}`.slice(-12_000) })
  child.stderr.on('data', chunk => { logs = `${logs}${chunk}`.slice(-12_000) })
  const api = await playwright.request.newContext({ baseURL: base })
  const context = await browser.newContext({ baseURL: base })
  try {
    const deadline = Date.now() + 90_000
    let alive = false
    while (Date.now() < deadline && child.exitCode === null) {
      try {
        alive = (await api.get('/api/auth/session', { timeout: 1500 })).ok()
      } catch { /* El puerto todavía no escucha durante el arranque. */ }
      if (alive) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    expect(alive, logs).toBe(true)
    expect(child.pid).toBeGreaterThan(0)
    await begin(api, base)
    const challenge = (await api.storageState()).cookies.find(cookie => cookie.name === challengeCookie)!
    const challengeHeaders = { Cookie: `${challengeCookie}=${challenge.value}` }
    expect((await (await api.get('/api/auth/session', { headers: challengeHeaders })).json()).pendingMfa).toBe(true)
    await expect.poll(async () => (await (await api.get('/api/auth/session', { headers: challengeHeaders })).json()).pendingMfa).toBe(false)
    expect((await api.post('/api/auth/mfa', { headers: { ...challengeHeaders, Origin: base }, data: { code: 'texto' } })).status()).toBe(401)
    await begin(api, base)
    const session = await verify(api, base)
    expect(session.status()).toBe(200)
    const authenticated = await session.json()
    const cookie = (await api.storageState()).cookies.find(cookie => cookie.name === sessionCookie)!
    const sessionHeaders = { Cookie: `${sessionCookie}=${cookie.value}` }
    const snapshot = await api.get(protectedApi)
    expect(snapshot.status()).toBe(200)
    const state = await snapshot.json()
    expect(state.cases).toHaveLength(18)
    const envelope = { datasetId: state.datasetId, expectedRevision: state.revision,
      command: { type: 'set-settings', teams: !state.teams } }
    for (const headers of [{}, { Origin: 'http://example.test' }]) {
      expect((await api.post(mutationApi, { headers, data: envelope })).status()).toBe(403)
    }
    expect(await (await api.get(protectedApi)).json()).toEqual(state)
    expect((await api.post(mutationApi, { headers: { Origin: base }, data: envelope })).status()).toBe(200)
    await expect.poll(async () => (await api.get(protectedApi, { headers: sessionHeaders })).status(), { timeout: 6000 }).toBe(401)
    expect((await api.post(mutationApi, { headers: { ...sessionHeaders, Origin: base }, data: envelope })).status()).toBe(401)
    expect(Date.now()).toBeGreaterThanOrEqual(Date.parse(authenticated.expiresAt))
    const page = await context.newPage()
    await prototypeLogin(page, '/expedientes/DEMO-R01')
    await expect(page.getByRole('heading', { name: 'Clara Martínez' })).toBeVisible()
    await expect(page).toHaveURL(/\/login/, { timeout: 6000 })
    await expect(page.getByRole('alert')).toContainText('caducada')
    expect(await page.locator('body').innerText()).not.toContain('Clara Martínez')
    await prototypeLogin(page, '/auth-expiry')
    await expect(page.getByText('Clara Martínez', { exact: true })).toBeVisible()
    const abandoned = page.waitForEvent('requestfailed', { predicate: request => request.url().endsWith('/api/prototype/slow') })
    const slow = page.waitForRequest('**/api/prototype/slow')
    await page.getByRole('button', { name: 'Iniciar consulta pendiente' }).click()
    await slow
    expect((await context.request.post('/api/auth/logout', { headers: { Origin: base }, data: {} })).status()).toBe(200)
    const unauthorized = page.waitForResponse(response => response.url().endsWith('/api/prototype/state') && response.status() === 401)
    await page.getByRole('button', { name: 'Consultar API protegida' }).click()
    await unauthorized
    await abandoned
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('alert')).toContainText('caducada')
    expect(await page.locator('body').innerText()).not.toContain('Clara Martínez')
  } finally {
    await context.close()
    await api.dispose()
    if (child.exitCode === null) {
      const exited = new Promise<void>(resolve => child.once('exit', () => resolve()))
      child.kill()
      await exited
    }
    const lock = resolve('node_modules', '.cache', 'prototype-auth-e2e', 'nuxt.lock')
    if (existsSync(lock) && JSON.parse(readFileSync(lock, 'utf8')).pid === child.pid) unlinkSync(lock)
  }
})

test('P08-CA08 origen obligatorio y JSON; enlaces y rol no omiten autenticación', async ({ page, context }) => {
  for (const endpoint of ['/api/auth/login', '/api/auth/mfa', '/api/auth/logout', mutationApi]) {
    for (const headers of [{}, { Origin: 'http://example.test' }, { Origin: 'null' }, { 'X-Prototype-Trusted': 'true' }]) {
      const response = await context.request.post(endpoint, { headers, data: { username: 'x', password: '!', code: 'texto' } })
      expect(response.status()).toBe(403)
      expect((await response.json()).data.code).toBe('ORIGIN_FORBIDDEN')
      expect((await context.cookies()).filter(cookie => [sessionCookie, challengeCookie].includes(cookie.name))).toEqual([])
    }
  }
  const invalidJsonType = await context.request.post('/api/auth/login', {
    headers: { Origin: origin, 'Content-Type': 'text/plain' }, data: '{"username":"x","password":"!"}',
  })
  expect(invalidJsonType.status()).toBe(400)
  expect((await invalidJsonType.json()).data.code).toBe('AUTH_INPUT_INVALID')
  await prototypeLogin(page)
  const wrongContentType = await context.request.post(mutationApi, {
    headers: { Origin: origin, 'Content-Type': 'text/plain' }, data: '{}',
  })
  expect(wrongContentType.status()).toBe(400)
  for (const endpoint of ['/api/auth/logout', '/api/auth/login']) {
    expect((await context.request.post(endpoint, {
      headers: { Origin: 'http://example.test' }, data: { username: 'otra', password: '!' },
    })).status()).toBe(403)
  }
  expect((await (await context.request.get('/api/auth/session')).json()).authenticated).toBe(true)
  await page.getByRole('combobox', { name: 'Simular rol' }).click()
  await page.getByRole('option', { name: 'Cliente', exact: true }).click()
  await expect(page).toHaveURL(/\/portal\/DEMO-R08/)
  await context.request.post('/api/auth/logout', { headers: { Origin: origin }, data: {} })
  await page.goto('/portal/DEMO-R08?token=demo-DEMO-R08')
  await expect(page).toHaveURL(/\/login/)
  expect((await context.request.get(protectedApi)).status()).toBe(401)
})

test('P08-CA09 móvil: login, MFA y portal sin desbordamiento ni errores JS', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login?returnTo=%2Fportal%2FDEMO-R08%3Ftoken%3Ddemo-DEMO-R08')
  await ready(page)
  for (const fragment of ['No producción', 'MFA simulado: cualquier valor no vacío es válido']) {
    await expect(page.getByText(fragment, { exact: false })).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill('x')
  await page.getByLabel('Contraseña', { exact: true }).fill('!')
  await page.getByRole('button', { name: 'Continuar a MFA' }).click()
  await expect(page.getByRole('heading', { name: 'Confirmar MFA simulado' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByText('No producción', { exact: false })).toBeVisible()
  await expect(page.getByText('MFA simulado: cualquier valor no vacío es válido')).toBeVisible()
  await page.getByRole('textbox', { name: 'Código MFA simulado' }).fill('texto')
  await page.getByRole('button', { name: 'Confirmar acceso simulado' }).click()
  await expect(page.getByRole('heading', { name: /Daniel Pérez/ })).toBeVisible()
  await expect(page.getByText(/No producción.*MFA simulado/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
