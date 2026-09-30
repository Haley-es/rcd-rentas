import { describe, expect, it } from 'vitest'
import { assertCommandEnvelope, workflowFields } from '../../shared/utils/prototype-validation'
import { applyPrototypeCommand } from '../../server/services/prototype-commands'
import { newPrototypePayload, type StoredPrototypeState } from '../../server/services/prototype-store'
import { projectPrototypePortal } from '../../server/services/prototype-portal'

function state(): StoredPrototypeState {
  return { ...newPrototypePayload(), schemaVersion: 1, revision: 0, datasetId: crypto.randomUUID() }
}
describe('PRD09 commands', () => {
  it('validates all 40 discriminants and rejects malformed envelopes', () => {
    expect(Object.keys(workflowFields)).toHaveLength(40)
    for (const command of [
      { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'assign', owner: 123 } },
      { type: 'set-settings', documentReminderDays: 0 }, { type: 'set-settings', documentReminderDays: 31 },
      { type: 'set-settings', documentReminderDays: 1.5 }, { type: 'reset-demo', confirm: false },
      { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'invite', actor: 'Socio' } },
      { type: 'advance-days', days: -1 }, { type: 'set-role', role: 'admin' },
    ]) expect(() => assertCommandEnvelope({ datasetId: crypto.randomUUID(), expectedRevision: 0, command })).toThrow()
  })
  it('batches preserve successful events and per-case failures without global success', () => {
    const s = state()
    const result = applyPrototypeCommand(s, { type: 'invite-many', caseIds: ['DEMO-R01', 'DEMO-72002', 'DEMO-R03'] }, 'x')
    expect(result.changed).toBe(true)
    expect(result.result).toMatchObject({ ok: false, applied: 1 })
    expect(result.result.results?.map(result => result.ok)).toEqual([true, false, false])
  })
  it('roles are principal-scoped, including prototype-named usernames', () => {
    const s = state()
    applyPrototypeCommand(s, { type: 'set-role', role: 'Socio' }, '__proto__')
    expect(Object.hasOwn(s.rolesByPrincipal, '__proto__')).toBe(true)
    expect(s.rolesByPrincipal.__proto__).toBe('Socio')
    expect(s.rolesByPrincipal.other).toBeUndefined()
  })
  it('portal excludes all internal notes, histories and other cases', () => {
    const s = state()
    const dto = projectPrototypePortal(s, { caseId: 'DEMO-72002', token: 'demo-DEMO-72002' }, 'x')
    const json = JSON.stringify(dto)
    for (const key of ['pbcNote', 'nav', 'extraction', 'history', 'scenario', 'segment', 'rolesByPrincipal']) expect(json).not.toContain(`"${key}"`)
    expect(json).not.toContain('DEMO-R01')
    expect(dto.case.ph).not.toHaveProperty('note')
    expect(dto.case.tax).not.toHaveProperty('note')
  })
  it('portal denies other IDs and internal actions before workflow', () => {
    for (const command of [
      { type: 'workflow', caseId: 'DEMO-R06', action: { type: 'pbc-decide', state: 'Apto', note: 'x' } },
      { type: 'workflow', caseId: 'DEMO-R01', action: { type: 'invite' } },
    ] as const) {
      expect(() => applyPrototypeCommand(state(), command, 'x', { caseId: 'DEMO-R06', token: 'demo-DEMO-R06' })).toThrow()
    }
  })
})
