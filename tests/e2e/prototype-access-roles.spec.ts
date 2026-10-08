import { PrismaClient, type Prisma } from '@prisma/client'
import { readFile } from 'node:fs/promises'
import { test, expect, prototypeOrigin as origin } from './helpers/prototype-server'
import { prototypeAdmin, prototypeEmployee } from './helpers/prototype-admin'
import { completePrototypeLogin, prototypeLogin } from './helpers/prototype-auth'
import { confirmedPrototypeCommand as command, loginPrototypeAPI, resetPrototypeDemo, sendPrototypeCommand } from './helpers/prototype-state'
import { prototypeTestDatabaseURL } from '../../scripts/prototype-e2e.mjs'
import { withPrototypeHistoryAccess } from '../../server/utils/prototype-history-access'
import type { PrototypeHistorySnapshot } from '../../shared/types/prototype-history'

test.beforeEach(async ({ request }) => {
  await loginPrototypeAPI(request, origin, prototypeEmployee.username, prototypeEmployee.password)
  await resetPrototypeDemo(request, origin)
})

test('documented seed admin keeps access through demo reset and server restart', async ({ page, request, prototypeServer }) => {
  const documentation = await readFile('docs/usuarios-demo.md', 'utf8')
  for (const account of [prototypeAdmin, prototypeEmployee]) {
    for (const value of [account.username, account.password, account.mfaCode]) {
      expect(documentation).toContain(`\`${value}\``)
    }
    expect(documentation).toContain(`**${account.accessRole}**`)
  }
  await loginPrototypeAPI(request, origin, prototypeAdmin.username, prototypeAdmin.password)
  await resetPrototypeDemo(request, origin)
  expect((await (await request.get('/api/auth/session')).json()).user.accessRole).toBe('Administrador IT')
  await prototypeServer.restart()
  expect((await request.get('/api/prototype/history?trash=true')).status()).toBe(401)
  await prototypeLogin(page, '/papelera', prototypeAdmin)
  await expect(page.getByRole('heading', { name: 'Papelera.' })).toBeVisible()
  await expect(page.getByText('Administrador IT', { exact: true })).toBeVisible()
  expect((await page.request.get('/api/prototype/history?trash=true')).status()).toBe(200)
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/seed-admin-papelera.png', fullPage: true })
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill(prototypeAdmin.username)
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta')
  await page.getByRole('button', { name: 'Continuar a MFA' }).click()
  await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas.')
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.get('/api/prototype/history?trash=true')).status()).toBe(401)
})

test('employees cannot elevate through login payload, headers, business role or commands', async ({ request }) => {
  const forged = await request.post('/api/auth/login', { headers: { Origin: origin }, data: {
    username: prototypeEmployee.username, password: prototypeEmployee.password, accessRole: 'Administrador IT', role: 'Administrador IT',
  } })
  expect(forged.status()).toBe(200)
  const mfa = await request.post('/api/auth/mfa', { headers: { Origin: origin }, data: { code: 'x', accessRole: 'Administrador IT' } })
  expect((await mfa.json()).user.accessRole).toBe('Empleado')
  for (const role of ['IT', 'Socio', 'Gestor de campañas', 'Profesional'] as const) {
    await command(request, origin, { type: 'set-role', role })
    expect((await request.get('/api/auth/session')).ok()).toBe(true)
    expect((await (await request.get('/api/auth/session')).json()).user.accessRole).toBe('Empleado')
    expect((await request.get('/api/prototype/history?trash=true', { headers: { 'X-Role': 'Administrador IT' } })).status()).toBe(403)
  }
  expect((await sendPrototypeCommand(request, origin, { type: 'set-role', role: 'Administrador IT' } as never)).status()).toBe(400)
  const denied = await request.post('/api/auth/login', { headers: { Origin: origin }, data: { username: prototypeAdmin.username, password: '!' } })
  expect(denied.status()).toBe(401)
  expect((await request.get('/api/prototype/history')).status()).toBe(401)
  expect((await request.post('/api/auth/mfa', { headers: { Origin: origin }, data: { code: 'x' } })).status()).toBe(401)
  await loginPrototypeAPI(request, origin, prototypeAdmin.username, prototypeAdmin.password)
  expect((await (await request.get('/api/auth/session')).json()).user.accessRole).toBe('Administrador IT')
})

test('both seed accounts require their password and accept arbitrary MFA on localhost', async ({ page, request }) => {
  for (const account of [prototypeEmployee, prototypeAdmin]) {
    const denied = await request.post('/api/auth/login', { headers: { Origin: origin }, data: { username: account.username, password: 'incorrecta' } })
    expect(denied.status()).toBe(401)
    expect((await (await request.get('/api/auth/session')).json()).authenticated).toBe(false)
    await page.goto('http://localhost:3011/login?returnTo=/expedientes')
    await completePrototypeLogin(page, { ...account, mfaCode: 'cualquier MFA sin OTP' })
    expect(new URL(page.url()).hostname).toBe('localhost')
    expect((await (await page.request.get('http://localhost:3011/api/auth/session')).json()).user).toEqual({
      username: account.username, accessRole: account.accessRole,
    })
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login/)
  }
})

test('MFA rejects external hostnames even with forwarded localhost headers', async ({ request }) => {
  await request.post('/api/auth/login', { headers: { Origin: origin }, data: { username: prototypeEmployee.username, password: prototypeEmployee.password } })
  for (const hostname of ['demo.example.com', 'localhost.example.com', '127.0.0.1.example.com']) {
    const denied = await request.post('/api/auth/mfa', {
      headers: { Host: `${hostname}:3011`, Origin: `http://${hostname}:3011`, 'X-Forwarded-Host': 'localhost:3011', 'X-Forwarded-Proto': 'http' },
      data: { code: 'cualquier MFA' },
    })
    expect(denied.status()).toBe(403)
    expect((await denied.json()).data.code).toBe('MFA_LOCAL_ONLY')
    expect((await (await request.get('/api/auth/session')).json()).authenticated).toBe(false)
  }
  const accepted = await request.post('/api/auth/mfa', { headers: { Origin: origin }, data: { code: 'sin formato obligatorio' } })
  expect(accepted.status()).toBe(200)
  expect((await accepted.json()).user.accessRole).toBe('Empleado')
})

test('history and SQL RLS hide deletion snapshots and all earlier changes until restoration', async ({ request, playwright }) => {
  const employee = request
  const admin = await playwright.request.newContext({ baseURL: origin })
  const db = new PrismaClient({ datasourceUrl: `${prototypeTestDatabaseURL()};connectionLimit=1`, errorFormat: 'minimal', log: [] })
  const id = 'DEMO-R01'
  try {
    await loginPrototypeAPI(admin, origin, prototypeAdmin.username, prototypeAdmin.password)
    await command(employee, origin, { type: 'workflow', caseId: id, action: { type: 'assign', owner: 'dato reservado papelera' } })
    await command(employee, origin, { type: 'set-settings', teams: false })
    await command(employee, origin, { type: 'delete-case', caseId: id, confirm: true })
    const read = async (client: typeof employee, query = '') => {
      const response = await client.get(`/api/prototype/history${query}`)
      expect(response.status()).toBe(200)
      return (await response.json() as PrototypeHistorySnapshot).entries
    }
    const trash = await read(admin, '?trash=true')
    expect(trash).toHaveLength(1)
    expect(trash[0]!.snapshot!.owner).toBe('dato reservado papelera')
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await read(admin, `?recordId=${id}`)).toHaveLength(2)
      expect(await read(employee, `?recordId=${id}`)).toEqual([])
      expect((await read(employee)).map(row => row.tableName)).toEqual(['ajustes'])
    }
    expect((await sendPrototypeCommand(employee, origin, { type: 'restore-case', historyId: trash[0]!.id, confirm: true })).status()).toBe(403)
    // No application WHERE clauses: the database itself must deny the rows.
    const raw = (tx: Prisma.TransactionClient) =>
      tx.$queryRaw<{ operation: string; recordId: string }[]>`SELECT [operation], [recordId] FROM [dbo].[PrototypeChangeHistory]`
    expect(await db.$transaction(raw)).toEqual([])
    const sqlEmployee = await db.$transaction(tx => withPrototypeHistoryAccess(tx, 'Empleado', () => raw(tx)))
    expect(sqlEmployee.map(row => row.recordId)).toEqual(['demo'])
    const sqlAdmin = await db.$transaction(tx => withPrototypeHistoryAccess(tx, 'Administrador IT', () => raw(tx)))
    expect(sqlAdmin).toHaveLength(3)
    expect(await db.$transaction(raw)).toEqual([])
    // Even interrupted work that leaves SESSION_CONTEXT populated cannot confer
    // permission to the next transaction on the same pooled connection.
    await expect(db.$transaction(async tx => {
      await tx.$executeRaw`DECLARE @id bigint = CURRENT_TRANSACTION_ID();
        EXEC sys.sp_set_session_context @key=N'rcd_history_transaction', @value=@id;
        EXEC sys.sp_set_session_context @key=N'rcd_history_role', @value=N'Administrador IT';`
      expect(await raw(tx)).toHaveLength(3)
      throw new Error('force rollback')
    })).rejects.toThrow('force rollback')
    expect(await db.$transaction(raw)).toEqual([])
    await command(admin, origin, { type: 'restore-case', historyId: trash[0]!.id, confirm: true })
    expect((await read(employee, `?recordId=${id}`)).map(row => row.operation)).toEqual(['RESTORE', 'UPDATE'])
    expect((await read(admin, `?recordId=${id}`)).map(row => row.operation)).toEqual(['RESTORE', 'DELETE', 'UPDATE'])
    await command(employee, origin, { type: 'delete-case', caseId: id, confirm: true })
    expect(await read(employee, `?recordId=${id}`)).toEqual([])
    await resetPrototypeDemo(employee, origin)
    expect(await read(admin)).toEqual([])
  } finally { await db.$disconnect(); await admin.dispose() }
})

test('employee navigation and direct SSR hide trash, admin can open it and logout clears access', async ({ page, request }) => {
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'assign', owner: 'dato oculto RLS' } })
  await command(request, origin, { type: 'delete-case', caseId: 'DEMO-R01', confirm: true })
  await prototypeLogin(page, '/registro-cambios', prototypeEmployee)
  expect((await (await page.request.get('/api/auth/session')).json()).user).toEqual({
    username: prototypeEmployee.username, accessRole: prototypeEmployee.accessRole,
  })
  await expect(page.getByRole('link', { name: 'Papelera', exact: true })).toHaveCount(0)
  await expect(page.getByText('Empleado', { exact: true })).toBeVisible()
  await expect(page.getByText('0 eventos', { exact: true })).toBeVisible()
  const ssr = await page.request.get('/papelera', { maxRedirects: 0 })
  expect(ssr.status()).toBe(302)
  expect(ssr.headers().location).toBe('/expedientes')
  expect(await ssr.text()).not.toContain('dato oculto RLS')
  await page.goto('/papelera')
  await expect(page).toHaveURL(/\/expedientes$/)
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
  await prototypeLogin(page, '/papelera', prototypeAdmin)
  await expect(page.getByRole('heading', { name: 'Papelera.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Papelera', exact: true })).toBeVisible()
  await expect(page.getByText('Administrador IT', { exact: true })).toBeVisible()
  await expect(page.getByText('1 registro eliminado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
  await prototypeLogin(page, '/papelera', prototypeEmployee)
  await expect(page).toHaveURL(/\/expedientes$/)
  await expect(page.getByRole('link', { name: 'Papelera', exact: true })).toHaveCount(0)
  expect((await page.request.get('/api/prototype/history?trash=true')).status()).toBe(403)
})
