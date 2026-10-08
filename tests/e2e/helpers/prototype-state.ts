import { PrismaClient } from '@prisma/client'
import { expect, type APIRequestContext } from '@playwright/test'
import { prototypeTestDatabaseURL } from '../../../scripts/prototype-e2e.mjs'
import type { CommandEnvelope, PrototypeCommand, PrototypeCommandResult, PrototypeSnapshot } from '../../../shared/types/prototype'
import { decodePrototypePayload } from '../../../server/utils/prototype-codec'

export function prototypeTestPrisma() {
  return new PrismaClient({ datasourceUrl: prototypeTestDatabaseURL(), errorFormat: 'minimal', log: [] })
}
export async function loginPrototypeAPI(request: APIRequestContext, origin: string, username = 'operador demo', password = '!') {
  expect((await request.post('/api/auth/login', { headers: { Origin: origin }, data: { username, password } })).status()).toBe(200)
  expect((await request.post('/api/auth/mfa', { headers: { Origin: origin }, data: { code: 'texto' } })).status()).toBe(200)
}
export async function prototypeState(request: APIRequestContext): Promise<PrototypeSnapshot> {
  const response = await request.get('/api/prototype/state')
  expect(response.status()).toBe(200)
  return response.json()
}
export async function sendPrototypeCommand(request: APIRequestContext, origin: string, command: PrototypeCommand,
  state?: Pick<PrototypeSnapshot, 'datasetId' | 'revision'>, portalId?: string) {
  const current = state ?? await prototypeState(request)
  const envelope: CommandEnvelope = { datasetId: current.datasetId, expectedRevision: current.revision, command }
  return request.post(portalId ?
    `/api/prototype/portal/${portalId}/commands?token=demo-${portalId}` : '/api/prototype/commands', {
    headers: { Origin: origin }, data: envelope,
  })
}
export async function confirmedPrototypeCommand(request: APIRequestContext, origin: string, command: PrototypeCommand,
  portalId?: string): Promise<PrototypeCommandResult> {
  const response = command.type === 'workflow' && command.action.type === 'add-document' ?
    await request.post(`/api/prototype/${portalId ? 'portal' : 'cases'}/${command.caseId}/files${portalId ? `?token=demo-${portalId}` : ''}`, {
      headers: { Origin: origin }, multipart: {
        file: { name: command.action.name, mimeType: 'application/pdf', buffer: Buffer.alloc(command.action.size, 65) },
        kind: command.action.kind, datasetId: (await prototypeState(request)).datasetId,
        expectedRevision: String((await prototypeState(request)).revision),
      },
    }) : await sendPrototypeCommand(request, origin, command, undefined, portalId)
  expect(response.status(), await response.text()).toBe(200)
  const result: PrototypeCommandResult = await response.json()
  expect(result.ok, result.message).toBe(true)
  return result
}
export async function resetPrototypeDemo(request: APIRequestContext, origin: string) {
  let response = await request.get('/api/prototype/state')
  if (response.status() === 403) {
    response = await request.get('/api/prototype/portal/DEMO-R08?token=demo-DEMO-R08')
    expect(response.status()).toBe(200)
    await confirmedControlRole(request, origin, await response.json())
    response = await request.get('/api/prototype/state')
  }
  expect(response.status()).toBe(200)
  const state: PrototypeSnapshot = await response.json()
  const reset = await sendPrototypeCommand(request, origin, { type: 'reset-demo', confirm: true }, state)
  expect(reset.status(), await reset.text()).toBe(200)
  return reset.json() as Promise<PrototypeCommandResult>
}
async function confirmedControlRole(request: APIRequestContext, origin: string, state: PrototypeSnapshot) {
  const response = await sendPrototypeCommand(request, origin, { type: 'set-role', role: 'Profesional' }, state)
  expect(response.status()).toBe(200)
}
export async function inspectPrototypeDatabase() {
  const db = prototypeTestPrisma()
  try {
    const installation = await db.prototypeInstallation.findUniqueOrThrow({ where: { id: 1 } })
    const state = await db.prototypeState.findUniqueOrThrow({ where: { id: 1 } })
    return { installation, state, payload: decodePrototypePayload(state.payload, state.schemaVersion) }
  } finally { await db.$disconnect() }
}
