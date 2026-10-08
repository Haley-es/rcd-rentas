import type { APIRequestContext, Page } from '@playwright/test'
import { test, expect, prototypeOrigin as origin } from './helpers/prototype-server'
import { prototypeLogin } from './helpers/prototype-auth'
import { confirmedPrototypeCommand as command, inspectPrototypeDatabase, loginPrototypeAPI, prototypeState,
  prototypeTestPrisma, resetPrototypeDemo, sendPrototypeCommand } from './helpers/prototype-state'
import type { PrototypeSnapshot } from '../../shared/types/prototype'
import type { Role, WorkflowAction } from '../../app/types/domain'
import { workflowFields } from '../../shared/utils/prototype-validation'
import { runAction } from '../../app/utils/workflow'
import { decodePrototypePayload, encodePrototypePayload } from '../../server/utils/prototype-codec'
import { withPrototypeHistoryAccess } from '../../server/utils/prototype-history-access'

async function readUIState(page: Page): Promise<PrototypeSnapshot> {
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  return page.evaluate(() => Object.getOwnPropertyDescriptor(document.getElementById('__nuxt'), '__vue_app__')!.value.config.globalProperties.$nuxt.payload.state['$sprototype-snapshot'])
}
async function reset(request: APIRequestContext) {
  await loginPrototypeAPI(request, origin)
  await resetPrototypeDemo(request, origin)
}
test('P09-CA01 concurrent first bootstrap is durable, unique and idempotent', async ({ request }) => {
  const db = prototypeTestPrisma()
  try {
    await db.$transaction(tx => withPrototypeHistoryAccess(tx, 'Administrador IT', async () => {
      await tx.prototypeChangeHistory.deleteMany()
      await tx.prototypeFile.deleteMany()
      await tx.prototypeState.deleteMany()
      await tx.prototypeInstallation.deleteMany()
    }))
    await loginPrototypeAPI(request, origin)
    const [first, second] = await Promise.all([prototypeState(request), prototypeState(request)])
    expect(first).toEqual(second)
    expect(first.cases).toHaveLength(18)
    expect(new Set(first.cases.map(item => item.id)).size).toBe(18)
    expect(first.cases.filter(item => item.campaign === 'Renta')).toHaveLength(9)
    expect(first.cases.filter(item => item.campaign === '720')).toHaveLength(9)
    expect(await db.prototypeInstallation.count()).toBe(1)
    expect(await db.prototypeState.count()).toBe(1)
    const inspection = await inspectPrototypeDatabase()
    expect(inspection.state.revision).toBe(0)
    expect(inspection.payload.cases).toEqual(first.cases)
    await loginPrototypeAPI(request, origin)
    expect(await prototypeState(request)).toEqual(first)
    expect((await inspectPrototypeDatabase()).installation.initializedAt).toEqual(inspection.installation.initializedAt)
  } finally { await db.$disconnect() }
})

test('P09-CA02 reload, other context and owned server restart preserve exact state', async ({ page, request, browser, prototypeServer }) => {
  await reset(request)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R04', action: { type: 'assign', owner: 'Responsable persistente' } })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R04', action: { type: 'identity', field: 'dni', value: true, validUntil: '2031-03-02' } })
  await command(request, origin, { type: 'set-settings', teams: false })
  await command(request, origin, { type: 'advance-days', days: 1 })
  const before = await prototypeState(request)
  await prototypeLogin(page, '/expedientes/DEMO-R04')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Andrés Romero' })).toBeVisible()
  expect(await readUIState(page)).toEqual(before)
  const other = await browser.newContext({ baseURL: origin })
  try {
    await loginPrototypeAPI(other.request, origin)
    expect(await prototypeState(other.request)).toEqual(before)
    const pid = prototypeServer.pid
    await prototypeServer.restart()
    expect(prototypeServer.pid).not.toBe(pid)
    await loginPrototypeAPI(request, origin)
    expect(await prototypeState(request)).toEqual(before)
    await prototypeLogin(page, '/expedientes/DEMO-R04')
    await expect(page.getByRole('heading', { name: 'Andrés Romero' })).toBeVisible()
    expect(await readUIState(page)).toEqual(before)
  } finally { await other.close() }
})

test('P09-CA03 all 40 workflow commands commit engine-equivalent state after reload', async ({ page, request }) => {
  test.setTimeout(600_000)
  await reset(request)
  await prototypeLogin(page)
  const covered = new Set<WorkflowAction['type']>()
  async function action(caseId: string, action: WorkflowAction, role: Role = 'Profesional') {
    if (role !== 'Cliente') await command(request, origin, { type: 'set-role', role })
    const before = await prototypeState(request)
    const expected = structuredClone(before.cases.find(item => item.id === caseId)!)
    const engine = runAction(expected, action, role, before.today)
    expect(engine.ok, engine.message).toBe(true)
    const response = await command(request, origin, { type: 'workflow', caseId, action }, role === 'Cliente' ? caseId : undefined)
    expect(response.applied).toBe(1)
    expect(response.revision).toBe(before.revision + 1)
    await page.goto(`/expedientes/${caseId}`)
    await page.reload()
    await expect(page.getByRole('heading', { name: expected.name, exact: true })).toBeVisible()
    const loaded = await readUIState(page)
    expect(loaded.cases.find(item => item.id === caseId)).toEqual(expected)
    expect((await inspectPrototypeDatabase()).payload.cases.find(item => item.id === caseId)).toEqual(expected)
    covered.add(action.type)
  }
  const id = 'DEMO-R01'
  await action(id, { type: 'invite' })
  await action(id, { type: 'assign', owner: 'Lucía persistente' })
  await command(request, origin, { type: 'advance-days', days: 7 })
  await action(id, { type: 'remind' })
  await command(request, origin, { type: 'advance-days', days: 3 })
  await action(id, { type: 'call' })
  await action(id, { type: 'contact-outcome', outcome: 'Sigue interesado', note: 'Conversación ágil' })
  await action(id, { type: 'respond', accept: true, consent: true, rentaType: 'Conjunta', presenter: 'RCD', fee: 250 }, 'Cliente')
  await action(id, { type: 'ph-submit' })
  await action(id, { type: 'ph-review', approve: false, note: 'Revisar alcance' }, 'Socio')
  await action(id, { type: 'ph-edit', note: 'Ámbito revisado', fee: 300 })
  await action(id, { type: 'ph-submit' })
  await action(id, { type: 'ph-review', approve: true, note: 'Nota interna del socio' }, 'Socio')
  await action(id, { type: 'ph-send' })
  await command(request, origin, { type: 'advance-days', days: 3 })
  await action(id, { type: 'ph-call' })
  await action(id, { type: 'ph-remind' })
  await action(id, { type: 'ph-reject', note: 'Cambiar honorarios' }, 'Cliente')
  await action(id, { type: 'ph-edit', note: 'Segunda revisión', fee: 280 })
  await action(id, { type: 'ph-submit' })
  await action(id, { type: 'ph-review', approve: true, note: '' }, 'Socio')
  await action(id, { type: 'ph-send' })
  await action(id, { type: 'ph-sign' }, 'Cliente')
  await action(id, { type: 'request-identity' })
  for (const kind of ['DNI anverso', 'DNI reverso']) await action(id, { type: 'add-document', kind, name: `${kind}.pdf`, size: 123 })
  await action(id, { type: 'identity', field: 'dni', value: true, validUntil: '2030-12-31' })
  await action(id, { type: 'identity', field: 'certificate', value: true })
  await action(id, { type: 'identity', field: 'authorization', value: true })
  await action(id, { type: 'pbc-start' })
  await action(id, { type: 'pbc-decide', state: 'Incidencia', note: 'Incidencia separada de IT' }, 'PBC')
  await action(id, { type: 'pbc-decide', state: 'Apto', note: 'Decisión humana áéí' }, 'PBC')
  await action(id, { type: 'nav-register', reference: 'NAV manual' }, 'Altas')
  await action(id, { type: 'portal-send' })
  await action(id, { type: 'add-document', kind: 'Datos fiscales', name: 'fiscal.pdf', size: 321 }, 'Cliente')
  await action(id, { type: 'deliver-documents' }, 'Cliente')
  await command(request, origin, { type: 'advance-days', days: 3 })
  await action(id, { type: 'docs-remind', afterDays: 3 })
  for (const doc of (await prototypeState(request)).cases.find(item => item.id === id)!.documents) {
    await action(id, { type: 'review-document', id: doc.id, valid: true, note: 'Revisión humana' })
  }
  await action(id, { type: 'complete-documents' })
  await action(id, { type: 'tax-draft' })
  await action(id, { type: 'tax-send' })
  await action(id, { type: 'tax-respond', accept: false, note: 'Cambios fiscal áé' }, 'Cliente')
  await action(id, { type: 'tax-draft' })
  await action(id, { type: 'tax-send' })
  await action(id, { type: 'tax-respond', accept: true, note: '' }, 'Cliente')
  await action(id, { type: 'present', receipt: 'RCD-001', date: (await prototypeState(request)).today })
  await action(id, { type: 'receipt-send' })
  await action(id, { type: 'invoice', number: 'FACTURA-001' }, 'Administrativo')
  await action(id, { type: 'invoice-send' }, 'Administrativo')
  await action(id, { type: 'close' })
  await action('DEMO-72004', { type: 'withdraw', note: 'Retirada definitiva' })
  await action('DEMO-72002', { type: 'prior-confirm', note: 'Confirmación histórica humana' })
  await action('DEMO-72007', { type: 'extract', fail: true })
  await action('DEMO-72007', { type: 'it-resolve', note: 'Formato ajustado' }, 'IT')
  await action('DEMO-72007', { type: 'extract', fail: false })
  const rows = structuredClone((await prototypeState(request)).cases.find(item => item.id === 'DEMO-72007')!.extraction.rows)
  rows[0]!.entity = 'Entidad áé con ñ'
  await action('DEMO-72007', { type: 'extraction-review', rows })
  await action('DEMO-72007', { type: 'it-report', note: 'Nueva desviación manual' })
  await action('DEMO-72007', { type: 'it-resolve', note: 'Segundo ajuste' }, 'IT')
  await action('DEMO-72007', { type: 'extract', fail: false })
  await action('DEMO-72007', { type: 'extraction-review', rows })
  await action('DEMO-72007', { type: 'criteria', reference: 'CRITERIA-MANUAL', date: (await prototypeState(request)).today })
  await action('DEMO-72007', { type: 'present', receipt: '720-RCD', date: (await prototypeState(request)).today })
  await action('DEMO-72007', { type: 'receipt-send' })
  await action('DEMO-72007', { type: 'invoice', number: '720-FACTURA' })
  await action('DEMO-72007', { type: 'invoice-send' })
  await action('DEMO-72007', { type: 'close' })
  await action('DEMO-R09', { type: 'present', receipt: 'CLIENTE-009', date: (await prototypeState(request)).today }, 'Cliente')
  await action('DEMO-R09', { type: 'invoice', number: 'CLIENTE-FACTURA' })
  await action('DEMO-R09', { type: 'invoice-send' })
  await action('DEMO-R09', { type: 'close' })
  expect([...covered].sort()).toEqual(Object.keys(workflowFields).sort())
})

test('P09-CA04 settings limits, principal role and defaults survive reload', async ({ page, request, browser }) => {
  await reset(request)
  await prototypeLogin(page, '/tareas')
  for (const days of [1, 30]) {
    await command(request, origin, { type: 'set-settings', teams: false, signatureEmail: true, documentReminderDays: days })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Tareas y seguimiento.' })).toBeVisible()
    expect(await readUIState(page)).toMatchObject({ teams: false, signatureEmail: true, documentReminderDays: days })
  }
  const before = await prototypeState(request)
  for (const days of [0, 31, 1.5]) {
    expect((await sendPrototypeCommand(request, origin, { type: 'set-settings', documentReminderDays: days })).status()).toBe(400)
    expect(await prototypeState(request)).toEqual(before)
  }
  await command(request, origin, { type: 'set-role', role: 'Socio' })
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Simular rol' })).toContainText('Socio')
  const other = await browser.newContext({ baseURL: origin })
  try {
    await loginPrototypeAPI(other.request, origin, 'otro usuario')
    expect((await prototypeState(other.request)).role).toBe('Profesional')
  } finally { await other.close() }
  await resetPrototypeDemo(request, origin)
  expect(await prototypeState(request)).toMatchObject({ teams: true, signatureEmail: false, documentReminderDays: 3, role: 'Profesional' })
})

test('P09-CA05 exact 7+3, signature 3, document cadence and batch partial results', async ({ request }) => {
  await reset(request)
  const batch = await sendPrototypeCommand(request, origin, { type: 'invite-many', caseIds: ['DEMO-R01', 'DEMO-72002', 'DEMO-R03'] })
  expect(batch.status()).toBe(200)
  expect(await batch.json()).toMatchObject({ ok: false, applied: 1, results: [{ ok: true }, { ok: false }, { ok: false }] })
  const evaluate = () => command(request, origin, { type: 'evaluate-followups' })
  const targetResults = (result: Awaited<ReturnType<typeof evaluate>>, id: string) => result.results?.filter(result => result.caseId === id) ?? []
  await command(request, origin, { type: 'advance-days', days: 6 })
  expect(targetResults(await evaluate(), 'DEMO-R01')).toEqual([])
  await command(request, origin, { type: 'advance-days', days: 1 })
  expect(targetResults(await evaluate(), 'DEMO-R01')).toMatchObject([{ action: 'remind', ok: true }])
  await command(request, origin, { type: 'advance-days', days: 2 })
  expect(targetResults(await evaluate(), 'DEMO-R01')).toEqual([])
  await command(request, origin, { type: 'advance-days', days: 1 })
  expect(targetResults(await evaluate(), 'DEMO-R01')).toMatchObject([{ action: 'call', ok: true }])
  const stable = await prototypeState(request)
  expect((await evaluate()).applied).toBe(0)
  expect(await prototypeState(request)).toEqual(stable)
  await command(request, origin, { type: 'set-role', role: 'Socio' })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-review', approve: true, note: '' } })
  await command(request, origin, { type: 'set-role', role: 'Profesional' })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-send' } })
  await command(request, origin, { type: 'set-settings', signatureEmail: true, documentReminderDays: 1 })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R07', action: { type: 'add-document', kind: 'Datos fiscales', name: 'new.pdf', size: 1 } })
  expect(targetResults(await evaluate(), 'DEMO-R07')).toEqual([])
  await command(request, origin, { type: 'advance-days', days: 1 })
  expect(targetResults(await evaluate(), 'DEMO-R07')).toMatchObject([{ action: 'docs-remind', ok: true }])
  await command(request, origin, { type: 'advance-days', days: 1 })
  expect(targetResults(await evaluate(), 'DEMO-72003')).toEqual([])
  await command(request, origin, { type: 'advance-days', days: 1 })
  expect(targetResults(await evaluate(), 'DEMO-72003')).toMatchObject([{ action: 'ph-call', ok: true }, { action: 'ph-remind', ok: true }])
  const final = await prototypeState(request)
  expect((await evaluate()).applied).toBe(0)
  expect(await prototypeState(request)).toEqual(final)
})

test('P09-CA06 CAS same/global case, double click and obsolete rows preserve edits', async ({ page, request }) => {
  await reset(request)
  for (const ids of [['DEMO-R04', 'DEMO-R04'], ['DEMO-R04', 'DEMO-R06']]) {
    const before = await prototypeState(request)
    const commands = ids.map((caseId, index) => ({ type: 'workflow' as const, caseId, action: index === 0 ?
      { type: 'assign' as const, owner: `CAS ${caseId}` } : { type: 'contact-outcome' as const, outcome: 'Sin contacto' as const, note: 'CAS nota' } }))
    const responses = await Promise.all(commands.map(cmd => sendPrototypeCommand(request, origin, cmd, before)))
    expect(responses.map(response => response.status()).sort()).toEqual([200, 409])
    const conflict = responses.findIndex(response => response.status() === 409)
    expect((await prototypeState(request)).revision).toBe(before.revision + 1)
    await command(request, origin, commands[conflict]!)
    const after = await prototypeState(request)
    expect(after.revision).toBe(before.revision + 2)
    expect(after.cases.reduce((n, item) => n + item.history.length, 0)).toBe(before.cases.reduce((n, item) => n + item.history.length, 0) + 2)
  }
  await prototypeLogin(page, '/expedientes/DEMO-R04')
  await page.getByRole('button', { name: 'Cambiar responsable' }).click()
  await page.getByRole('dialog').getByRole('combobox').click()
  await page.getByRole('option', { name: 'Marta Soler', exact: true }).click()
  let posts = 0
  await page.route('**/api/prototype/commands', async route => { posts++; await new Promise(resolve => setTimeout(resolve, 200)); await route.continue() })
  await page.getByRole('button', { name: 'Confirmar simulación' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(posts).toBe(1)
  await page.unroute('**/api/prototype/commands')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72007', action: { type: 'extract', fail: false } })
  await page.goto('/expedientes/DEMO-72007')
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  await page.getByRole('tab', { name: 'Extracción y Criteria' }).click()
  await page.getByRole('textbox', { name: 'Entidad', exact: true }).first().fill('Edición local conservada')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R04', action: { type: 'assign', owner: 'Cambio en otra pestaña' } })
  const conflict = page.waitForResponse(response => response.url().endsWith('/api/prototype/commands') && response.status() === 409)
  await page.getByRole('button', { name: 'Validar Excel vigente' }).click()
  await conflict
  await expect(page.getByRole('textbox', { name: 'Entidad', exact: true }).first()).toHaveValue('Edición local conservada')
  await expect(page.getByRole('alert').filter({ hasText: 'Edición obsoleta conservada' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar edición revisada' }).click()
  await page.getByRole('button', { name: 'Validar Excel vigente' }).click()
  await expect(page.getByRole('status')).toContainText('validado por profesional')
  expect((await prototypeState(request)).cases.find(item => item.id === 'DEMO-72007')!.extraction.rows[0]!.entity).toBe('Edición local conservada')
})

test('P09-CA07 invalid roles/shape/IDs/version, Cliente control and portal confinement', async ({ request }) => {
  await reset(request)
  const initial = await prototypeState(request)
  for (const [cmd, status] of [
    [{ type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-review', approve: true, note: '' } }, 403],
    [{ type: 'workflow', caseId: 'absent', action: { type: 'assign', owner: 'x' } }, 404],
    [{ type: 'workflow', caseId: 'DEMO-R01', action: { type: 'assign', owner: 12 } }, 400],
  ] as const) {
    const response = await request.post('/api/prototype/commands', { headers: { Origin: origin },
      data: { datasetId: initial.datasetId, expectedRevision: initial.revision, command: cmd } })
    expect(response.status()).toBe(status)
    expect((await response.json()).data.message).toBeTruthy()
    expect(await prototypeState(request)).toEqual(initial)
  }
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R08', action: { type: 'tax-respond', accept: true, note: '' } }, 'DEMO-R08')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R08', action: { type: 'tax-draft' } })
  const invalidVersion = await prototypeState(request)
  expect((await sendPrototypeCommand(request, origin, { type: 'workflow', caseId: 'DEMO-R08',
    action: { type: 'present', receipt: 'invalid', date: invalidVersion.today } })).status()).toBe(422)
  expect(await prototypeState(request)).toEqual(invalidVersion)
  const control = await command(request, origin, { type: 'set-role', role: 'Cliente' })
  expect(control).not.toHaveProperty('cases')
  expect(control).not.toHaveProperty('snapshot')
  expect((await request.get('/api/prototype/state')).status()).toBe(403)
  const dto = await (await request.get('/api/prototype/portal/DEMO-R08?token=demo-DEMO-R08')).json()
  for (const [caseId, action] of [
    ['DEMO-72003', { type: 'ph-review', approve: true, note: '' }],
    ['DEMO-R08', { type: 'pbc-decide', state: 'Apto', note: 'x' }],
    ['DEMO-R09', { type: 'tax-respond', accept: true, note: '' }],
  ]) {
    const response = await request.post('/api/prototype/portal/DEMO-R08/commands?token=demo-DEMO-R08', {
      headers: { Origin: origin }, data: { datasetId: dto.datasetId, expectedRevision: dto.revision, command: { type: 'workflow', caseId, action } },
    })
    expect(response.status()).toBe(403)
  }
  const back = await sendPrototypeCommand(request, origin, { type: 'set-role', role: 'Profesional' }, dto)
  expect(back.status()).toBe(200)
  expect((await prototypeState(request)).cases).toHaveLength(18)
})

test('P09-CA08 portal JSON and SSR never expose internal state, and Clara cases stay isolated', async ({ page, request }) => {
  await reset(request)
  const state = await prototypeState(request)
  const portal = await request.get('/api/prototype/portal/DEMO-72002?token=demo-DEMO-72002')
  expect(portal.status()).toBe(200)
  const dto = await portal.json()
  expect(dto.case.id).toBe('DEMO-72002')
  for (const key of ['history', 'pbcNote', 'nav', 'extraction', 'rolesByPrincipal', 'scenario', 'segment']) {
    expect(JSON.stringify(dto)).not.toContain(`"${key}"`)
  }
  expect(dto.case.ph).not.toHaveProperty('note')
  expect(dto.case.tax).not.toHaveProperty('note')
  await prototypeLogin(page, '/portal/DEMO-72002?token=demo-DEMO-72002')
  const html = await (await request.get('/portal/DEMO-72002?token=demo-DEMO-72002')).text()
  for (const forbidden of ['DEMO-R01', 'DEMO-R06', 'Coincidencia ficticia', 'Formato no reconocido', '"history"', '"nav"', '"extraction"']) expect(html).not.toContain(forbidden)
  expect(html).toContain('DEMO-72002')
  for (const query of ['', '?token=incorrect']) {
    const denied = await request.get(`/api/prototype/portal/DEMO-72002${query}`)
    expect(denied.status()).toBe(403)
    expect(await denied.text()).not.toContain('Clara')
    const deniedHTML = await (await request.get(`/portal/DEMO-72002${query}`)).text()
    expect(deniedHTML).not.toContain('Clara')
  }
  expect((await request.get('/api/prototype/portal/absent?token=demo-absent')).status()).toBe(404)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'respond', accept: true,
    consent: true, rentaType: 'Individual', presenter: 'RCD', fee: 150 } }, 'DEMO-R01')
  expect((await prototypeState(request)).cases.find(item => item.id === 'DEMO-72002')).toEqual(state.cases.find(item => item.id === 'DEMO-72002'))
})

test('P09-CA09 reset cancel/confirm, old dataset, state loss/corruption never bootstrap', async ({ page, request }) => {
  await reset(request)
  await command(request, origin, { type: 'advance-days', days: 1 })
  await prototypeLogin(page)
  const before = await prototypeState(request)
  const marker = (await inspectPrototypeDatabase()).installation
  await page.getByRole('button', { name: 'Reiniciar demo', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await prototypeState(request)).toEqual(before)
  await page.getByRole('button', { name: 'Reiniciar demo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reiniciar demo', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const after = await prototypeState(request)
  expect(after.revision).toBe(before.revision + 1)
  expect(after.datasetId).not.toBe(before.datasetId)
  expect(after.cases).toHaveLength(18)
  expect(after.today).toBe('2026-06-12')
  expect((await inspectPrototypeDatabase()).installation).toEqual(marker)
  expect((await sendPrototypeCommand(request, origin, { type: 'advance-days', days: 1 }, before)).status()).toBe(409)
  const db = prototypeTestPrisma()
  const backup = await db.prototypeState.findUniqueOrThrow({ where: { id: 1 } })
  try {
    await db.prototypeState.delete({ where: { id: 1 } })
    const missing = await request.get('/api/prototype/state')
    expect(missing.status()).toBe(500)
    expect((await missing.json()).data.code).toBe('STATE_INVALID')
    expect(await db.prototypeState.count()).toBe(0)
    await db.prototypeState.create({ data: backup })
    await db.prototypeState.update({ where: { id: 1 }, data: { payload: '{' } })
    const corrupt = await request.get('/api/prototype/state')
    expect(corrupt.status()).toBe(500)
    expect((await corrupt.json()).data.code).toBe('STATE_INVALID')
    expect((await db.prototypeState.findUniqueOrThrow({ where: { id: 1 } })).payload).toBe('{')
    const empty = decodePrototypePayload(backup.payload, backup.schemaVersion)
    empty.cases = []
    await db.prototypeState.update({ where: { id: 1 }, data: { payload: encodePrototypePayload(empty) } })
    expect((await prototypeState(request)).cases).toEqual([])
    await db.prototypeState.update({ where: { id: 1 }, data: { schemaVersion: 2 } })
    expect((await request.get('/api/prototype/state')).status()).toBe(500)
  } finally {
    await db.prototypeState.upsert({ where: { id: 1 }, create: backup, update: backup })
    await db.$disconnect()
  }
})

test('P09-CA10 real SQL failure, recovery and network uncertainty have explicit UI errors', async ({ page, request, prototypeServer }) => {
  test.setTimeout(300_000)
  await reset(request)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R04', action: { type: 'assign', owner: 'Commit antes de caída' } })
  const before = await prototypeState(request)
  try {
    await prototypeServer.restart(true)
    await loginPrototypeAPI(request, origin)
    const response = await request.get('/api/prototype/state')
    expect(response.status()).toBe(503)
    expect((await response.json()).data.code).toBe('DATABASE_UNAVAILABLE')
    expect((await sendPrototypeCommand(request, origin, { type: 'advance-days', days: 1 }, before)).status()).toBe(503)
    await prototypeLogin(page)
    await expect(page.getByRole('alert').filter({ hasText: 'SQL Server no disponible' }).first()).toBeVisible()
    expect(await page.locator('body').innerText()).not.toContain('Clara Martínez')
    expect(await readUIState(page)).toBeNull()
  } finally { await prototypeServer.restart() }
  await loginPrototypeAPI(request, origin)
  expect(await prototypeState(request)).toEqual(before)
  await prototypeLogin(page, '/expedientes/DEMO-R04')
  await page.getByRole('button', { name: 'Cambiar responsable' }).click()
  await page.getByRole('dialog').getByRole('combobox').click()
  await page.getByRole('option', { name: 'Marta Soler', exact: true }).click()
  await page.route('**/api/prototype/commands', route => route.abort('failed'))
  await page.getByRole('button', { name: 'Confirmar simulación' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Respuesta no confirmada' }).first()).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Confirmar simulación' })).toBeDisabled()
  expect(await prototypeState(request)).toEqual(before)
  await page.unroute('**/api/prototype/commands')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Reintentar sincronización' }).click()
  await expect(page.getByRole('button', { name: 'Cambiar responsable' })).toBeEnabled()
  expect(await readUIState(page)).toEqual(before)
})

test('P09-CA11 semantic SQL codec roundtrip preserves Unicode, optional, null, drafts and runs', async ({ request, page }) => {
  await reset(request)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72007', action: { type: 'extract', fail: false } })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R09', action: { type: 'tax-draft' } })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R04', action: { type: 'contact-outcome', outcome: 'Sin contacto', note: 'Acentos áéíóú; ñ; €; notas ordenadas' } })
  const inspection = await inspectPrototypeDatabase()
  expect(decodePrototypePayload(encodePrototypePayload(inspection.payload), 1)).toEqual(inspection.payload)
  expect(inspection.payload.cases.find(item => item.id === 'DEMO-R01')!.ph.signedVersion).toBeNull()
  expect(inspection.payload.cases.find(item => item.id === 'DEMO-R01')!.tax).not.toHaveProperty('drafts')
  expect(inspection.payload.cases.find(item => item.id === 'DEMO-72007')!.extraction.runs?.map(run => run.version)).toEqual([1, 2])
  expect(inspection.payload.cases.find(item => item.id === 'DEMO-R09')!.tax.drafts?.map(draft => draft.version)).toEqual([3])
  const expected = await prototypeState(request)
  await prototypeLogin(page, '/expedientes/DEMO-R04')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Andrés Romero' })).toBeVisible()
  expect(await readUIState(page)).toEqual(expected)
})
