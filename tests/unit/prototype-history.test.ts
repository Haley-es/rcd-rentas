import { describe, expect, it } from 'vitest'
import { changedHistoryFields, canManageDeletedCases } from '../../shared/utils/prototype-history'
import { collectPrototypeChanges } from '../../server/services/prototype-history'
import { applyPrototypeCommand } from '../../server/services/prototype-commands'
import { newPrototypePayload, type StoredPrototypeState } from '../../server/services/prototype-store'
import { assertCommandEnvelope } from '../../shared/utils/prototype-validation'

function state(): StoredPrototypeState {
  return { ...newPrototypePayload(), schemaVersion: 1, revision: 12, datasetId: crypto.randomUUID() }
}
describe('transactional change history', () => {
  it('captures exact nested changes and document versions, excluding activity noise', () => {
    const before = state()
    const after = structuredClone(before)
    const item = after.cases[0]!
    item.owner = 'Otro profesional'
    item.identity.dni = true
    item.documents.push({ id: 'doc-new', kind: 'DNI anverso', version: 1, state: 'Enviado', name: 'muestra.pdf', size: 5, note: '' })
    item.history.push({ date: before.today, role: 'Profesional', text: 'Actividad' })
    const [entry] = collectPrototypeChanges(before, after, 'operador', 'Profesional')
    expect(entry).toMatchObject({ recordId: item.id, revision: 13, operation: 'UPDATE', changedBy: 'operador', changedRole: 'Profesional' })
    expect(JSON.parse(entry!.changes)).toEqual({ owner: { old: before.cases[0]!.owner, new: 'Otro profesional' },
      'identity.dni': { old: false, new: true }, documents: { old: [], new: item.documents } })
    expect(changedHistoryFields(before.cases[0]!, { ...before.cases[0]!, history: item.history })).toEqual({})
  })
  it('retains the exact deleted snapshot and marks restoration independently', () => {
    const before = state()
    const after = structuredClone(before)
    applyPrototypeCommand(after, { type: 'delete-case', caseId: before.cases[0]!.id, confirm: true }, 'x')
    const [entry] = collectPrototypeChanges(before, after, 'x', 'Profesional')
    expect(entry!.operation).toBe('DELETE')
    expect(JSON.parse(entry!.snapshot!)).toEqual(before.cases[0])
    const restored = collectPrototypeChanges(after, before, 'socio', 'Socio', true)
    expect(restored[0]!.operation).toBe('RESTORE')
    expect(restored[0]!.recordId).toBe(before.cases[0]!.id)
  })
  it('rejects unsafe commands and deletion by unauthorized roles or portals', () => {
    for (const role of ['Cliente', 'IT', 'PBC', 'Altas', 'Administrativo', 'Paralegal'] as const) {
      const current = state()
      current.rolesByPrincipal.x = role
      expect(canManageDeletedCases(role)).toBe(false)
      expect(() => applyPrototypeCommand(current, { type: 'delete-case', caseId: 'DEMO-R01', confirm: true }, 'x')).toThrow()
      expect(current.cases).toHaveLength(18)
    }
    const envelope = { datasetId: crypto.randomUUID(), expectedRevision: 0 }
    for (const command of [{ type: 'delete-case', caseId: 'DEMO-R01', confirm: false },
      { type: 'restore-case', historyId: 'bad-id', confirm: true }, { type: 'restore-case', historyId: crypto.randomUUID(), confirm: false }]) {
      expect(() => assertCommandEnvelope({ ...envelope, command })).toThrow()
    }
    expect(() => applyPrototypeCommand(state(), { type: 'delete-case', caseId: 'DEMO-R01', confirm: true }, 'x',
      { caseId: 'DEMO-R01', token: 'demo-DEMO-R01' })).toThrow()
  })
  it('does not record role preferences or untouched cases', () => {
    const before = state()
    const after = structuredClone(before)
    after.rolesByPrincipal.x = 'Socio'
    expect(collectPrototypeChanges(before, after, 'x', 'Profesional')).toEqual([])
    after.teams = false
    const rows = collectPrototypeChanges(before, after, 'x', 'Profesional')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.tableName).toBe('ajustes')
    expect(JSON.parse(rows[0]!.changes)).toEqual({ teams: { old: true, new: false } })
  })
})
