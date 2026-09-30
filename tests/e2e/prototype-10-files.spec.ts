import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID, createHash } from 'node:crypto'
import { readFile, readdir, mkdir, writeFile, unlink, rmdir, utimes, lstat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { request as httpRequest } from 'node:http'
import { test, expect, prototypeOrigin as origin, prototypeUploadRoot } from './helpers/prototype-server'
import { prototypeLogin } from './helpers/prototype-auth'
import { confirmedPrototypeCommand as command, loginPrototypeAPI, prototypeState, resetPrototypeDemo, prototypeTestPrisma, sendPrototypeCommand } from './helpers/prototype-state'
import type { PrototypeSnapshot, PrototypeCommandResult } from '../../shared/types/prototype'
import type { PrototypeFileDescriptor } from '../../shared/types/prototype-files'
import { reconcileStoredFiles } from '../../server/utils/prototype-file-storage'

const pdf = Buffer.from('%PDF-1.4\nLOCAL DEMO ONLY\n\u0000bytes ñ\n%%EOF\n')
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const base = (id: string, portal = false) => `/api/prototype/${portal ? 'portal' : 'cases'}/${id}/files`
const query = (id: string, portal: boolean) => portal ? `?token=demo-${id}` : ''
async function upload(request: APIRequestContext, id = 'DEMO-R07', bytes = pdf, portal = false,
  state?: Pick<PrototypeSnapshot, 'datasetId' | 'revision'>, extra: Record<string, string> = {}, name = 'muestra.pdf', mimeType = 'application/pdf') {
  const current = state ?? await prototypeState(request)
  return request.post(`${base(id, portal)}${query(id, portal)}`, { headers: { Origin: origin }, multipart: {
    file: { name, mimeType, buffer: bytes }, kind: 'Datos fiscales',
    datasetId: current.datasetId, expectedRevision: String(current.revision), ...extra,
  } })
}
async function uploaded(request: APIRequestContext, id = 'DEMO-R07', bytes = pdf, portal = false) {
  const response = await upload(request, id, bytes, portal)
  expect(response.status(), await response.text()).toBe(200)
  const result: PrototypeCommandResult & { file: PrototypeFileDescriptor } = await response.json()
  expect(result.file.fileId).toBeTruthy()
  return result
}
async function listed(request: APIRequestContext, id = 'DEMO-R07', portal = false): Promise<PrototypeFileDescriptor[]> {
  const response = await request.get(`${base(id, portal)}${query(id, portal)}`)
  expect(response.status(), await response.text()).toBe(200)
  return response.json()
}
async function exactDownload(request: APIRequestContext, file: PrototypeFileDescriptor, expected: Buffer, portal = false) {
  const response = await request.get(`${base(file.caseId, portal)}/${file.fileId}/download${query(file.caseId, portal)}`)
  expect(response.status(), await response.text()).toBe(200)
  expect(await response.body()).toEqual(expected)
  expect(hash(await response.body())).toBe(file.sha256)
  expect(response.headers()['cache-control']).toBe('no-store')
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['content-disposition']).toMatch(/^attachment;/)
  const db = prototypeTestPrisma()
  try {
    const row = await db.prototypeFile.findUniqueOrThrow({ where: { id: file.fileId! } })
    expect(hash(await readFile(resolve(prototypeUploadRoot, ...row.storageKey.split('\\'))))).toBe(file.sha256)
    expect(row.documentId).toBe(file.documentId)
    expect(row.documentVersion).toBe(file.documentVersion)
  } finally { await db.$disconnect() }
}
async function diskKeys() {
  const keys: string[] = []
  for (const directory of await readdir(prototypeUploadRoot, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue
    for (const entry of await readdir(resolve(prototypeUploadRoot, directory.name), { withFileTypes: true })) {
      if (entry.isFile()) keys.push(`${directory.name}\\${entry.name}`)
    }
  }
  return keys.sort()
}
async function prepare(request: APIRequestContext, id: string) {
  const state = await prototypeState(request)
  const response = await request.post(`${base(id)}/artifacts`, { headers: { Origin: origin }, data: {
    datasetId: state.datasetId, expectedRevision: state.revision, confirm: true,
  } })
  expect(response.status(), await response.text()).toBe(200)
  return response.json()
}
async function confirmPortal(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: /Confirmar/ }).click()
  await expect(dialog).not.toBeVisible()
}
test.beforeEach(async ({ request }) => {
  await loginPrototypeAPI(request, origin)
  await resetPrototypeDemo(request, origin)
})

test('P10-CA01 browser portal and internal upload preserve linked bytes and hashes after reload', async ({ page }) => {
  await prototypeLogin(page, '/portal/DEMO-R07?token=demo-DEMO-R07')
  await page.getByRole('combobox', { name: 'Tipo documental' }).click()
  await page.getByRole('option', { name: 'Datos fiscales', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'portal-real.pdf', mimeType: 'application/pdf', buffer: pdf })
  await page.getByRole('button', { name: 'Revisar nueva versión' }).click()
  await confirmPortal(page)
  await page.reload()
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  const file = (await listed(page.request, 'DEMO-R07', true)).find(file => file.originalName === 'portal-real.pdf')!
  expect(file.documentVersion).toBe(2)
  const portal = await (await page.request.get('/api/prototype/portal/DEMO-R07?token=demo-DEMO-R07')).json()
  expect(portal.case.documents.find((doc: { id: string }) => doc.id === file.documentId).version).toBe(file.documentVersion)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar portal-real.pdf', exact: true }).click()
  expect(await readFile((await (await download).path())!)).toEqual(pdf)
  await exactDownload(page.request, file, pdf, true)
  await page.getByRole('button', { name: 'Volver a gestión demo' }).click()
  await page.getByRole('combobox', { name: 'Tipo de archivo local' }).click()
  await page.getByRole('option', { name: 'Información bancaria', exact: true }).click()
  const internal = Buffer.from('%PDF INTERNAL\n')
  await page.getByLabel('Archivo local de muestra').setInputFiles({ name: 'internal.pdf', mimeType: 'application/pdf', buffer: internal })
  await page.getByRole('button', { name: 'Confirmar subida real' }).click()
  await expect(page.getByRole('button', { name: 'Descargar internal.pdf', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
  const internalDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar internal.pdf', exact: true }).click()
  expect(await readFile((await (await internalDownload).path())!)).toEqual(internal)
  await exactDownload(page.request, (await listed(page.request)).find(file => file.originalName === 'internal.pdf')!, internal)
})

test('P10-CA02 sequential v2/v3 distinct IDs preserve originals and invalidate review/agreement', async ({ request, page }) => {
  const first = await uploaded(request)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R07', action: { type: 'deliver-documents' } }, 'DEMO-R07')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R07', action: { type: 'review-document', id: first.file.documentId!, valid: true, note: '' } })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R07', action: { type: 'complete-documents' } })
  const secondBytes = Buffer.from('%PDF-NEW\n')
  const second = await uploaded(request, 'DEMO-R07', secondBytes)
  expect([first.file.documentVersion, second.file.documentVersion]).toEqual([2, 3])
  expect(first.file.documentId).not.toBe(second.file.documentId)
  expect(first.file.fileId).not.toBe(second.file.fileId)
  await prototypeLogin(page, '/expedientes/DEMO-R07')
  await page.reload()
  for (const [file, bytes] of [[first.file, pdf], [second.file, secondBytes]] as const) await exactDownload(request, file, bytes)
  const item = (await prototypeState(request)).cases.find(item => item.id === 'DEMO-R07')!
  expect(item.delivered).toBe(false); expect(item.docsComplete).toBe(false)
  expect(item.documents.at(-1)?.state).toBe('Enviado')
  expect(item.documents.find(doc => doc.id === first.file.documentId)?.state).toBe('Válido')
  await uploaded(request, 'DEMO-R09')
  const renta = (await prototypeState(request)).cases.find(item => item.id === 'DEMO-R09')!
  expect(renta.tax.acceptedVersion).toBeNull()
  expect(renta.tax.state).toBe('Cambios solicitados')
  await uploaded(request, 'DEMO-72008')
  expect((await prototypeState(request)).cases.find(item => item.id === 'DEMO-72008')!.extraction.criteriaVersion).toBeUndefined()
})

test('P10-CA03 API exact 0/10000000/10000001 bounds, MIME/extension and required multipart fields', async ({ request }) => {
  const before = await prototypeState(request)
  const filesBefore = await diskKeys()
  for (const [bytes, name, mime, status] of [
    [Buffer.alloc(0), 'empty.pdf', 'application/pdf', 400],
    [Buffer.alloc(10_000_001), 'big.pdf', 'application/pdf', 413],
    [pdf, 'mismatch.pdf', 'image/png', 400], [pdf, 'active.html', 'text/html', 400],
  ] as const) expect((await upload(request, 'DEMO-R07', bytes, false, before, {}, name, mime)).status()).toBe(status)
  for (const multipart of [
    { kind: 'Datos fiscales', datasetId: before.datasetId, expectedRevision: String(before.revision) },
    { file: { name: 'sample.pdf', mimeType: 'application/pdf', buffer: pdf }, datasetId: before.datasetId, expectedRevision: String(before.revision) },
  ]) expect((await request.post(base('DEMO-R07'), { headers: { Origin: origin }, multipart })).status()).toBe(400)
  expect(await prototypeState(request)).toEqual(before)
  expect(await diskKeys()).toEqual(filesBefore)
  const cookies = (await request.storageState()).cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
  const streamedStatus = await new Promise<number>((resolveResult, reject) => {
    const req = httpRequest(`${origin}${base('DEMO-R07')}`, { method: 'POST', headers: {
      Cookie: cookies, Origin: origin, 'Content-Type': 'multipart/form-data; boundary=streamed',
    } }, response => { response.resume(); response.on('end', () => resolveResult(response.statusCode!)) })
    req.on('error', reject)
    // No Content-Length: the server must measure actual incoming chunks.
    for (let index = 0; index < 155; index++) req.write(Buffer.alloc(65_536))
    req.end()
  })
  expect(streamedStatus).toBe(413)
  expect((await prototypeState(request)).revision).toBe(before.revision)
  const maximum = Buffer.alloc(10_000_000, 42)
  await exactDownload(request, (await uploaded(request, 'DEMO-R07', maximum)).file, maximum)
  for (const [extension, mimeType] of Object.entries({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })) expect((await upload(request, 'DEMO-R07', Buffer.from('sample'), false, undefined, {}, `sample.${extension}`, mimeType)).status()).toBe(200)
})

test('P10-CA04 session/logout and case/token isolation protect every file route', async ({ request, playwright }) => {
  const a = (await uploaded(request)).file
  const b = (await uploaded(request, 'DEMO-72002')).file
  const claraRenta = (await uploaded(request, 'DEMO-R08')).file
  expect(claraRenta.caseId).not.toBe(b.caseId)
  expect((await request.get(`${base('DEMO-R08', true)}/${b.fileId}/download?token=demo-DEMO-R08`)).status()).toBe(404)
  expect((await request.get(`${base('DEMO-R07', true)}/${b.fileId}/download?token=demo-DEMO-R07`)).status()).toBe(404)
  expect((await request.get(`${base('DEMO-R07', true)}?token=wrong`)).status()).toBe(403)
  expect((await request.get(`${base('DEMO-R07', true)}/${a.fileId}/download?token=wrong`)).status()).toBe(403)
  const anon = await playwright.request.newContext({ baseURL: origin })
  try {
    for (const portal of [false, true]) {
      const url = `${base('DEMO-R07', portal)}${query('DEMO-R07', portal)}`
      expect((await anon.get(url)).status()).toBe(401)
      expect((await anon.post(url, { headers: { Origin: origin }, multipart: {} })).status()).toBe(401)
      expect((await anon.get(`${base('DEMO-R07', portal)}/${a.fileId}/download${query('DEMO-R07', portal)}`)).status()).toBe(401)
    }
  } finally { await anon.dispose() }
  await request.post('/api/auth/logout', { headers: { Origin: origin }, data: {} })
  expect((await request.get(`${base('DEMO-R07')}/${a.fileId}/download`)).status()).toBe(401)
})

test('P10-CA05 seed originals unavailable, artifacts explicit/idempotent and portal visibility gated', async ({ request, page }) => {
  const files = await listed(request)
  expect(files.every(file => file.source === 'metadata-only' && !file.available && file.fileId === null)).toBe(true)
  expect((await request.get(`${base('DEMO-R07')}/${files[0]!.documentId}/download`)).status()).toBe(404)
  expect((await listed(request, 'DEMO-72003', true)).some(file => file.category === 'ph')).toBe(false)
  await prepare(request, 'DEMO-R08')
  const once = await prototypeState(request)
  await prepare(request, 'DEMO-R08')
  expect((await prototypeState(request)).revision).toBe(once.revision)
  const artifacts = (await listed(request, 'DEMO-R08')).filter(file => file.source === 'generated-demo')
  expect(new Set(artifacts.map(file => file.anchor + file.category)).size).toBe(artifacts.length)
  for (const file of artifacts) {
    expect(file.originalName).toMatch(/\.(txt|csv)$/)
    const bytes = await (await request.get(`${base(file.caseId)}/${file.fileId}/download`)).body()
    expect(bytes.toString()).toContain('FICTICIO')
  }
  await prepare(request, 'DEMO-72009')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72009', action: { type: 'invoice', number: '720-DEMO-INVOICE' } })
  const privateFiles = (await listed(request, 'DEMO-72009')).filter(file => ['receipt', 'invoice'].includes(file.category))
  const publicFiles = await listed(request, 'DEMO-72009', true)
  expect(privateFiles.map(file => file.category).sort()).toEqual(['invoice', 'receipt'])
  expect(publicFiles.some(file => ['receipt', 'invoice'].includes(file.category))).toBe(false)
  for (const file of privateFiles) if (!publicFiles.some(entry => entry.fileId === file.fileId)) expect((await request.get(`${base(file.caseId, true)}/${file.fileId}/download?token=demo-${file.caseId}`)).status()).toBe(404)
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72009', action: { type: 'receipt-send' } })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72009', action: { type: 'invoice-send' } })
  expect((await listed(request, 'DEMO-72009', true)).filter(file => ['receipt', 'invoice'].includes(file.category))).toHaveLength(2)
  await prototypeLogin(page, '/portal/DEMO-R07?token=demo-DEMO-R07')
  await expect(page.getByText('Muestra precargada: solo metadatos. Original no disponible; histórico sin archivo disponible.').first()).toBeVisible()
  await page.getByRole('button', { name: 'Preparar muestras TXT/CSV actuales', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Muestras TXT/CSV actuales guardadas')
  const prepared = await prototypeState(request)
  const publicPH = (await listed(request, 'DEMO-R07', true)).find(file => file.category === 'ph')!
  expect(publicPH.source).toBe('generated-demo')
  const frozenPH = await (await request.get(`${base(publicPH.caseId, true)}/${publicPH.fileId}/download?token=demo-${publicPH.caseId}`)).body()
  await exactDownload(request, publicPH, frozenPH, true)
  await page.getByRole('button', { name: 'Preparar muestras TXT/CSV actuales', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Muestras TXT/CSV actuales guardadas')
  expect((await prototypeState(request)).revision).toBe(prepared.revision)
})

test('P10-CA06 PH/extraction published versions are immutable and no external integration runs', async ({ request, page }) => {
  const external: string[] = []
  page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(origin)) external.push(req.url()) })
  await prototypeLogin(page)
  await command(request, origin, { type: 'set-role', role: 'Socio' })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-review', approve: true, note: 'PRIVATE-PH-NOTE' } })
  await command(request, origin, { type: 'set-role', role: 'Profesional' })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-send' } })
  const oldPH = (await listed(request, 'DEMO-72003')).find(file => file.category === 'ph')!
  const oldBytes = await (await request.get(`${base(oldPH.caseId)}/${oldPH.fileId}/download`)).body()
  expect(oldBytes.toString()).not.toContain('PRIVATE-PH-NOTE')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-reject', note: 'Nueva negociación' } }, 'DEMO-72003')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-edit', note: 'Nueva PH', fee: 500 } })
  expect((await listed(request, oldPH.caseId, true)).some(file => file.category === 'ph')).toBe(false)
  expect((await request.get(`${base(oldPH.caseId, true)}/${oldPH.fileId}/download?token=demo-${oldPH.caseId}`)).status()).toBe(404)
  expect((await prototypeState(request)).cases.find(item => item.id === oldPH.caseId)!.ph.signedVersion).toBeNull()
  await command(request, origin, { type: 'workflow', caseId: oldPH.caseId, action: { type: 'ph-submit' } })
  await command(request, origin, { type: 'set-role', role: 'Socio' })
  await command(request, origin, { type: 'workflow', caseId: oldPH.caseId, action: { type: 'ph-review', approve: true, note: '' } })
  await command(request, origin, { type: 'set-role', role: 'Profesional' })
  await command(request, origin, { type: 'workflow', caseId: oldPH.caseId, action: { type: 'ph-send' } })
  expect((await listed(request, oldPH.caseId)).filter(file => file.category === 'ph')).toHaveLength(2)
  await exactDownload(request, oldPH, oldBytes)
  for (let version = 0; version < 2; version++) {
    await command(request, origin, { type: 'workflow', caseId: 'DEMO-72007', action: { type: 'extract', fail: false } })
    const item = (await prototypeState(request)).cases.find(item => item.id === 'DEMO-72007')!
    item.extraction.rows[0]!.entity = `Entidad congelada v${version}`
    await command(request, origin, { type: 'workflow', caseId: item.id, action: { type: 'extraction-review', rows: item.extraction.rows } })
  }
  const csv = (await listed(request, 'DEMO-72007')).filter(file => file.category === 'extraction')
  expect(csv).toHaveLength(2); expect(csv[0]!.anchor).not.toBe(csv[1]!.anchor)
  for (const [index, file] of csv.entries()) {
    const bytes = await (await request.get(`${base(file.caseId)}/${file.fileId}/download`)).body()
    expect(bytes.toString()).toContain('no XLSX ni importable en Criteria')
    expect(bytes.toString()).toContain(`Entidad congelada v${index}`)
    await exactDownload(request, file, bytes)
  }
  await page.reload()
  expect(external).toEqual([])
})

test('P10-CA07 concurrent uploads CAS, reconfirmation and in-flight reset do not leak blobs', async ({ request }) => {
  const state = await prototypeState(request)
  const oldKeys = await diskKeys()
  const responses = await Promise.all([upload(request, 'DEMO-R07', pdf, false, state), upload(request, 'DEMO-R07', pdf, false, state)])
  expect(responses.map(response => response.status()).sort()).toEqual([200, 409])
  expect((await diskKeys()).length).toBe(oldKeys.length + 1)
  await uploaded(request)
  expect((await listed(request)).filter(file => file.fileId)).toHaveLength(2)
  const beforeReset = await prototypeState(request)
  const boundary = 'rcd-test-reset'
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nDatos fiscales\r\n--${boundary}\r\nContent-Disposition: form-data; name="datasetId"\r\n\r\n${beforeReset.datasetId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="expectedRevision"\r\n\r\n${beforeReset.revision}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="cross-reset.pdf"\r\nContent-Type: application/pdf\r\n\r\nbytes\r\n--${boundary}--\r\n`)
  const cookie = (await request.storageState()).cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
  let finish!: () => void
  const response = new Promise<number>((resolveResult, reject) => {
    const req = httpRequest(`${origin}${base('DEMO-R07')}`, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': `multipart/form-data; boundary=${boundary}` } }, response => {
      response.resume(); response.on('end', () => resolveResult(response.statusCode!))
    })
    req.on('error', reject)
    req.write(body.subarray(0, body.length - 10))
    finish = () => req.end(body.subarray(body.length - 10))
  })
  await new Promise(resolve => setTimeout(resolve, 200))
  await resetPrototypeDemo(request, origin)
  finish()
  expect(await response).toBe(409)
  expect((await listed(request)).some(file => file.fileId)).toBe(false)
  expect((await diskKeys()).filter(key => key.startsWith(beforeReset.datasetId))).toHaveLength(0)
})

test('P10-CA08 owned server restart retains SQL metadata and exact disk bytes, sessions expire', async ({ request, page, prototypeServer }) => {
  const file = (await uploaded(request)).file
  await prototypeLogin(page, '/expedientes/DEMO-R07')
  await page.reload()
  const before = await prototypeState(request)
  const pid = prototypeServer.pid
  await prototypeServer.restart()
  expect(prototypeServer.pid).not.toBe(pid)
  expect((await request.get(`${base(file.caseId)}/${file.fileId}/download`)).status()).toBe(401)
  await loginPrototypeAPI(request, origin)
  await prototypeLogin(page, '/portal/DEMO-R07?token=demo-DEMO-R07')
  expect(await prototypeState(request)).toEqual(before)
  await exactDownload(request, file, pdf, true)
})

test('P10-CA09 hostile filenames/paths rejected and descriptors/HTML expose no storage keys', async ({ request, page }) => {
  const state = await prototypeState(request)
  const keys = await diskKeys()
  for (const name of ['../outside.pdf', 'folder\\outside.pdf', 'CON.pdf', 'x\r\nInjected.pdf', 'x..pdf']) {
    const response = await upload(request, 'DEMO-R07', pdf, false, state, {}, name)
    expect(response.status(), name).toBe(400)
  }
  for (const key of ['path', 'storageKey', 'actor', 'documentId', 'version']) expect((await upload(request, 'DEMO-R07', pdf, false, state, { [key]: 'outside' })).status()).toBe(400)
  expect(await diskKeys()).toEqual(keys)
  const response = await upload(request, 'DEMO-R07', pdf, false, state, {}, 'muestra-ñ.pdf')
  expect(response.status()).toBe(200)
  const file = (await response.json()).file as PrototypeFileDescriptor
  const dto = JSON.stringify(await listed(request))
  expect(dto).not.toContain('storageKey'); expect(dto).not.toContain('uploadedBy'); expect(dto).not.toContain(prototypeUploadRoot)
  await prototypeLogin(page, '/expedientes/DEMO-R07')
  expect(await page.content()).not.toContain(prototypeUploadRoot)
  const download = await request.get(`${base(file.caseId)}/${file.fileId}/download`)
  expect(download.headers()['content-disposition']).toContain("filename*=UTF-8''muestra-%C3%B1.pdf")
  await exactDownload(request, file, pdf)
})

test('P10-CA10 storage/SQL failures visible, retained selection, rollback and missing blob no substitute', async ({ request, page }) => {
  const state = await prototypeState(request)
  const blocked = resolve(prototypeUploadRoot, state.datasetId)
  await writeFile(blocked, 'not a directory')
  try {
    expect((await upload(request)).status()).toBe(503)
    expect((await prototypeState(request)).revision).toBe(state.revision)
    await prototypeLogin(page, '/expedientes/DEMO-R07')
    await page.getByRole('combobox', { name: 'Tipo de archivo local' }).click()
    await page.getByRole('option', { name: 'Datos fiscales', exact: true }).click()
    await page.getByLabel('Archivo local de muestra').setInputFiles({ name: 'retry.pdf', mimeType: 'application/pdf', buffer: pdf })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Confirmar subida real' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /No se ha guardado|limpieza pendiente/ }).first()).toBeVisible()
    await expect(page.getByText(/retry.pdf ·/)).toBeVisible()
  } finally { await unlink(blocked) }
  const db = prototypeTestPrisma()
  const beforeFiles = await diskKeys()
  try {
    await db.$executeRawUnsafe("ALTER TABLE dbo.PrototypeFile ADD CONSTRAINT PrototypeFilesE2EReject CHECK ([size] = 0)")
    expect((await upload(request)).status()).toBe(503)
    expect((await prototypeState(request)).revision).toBe(state.revision)
    expect(await diskKeys()).toEqual(beforeFiles)
    await command(request, origin, { type: 'set-role', role: 'Socio' })
    await command(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-review', approve: true, note: '' } })
    await command(request, origin, { type: 'set-role', role: 'Profesional' })
    const beforeSend = await prototypeState(request)
    expect((await sendPrototypeCommand(request, origin, { type: 'workflow', caseId: 'DEMO-72003', action: { type: 'ph-send' } })).status()).toBe(503)
    expect(await prototypeState(request)).toEqual(beforeSend)
    expect(await diskKeys()).toEqual(beforeFiles)
  } finally {
    await db.$executeRawUnsafe('ALTER TABLE dbo.PrototypeFile DROP CONSTRAINT PrototypeFilesE2EReject')
    await db.$disconnect()
  }
  const file = (await uploaded(request)).file
  const inspect = prototypeTestPrisma()
  try {
    const row = await inspect.prototypeFile.findUniqueOrThrow({ where: { id: file.fileId! } })
    await unlink(resolve(prototypeUploadRoot, ...row.storageKey.split('\\')))
    const missing = await request.get(`${base(file.caseId)}/${file.fileId}/download`)
    expect(missing.status()).toBe(503); expect((await missing.json()).data.code).toBe('FILE_UNAVAILABLE')
    await page.reload()
    await expect(page.locator('[data-app-ready="true"]')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'FILE_UNAVAILABLE' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Descargar muestra.pdf', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Archivo conocido no disponible' }).first()).toBeVisible()
  } finally { await inspect.$disconnect() }
})

test('P10-CA11 reset cancel preserves, confirm removes IDs; pending cleanup and >=24h reconciliation', async ({ request, page }) => {
  const file = (await uploaded(request)).file
  await prototypeLogin(page, '/expedientes/DEMO-R07')
  const state = await prototypeState(request)
  await page.getByRole('button', { name: 'Reiniciar demo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect(await prototypeState(request)).toEqual(state)
  await exactDownload(request, file, pdf)
  const db = prototypeTestPrisma()
  const row = await db.prototypeFile.findUniqueOrThrow({ where: { id: file.fileId! } })
  const path = resolve(prototypeUploadRoot, ...row.storageKey.split('\\'))
  await unlink(path); await mkdir(path)
  try {
    const reset = await resetPrototypeDemo(request, origin)
    expect(reset.message).toContain('limpieza de archivos pendiente')
    expect(await db.prototypeFile.count()).toBe(0)
    expect((await request.get(`${base(file.caseId)}/${file.fileId}/download`)).status()).toBe(404)
  } finally { await rmdir(path); await writeFile(path, pdf); await db.$disconnect() }
  const originalRoot = process.env.PROTOTYPE_UPLOAD_DIR
  process.env.PROTOTYPE_UPLOAD_DIR = prototypeUploadRoot
  try {
    const active = (await uploaded(request)).file
    const recent = `${state.datasetId}\\${randomUUID()}.tmp`
    await writeFile(resolve(prototypeUploadRoot, ...recent.split('\\')), 'active temporary')
    const yesterday = new Date(Date.now() - 86_400_001)
    await utimes(path, yesterday, yesterday)
    const currentDb = prototypeTestPrisma()
    try {
      const referenced = new Set((await currentDb.prototypeFile.findMany()).map(row => row.storageKey))
      const inspection = await reconcileStoredFiles(referenced)
      expect(inspection.candidates).toContain(row.storageKey)
      expect(inspection.candidates).not.toContain(recent)
      expect(await lstat(path)).toBeTruthy()
      const cleaned = await reconcileStoredFiles(referenced, true)
      expect(cleaned.removed).toContain(row.storageKey)
      await exactDownload(request, active, pdf)
      expect(await readFile(resolve(prototypeUploadRoot, ...recent.split('\\')), 'utf8')).toBe('active temporary')
    } finally { await currentDb.$disconnect(); await unlink(resolve(prototypeUploadRoot, ...recent.split('\\'))) }
  } finally {
    if (originalRoot === undefined) delete process.env.PROTOTYPE_UPLOAD_DIR
    else process.env.PROTOTYPE_UPLOAD_DIR = originalRoot
  }
})

test('P10-CA12 complete R07 real replacement/review and initial 720 both DNI before portal', async ({ request, page }) => {
  const file = (await uploaded(request, 'DEMO-R07', pdf, true)).file
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R07', action: { type: 'deliver-documents' } }, 'DEMO-R07')
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R07', action: { type: 'review-document', id: file.documentId!, valid: true, note: '' } })
  await command(request, origin, { type: 'workflow', caseId: 'DEMO-R07', action: { type: 'complete-documents' } })
  await prototypeLogin(page, '/portal/DEMO-R07?token=demo-DEMO-R07')
  await page.reload()
  expect((await (await request.get('/api/prototype/portal/DEMO-R07?token=demo-DEMO-R07')).json()).case.docsComplete).toBe(true)
  const id = 'DEMO-72001'
  for (const kind of ['DNI anverso', 'DNI reverso']) {
    const response = await upload(request, id, pdf, true, undefined, { kind })
    expect(response.status()).toBe(200)
    await exactDownload(request, (await response.json()).file, pdf, true)
  }
  const item = (await prototypeState(request)).cases.find(item => item.id === id)!
  expect(item.portalSent).toBe(false); expect(item.identity.dni).toBe(false)
  const envelope = { type: 'workflow' as const, caseId: id, action: { type: 'respond' as const, accept: true, consent: false, dniValidUntil: '2030-01-01' } }
  expect((await sendPrototypeCommand(request, origin, envelope, undefined, id)).status()).toBe(422)
  envelope.action.consent = true; envelope.action.dniValidUntil = '2020-01-01'
  expect((await sendPrototypeCommand(request, origin, envelope, undefined, id)).status()).toBe(422)
  envelope.action.dniValidUntil = '2030-01-01'
  await command(request, origin, envelope, id)
  await page.goto(`/portal/${id}?token=demo-${id}`)
  await page.reload()
  expect((await prototypeState(request)).cases.find(item => item.id === id)!.opened).toBe(true)
})

test('P10-CA13 empty isolated installation boots 18 scenarios and real upload/download with documented scripts', async ({ request, page, prototypeServer }) => {
  const db = prototypeTestPrisma()
  try { await db.$transaction([db.prototypeFile.deleteMany(), db.prototypeState.deleteMany(), db.prototypeInstallation.deleteMany()]) }
  finally { await db.$disconnect() }
  await prototypeServer.restart()
  await loginPrototypeAPI(request, origin)
  const state = await prototypeState(request)
  expect(state.revision).toBe(0); expect(state.cases).toHaveLength(18)
  expect(state.cases.filter(item => item.campaign === '720')).toHaveLength(9)
  const file = (await uploaded(request)).file
  await prototypeLogin(page, '/expedientes/DEMO-R07')
  await exactDownload(request, file, pdf)
  const readme = await readFile(resolve('README.md'), 'utf8')
  for (const text of ['pnpm db:generate', 'pnpm db:deploy', 'pnpm dev', 'PROTOTYPE_UPLOAD_DIR', 'RCDRentaE2E', 'files:reconcile']) expect(readme).toContain(text)
})
