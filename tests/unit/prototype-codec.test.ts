import { describe, expect, it } from 'vitest'
import { createSeed } from '../../app/data/seed'
import { decodePrototypePayload, encodePrototypePayload } from '../../server/utils/prototype-codec'
import type { PrototypePayload } from '../../shared/types/prototype'

function payload(): PrototypePayload {
  return { cases: createSeed(), today: '2026-06-12', teams: true, signatureEmail: false,
    documentReminderDays: 3, rolesByPrincipal: { 'Operador áé': 'Socio' } }
}
describe('PRD09 codec', () => {
  it('round trips complete ordered Unicode, optional, null, versions and executions', () => {
    const original = payload()
    original.cases[0]!.ph.note = 'Acentos: áéíóú ñ €'
    expect(decodePrototypePayload(encodePrototypePayload(original), 1)).toEqual(original)
    expect(decodePrototypePayload(encodePrototypePayload({ ...original, cases: [] }), 1).cases).toEqual([])
  })
  it.each([
    ['bad JSON', () => decodePrototypePayload('{', 1)],
    ['unsupported schema', () => decodePrototypePayload(JSON.stringify(payload()), 2)],
    ['duplicate case', () => { const p = payload(); p.cases.push(p.cases[0]!); encodePrototypePayload(p) }],
    ['nonfinite number', () => { const p = payload(); p.cases[0]!.fee = Infinity; encodePrototypePayload(p) }],
    ['invalid version', () => { const p = payload(); p.cases[0]!.ph.approvedVersion = 50; encodePrototypePayload(p) }],
    ['duplicate document version', () => { const p = payload(); const c = p.cases[7]!; c.documents.push({ ...c.documents[0]!, id: 'different' }); encodePrototypePayload(p) }],
    ['invalid date', () => { const p = payload(); p.today = '2026-02-30'; encodePrototypePayload(p) }],
    ['invalid role', () => decodePrototypePayload(JSON.stringify({ ...payload(), rolesByPrincipal: { x: 'admin' } }), 1)],
    ['projected payload', () => decodePrototypePayload(JSON.stringify({ ...payload(), cases: [{ id: 'DEMO-R01' }] }), 1)],
  ])('rejects %s without normalization', (_name, run) => expect(run).toThrow())
})
