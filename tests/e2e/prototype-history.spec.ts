import type { APIRequestContext } from '@playwright/test'
import { test, expect, prototypeOrigin as origin } from './helpers/prototype-server'
import { prototypeLogin } from './helpers/prototype-auth'
import { confirmedPrototypeCommand as command, loginPrototypeAPI, prototypeState, prototypeTestPrisma, resetPrototypeDemo, sendPrototypeCommand } from './helpers/prototype-state'
import type { PrototypeHistorySnapshot } from '../../shared/types/prototype-history'
import { prototypeAdmin } from './helpers/prototype-admin'

const loginAdmin = (request: APIRequestContext) => loginPrototypeAPI(request, origin, prototypeAdmin.username, prototypeAdmin.password)

async function reset(request: APIRequestContext) {
  await loginPrototypeAPI(request, origin)
  await resetPrototypeDemo(request, origin)
}
async function history(request: APIRequestContext, query = ''): Promise<PrototypeHistorySnapshot> {
  const response = await request.get(`/api/prototype/history${query}`)
  expect(response.status(), await response.text()).toBe(200)
  return response.json()
}

test('field history keeps exact values, real authors, portal role, settings and durable order', async ({ request, prototypeServer }) => {
  await reset(request)
  expect((await history(request)).entries).toEqual([])
  const initial = await prototypeState(request)
  const oldOwner = initial.cases.find(item => item.id === 'DEMO-R01')!.owner
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'assign', owner: 'Responsable áé persistente' } })
  const stale = await sendPrototypeCommand(request, origin, { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'assign', owner: 'No confirmado' } }, initial)
  expect(stale.status()).toBe(409)
  const fields = await history(request, '?recordId=DEMO-R01')
  expect(fields.entries).toHaveLength(1)
  expect(fields.entries[0]).toMatchObject({ changedBy: 'operador demo', changedRole: 'Profesional', operation: 'UPDATE',
    changes: { owner: { old: oldOwner, new: 'Responsable áé persistente' } } })
  expect(Math.abs(Date.now() - Date.parse(fields.entries[0]!.changedAt))).toBeLessThan(60_000)
  await command(request, origin, { type: 'set-settings', teams: false })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'respond', accept: true,
    consent: true, rentaType: 'Individual', presenter: 'RCD', fee: 250 } }, 'DEMO-R01')
  const before = await history(request)
  expect(before.entries).toHaveLength(3)
  expect(before.entries[0]).toMatchObject({ changedBy: 'operador demo', changedRole: 'Cliente', recordId: 'DEMO-R01' })
  expect(before.entries[1]).toMatchObject({ tableName: 'ajustes', changes: { teams: { old: true, new: false } } })
  expect(JSON.stringify(before)).not.toContain('No confirmado')
  await prototypeServer.restart()
  await loginPrototypeAPI(request, origin)
  expect(await history(request)).toEqual(before)
})

test('trash preserves complete case and real bytes, blocks portal, restores once and keeps audit', async ({ request }) => {
  await reset(request)
  const id = 'DEMO-R07'
  const uploaded = await command(request, origin, { type: 'workflow', caseId: id,
    action: { type: 'add-document', kind: 'Documentación adicional', name: 'original-áé.pdf', size: 73 } })
  const file = uploaded.snapshot!.files!.find(file => file.caseId === id && file.originalName === 'original-áé.pdf')!
  const before = (await prototypeState(request)).cases.find(item => item.id === id)!
  const stale = await prototypeState(request)
  await command(request, origin, { type: 'delete-case', caseId: id, confirm: true })
  const snapshot = await prototypeState(request)
  expect(snapshot.cases.some(item => item.id === id)).toBe(false)
  expect(snapshot.files!.some(file => file.caseId === id)).toBe(false)
  expect((await request.get(`/api/prototype/portal/${id}?token=demo-${id}`)).status()).toBe(404)
  expect((await request.get(`/api/prototype/cases/${id}/files/${file.fileId}/download`)).status()).toBe(404)
  await loginAdmin(request)
  const trash = await history(request, '?trash=true')
  expect(trash.entries).toHaveLength(1)
  expect(trash.entries[0]!.snapshot).toEqual(before)
  const restore = { type: 'restore-case' as const, historyId: trash.entries[0]!.id, confirm: true as const }
  expect((await sendPrototypeCommand(request, origin, restore, stale)).status()).toBe(409)
  expect((await history(request, '?trash=true')).entries).toHaveLength(1)
  await command(request, origin, restore)
  expect((await prototypeState(request)).cases.find(item => item.id === id)).toEqual(before)
  expect((await history(request, '?trash=true')).entries).toEqual([])
  const download = await request.get(`/api/prototype/cases/${id}/files/${file.fileId}/download`)
  expect(download.status()).toBe(200)
  expect(await download.body()).toEqual(Buffer.alloc(73, 65))
  expect((await request.get(`/api/prototype/portal/${id}?token=demo-${id}`)).status()).toBe(200)
  expect((await sendPrototypeCommand(request, origin, restore)).status()).toBe(404)
  const audit = (await history(request, `?recordId=${id}`)).entries
  expect(audit.map(entry => entry.operation)).toEqual(['RESTORE', 'DELETE', 'UPDATE'])
  expect(audit[1]!.restoredAt).not.toBeNull()
  await command(request, origin, { type: 'delete-case', caseId: id, confirm: true })
  await resetPrototypeDemo(request, origin)
  expect((await history(request)).entries).toEqual([])
  expect((await history(request, '?trash=true')).entries).toEqual([])
})

test('client cannot read audit or trash; internal roles cannot forge delete or restore', async ({ request }) => {
  await reset(request)
  await command(request, origin, { type: 'delete-case', caseId: 'DEMO-R01', confirm: true })
  await loginAdmin(request)
  const trash = await history(request, '?trash=true')
  await loginPrototypeAPI(request, origin)
  await command(request, origin, { type: 'set-role', role: 'IT' })
  expect((await sendPrototypeCommand(request, origin, { type: 'delete-case', caseId: 'DEMO-R02', confirm: true })).status()).toBe(403)
  expect((await sendPrototypeCommand(request, origin, { type: 'restore-case', historyId: trash.entries[0]!.id, confirm: true })).status()).toBe(403)
  expect((await request.get('/api/prototype/history?trash=true')).status()).toBe(403)
  const last = await command(request, origin, { type: 'set-role', role: 'Cliente' })
  expect((await request.get('/api/prototype/history')).status()).toBe(403)
  expect((await request.get('/api/prototype/history?trash=true')).status()).toBe(403)
  const portalRestore = await request.post('/api/prototype/portal/DEMO-R08/commands?token=demo-DEMO-R08', {
    headers: { Origin: origin }, data: { datasetId: last.datasetId, expectedRevision: last.revision,
      command: { type: 'restore-case', historyId: trash.entries[0]!.id, confirm: true } },
  })
  expect(portalRestore.status()).toBe(403)
  expect((await request.get('/api/prototype/history?recordId[]=a')).status()).toBe(400)
})

test('history dialog, field popover, navigation and trash confirmation work in browser', async ({ page, request }) => {
  await reset(request)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R04', action: { type: 'assign', owner: 'Responsable comprobado' } })
  await prototypeLogin(page, '/expedientes/DEMO-R04', prototypeAdmin)
  await page.getByRole('button', { name: 'Mostrar cambios', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Cambios de/ })
  await expect(dialog.getByText('Responsable comprobado', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('cell', { name: /operador demo/ })).toBeVisible()
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/history-dialog-desktop.png', fullPage: true })
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('link', { name: 'Expedientes', exact: true }).click()
  await page.getByRole('button', { name: 'Historial de Responsable DEMO-R04', exact: true }).click()
  await expect(page.getByText('Historial de Responsable', { exact: true })).toBeVisible()
  await expect(page.getByText('Responsable comprobado', { exact: true }).last()).toBeVisible()
  await page.getByRole('link', { name: 'Registro de cambios', exact: true }).click()
  await page.getByRole('textbox', { name: 'Buscar cambios' }).fill('Responsable comprobado')
  await expect(page.getByText('1 evento', { exact: true })).toBeVisible()
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/history-registro-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Expedientes', exact: true }).click()
  await page.getByRole('button', { name: 'Enviar DEMO-R04 a papelera', exact: true }).click()
  await page.getByRole('dialog', { name: 'Enviar expediente a papelera' }).getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect((await prototypeState(request)).cases.some(item => item.id === 'DEMO-R04')).toBe(true)
  await page.getByRole('button', { name: 'Enviar DEMO-R04 a papelera', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click()
  await page.getByRole('link', { name: 'Papelera', exact: true }).click()
  await page.getByRole('textbox', { name: 'Buscar en papelera' }).fill('Responsable comprobado')
  await expect(page.getByText('1 registro eliminado', { exact: true })).toBeVisible()
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/history-papelera-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Ver datos de DEMO-R04' }).click()
  await expect(page.getByRole('dialog').getByText('Responsable comprobado', { exact: true })).toBeVisible()
  await expect(page.locator('.p-datatable-mask')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/history-trash-detail-desktop.png', fullPage: true })
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar restauración' }).click()
  await expect(page.getByText('0 registros eliminados', { exact: true })).toBeVisible()
  await expect(page.getByText(/Expediente DEMO-R04 restaurado/)).toBeVisible()
})

test('audit write failure rolls back business state, revision and deletion atomically', async ({ request }) => {
  await reset(request)
  await loginAdmin(request)
  const before = await prototypeState(request)
  const db = prototypeTestPrisma()
  try {
    await db.$executeRawUnsafe(`ALTER TABLE [dbo].[PrototypeChangeHistory] ADD CONSTRAINT [history_e2e_reject_author] CHECK ([changedBy] <> '${prototypeAdmin.username.replaceAll("'", "''")}')`)
    for (const action of [{ type: 'workflow', caseId: 'DEMO-R01', action: { type: 'assign', owner: 'Uncommitted' } },
      { type: 'delete-case', caseId: 'DEMO-R01', confirm: true }] as const) {
      expect((await sendPrototypeCommand(request, origin, action, before)).status()).toBe(503)
      expect(await prototypeState(request)).toEqual(before)
      expect((await history(request)).entries).toEqual([])
    }
    await loginPrototypeAPI(request, origin)
    await command(request, origin, { type: 'delete-case', caseId: 'DEMO-R01', confirm: true })
    await loginAdmin(request)
    const deleted = await prototypeState(request)
    const originalAudit = await history(request)
    const restore = await sendPrototypeCommand(request, origin, { type: 'restore-case', historyId: originalAudit.entries[0]!.id, confirm: true }, deleted)
    expect(restore.status()).toBe(503)
    expect(await prototypeState(request)).toEqual(deleted)
    expect(await history(request)).toEqual(originalAudit)
    expect((await history(request, '?trash=true')).entries).toHaveLength(1)
  } finally {
    await db.$executeRawUnsafe('ALTER TABLE [dbo].[PrototypeChangeHistory] DROP CONSTRAINT [history_e2e_reject_author]')
    await db.$disconnect()
  }
})

test('opening portal during an audited command keeps destination scope and confirmed PH', async ({ page, request }) => {
  await reset(request)
  await command(request, origin, { type: 'set-role', role: 'Socio' })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-review', approve: true, note: '' } })
  await command(request, origin, { type: 'set-role', role: 'Profesional' })
  await prototypeLogin(page, '/expedientes/DEMO-72003')
  let reportCommitted!: () => void
  let reportPortal!: () => void
  let releasePortal!: () => void
  const committed = new Promise<void>(resolve => { reportCommitted = resolve })
  const portalStarted = new Promise<void>(resolve => { reportPortal = resolve })
  const portalRelease = new Promise<void>(resolve => { releasePortal = resolve })
  await page.route('**/api/prototype/commands', async route => {
    if (route.request().postDataJSON().command?.action?.type !== 'ph-send') return route.continue()
    const response = await route.fetch()
    reportCommitted()
    await portalStarted
    await route.fulfill({ response })
  })
  let firstPortal = true
  await page.route('**/api/prototype/portal/DEMO-72003?*', async route => {
    const response = await route.fetch()
    if (firstPortal) { firstPortal = false; reportPortal(); await portalRelease }
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Enviar PH manualmente' }).click()
  await committed
  const confirmed = page.waitForResponse(response => response.url().endsWith('/api/prototype/commands') && response.status() === 200)
  const navigation = page.getByRole('link', { name: 'Previsualizar portal' }).click()
  await confirmed
  // Process the command response while destination middleware is still waiting.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(null))))
  releasePortal()
  await navigation
  await expect(page).toHaveURL(/\/portal\/DEMO-72003\?token=demo-DEMO-72003/)
  await expect(page.getByRole('button', { name: /Firmar.*PH|Firmar.*propuesta|Simular.*firma/i })).toBeVisible()
  expect((await history(request, '?recordId=DEMO-72003')).entries[0]!.changes['ph.state']).toEqual({ old: 'Aprobada', new: 'Enviada' })
})

test('audit and trash stay within mobile viewport at 320 and 390 pixels', async ({ page, request }) => {
  await reset(request)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'assign', owner: 'Móvil ' + 'x'.repeat(120) } })
  await command(request, origin, { type: 'delete-case', caseId: 'DEMO-R01', confirm: true })
  await prototypeLogin(page, '/registro-cambios', prototypeAdmin)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const path of ['/registro-cambios', '/papelera']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: path === '/papelera' ? 'Papelera.' : 'Registro de cambios.' })).toBeVisible()
      await expect(page.locator('.p-datatable-mask')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `test-results/history-${path.slice(1)}-${width}.png`, fullPage: true })
    }
  }
})
