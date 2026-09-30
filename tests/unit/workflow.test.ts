import { describe, expect, it } from 'vitest'
import { createSeed, demoAssets } from '../../app/data/seed'
import { currentDocuments, missingKinds, nextTask, runAction } from '../../app/utils/workflow'
import { daysBetween, stage } from '../../app/utils/format'
import type { CaseFile, Role, WorkflowAction } from '../../app/types/domain'

const now = '2026-06-12'
function seed(id: string): CaseFile { return createSeed().find(item => item.id === id)! }
function act(item: CaseFile, action: WorkflowAction, role: Role = 'Profesional', date = now) { return runAction(item, action, role, date) }
function blocked(item: CaseFile, action: WorkflowAction, role: Role = 'Profesional', date = now) {
  const before = structuredClone(item)
  const result = act(item, action, role, date)
  expect(result.ok).toBe(false)
  expect(result.message.length).toBeGreaterThan(0)
  expect(item).toEqual(before)
}

describe('P01 · aislamiento y escenarios', () => {
  it('contiene los 18 escenarios, 9 por servicio, y un cliente con ambos', () => {
    const cases = createSeed()
    expect(cases).toHaveLength(18)
    expect(new Set(cases.map(item => item.id)).size).toBe(18)
    expect(cases.filter(item => item.campaign === 'Renta')).toHaveLength(9)
    expect(cases.filter(item => item.campaign === '720')).toHaveLength(9)
    expect(cases.filter(item => item.name === 'Clara Martínez').map(item => item.campaign)).toEqual(['Renta', '720'])
  })
  it('mutación de un caso no afecta otros y genera un solo evento trazable', () => {
    const cases = createSeed(); const before = structuredClone(cases.slice(1))
    expect(act(cases[0]!, { type: 'remind' }).ok).toBe(true)
    expect(cases.slice(1)).toEqual(before)
    expect(cases[0]!.history[0]).toMatchObject({ role: 'Profesional', date: now })
    expect(cases[0]!.history[0]!.before).not.toBe(cases[0]!.history[0]!.after)
  })
  it('bloquea rol incorrecto sin mutar estado y el cliente no puede revisar', () => {
    blocked(seed('DEMO-72003'), { type: 'ph-review', approve: true, note: '' }, 'Cliente')
  })
  it('semillas nuevas son independientes y retirada se clasifica descartada', () => {
    const first = createSeed(); first[0]!.name = 'Editado'
    expect(createSeed()[0]!.name).toBe('Clara Martínez')
    expect(stage(seed('DEMO-R03'))).toBe('Descartado')
  })
})

describe('P02 · captación 7 + 3', () => {
  it('recordatorio a 7 días, no a 6, y llamada al tercer día adicional, sin duplicados', () => {
    const item = seed('DEMO-R01')
    blocked(item, { type: 'remind' }, 'Profesional', '2026-06-08')
    expect(act(item, { type: 'remind' }, 'Profesional', '2026-06-09').ok).toBe(true)
    blocked(item, { type: 'remind' }, 'Profesional', '2026-06-10')
    blocked(item, { type: 'call' }, 'Profesional', '2026-06-11')
    expect(act(item, { type: 'call' }).ok).toBe(true)
    blocked(item, { type: 'call' })
    expect(daysBetween('2026-06-09', now)).toBe(3)
  })
  it('consentimiento y datos obligatorios; aceptación es única, no envía PH', () => {
    const item = seed('DEMO-R01')
    blocked(item, { type: 'respond', accept: true, rentaType: 'Individual', presenter: 'Cliente', fee: 150 }, 'Cliente')
    blocked(item, { type: 'respond', accept: true, consent: true }, 'Cliente')
    expect(act(item, { type: 'respond', accept: true, consent: true, rentaType: 'Individual', presenter: 'Cliente', fee: 150 }, 'Cliente').ok).toBe(true)
    expect(item.opened).toBe(true); expect(item.ph.state).toBe('Borrador'); expect(item.ph.sentAt).toBeNull()
    blocked(item, { type: 'respond', accept: true, consent: true }, 'Cliente')
    blocked(item, { type: 'remind' })
  })
  it('negativa agradece y detiene seguimiento', () => {
    const item = seed('DEMO-R01')
    expect(act(item, { type: 'respond', accept: false }, 'Cliente').message).toContain('Agradecimiento')
    blocked(item, { type: 'remind' })
  })
  it('720 exige ambas caras y vigencia: subir no valida identidad', () => {
    const item = seed('DEMO-72001')
    const respond: WorkflowAction = { type: 'respond', accept: true, consent: true, dniValidUntil: '2030-01-01' }
    blocked(item, respond, 'Cliente')
    expect(act(item, { type: 'add-document', kind: 'DNI anverso', name: 'a.pdf', size: 1 }, 'Cliente').ok).toBe(true)
    blocked(item, respond, 'Cliente')
    expect(act(item, { type: 'add-document', kind: 'DNI reverso', name: 'b.jpg', size: 1 }, 'Cliente').ok).toBe(true)
    blocked(item, { ...respond, dniValidUntil: '2020-01-01' }, 'Cliente')
    expect(act(item, respond, 'Cliente').ok).toBe(true)
    expect(item.identity.dni).toBe(false)
  })
  it('invitación no duplicable mismo día ni permitida con PH previa', () => {
    const item = seed('DEMO-R01')
    expect(act(item, { type: 'invite' }, 'Gestor de campañas').ok).toBe(true)
    blocked(item, { type: 'invite' }, 'Gestor de campañas')
    blocked(seed('DEMO-72002'), { type: 'invite' })
  })
  it('sin responsable abre pero no inventa notificación y admite asignación', () => {
    const item = seed('DEMO-R01'); item.owner = ''
    const result = act(item, { type: 'respond', accept: true, consent: true, rentaType: 'Individual', presenter: 'RCD', fee: 150 }, 'Cliente')
    expect(result.ok).toBe(true); expect(result.message).toContain('Falta asignar')
    expect(act(item, { type: 'assign', owner: 'Lucía Torres' }).ok).toBe(true)
  })
})

describe('P03 · PH versionada, envío manual, firma', () => {
  it('revisión socio no envía; modificación invalida; envío y firma separados', () => {
    const item = seed('DEMO-72003')
    blocked(item, { type: 'ph-send' })
    expect(act(item, { type: 'ph-review', approve: true, note: '' }, 'Socio').ok).toBe(true)
    expect(item.ph.sentAt).toBeNull()
    expect(act(item, { type: 'ph-edit', note: 'Cambio de alcance', fee: 500 }, 'Socio').ok).toBe(true)
    expect(item.ph.version).toBe(2); expect(item.ph.approvedVersion).toBeNull()
    expect(act(item, { type: 'ph-submit' }).ok).toBe(true)
    expect(act(item, { type: 'ph-review', approve: true, note: '' }, 'Socio').ok).toBe(true)
    expect(act(item, { type: 'ph-send' }).ok).toBe(true)
    blocked(item, { type: 'ph-send' })
    expect(act(item, { type: 'ph-sign' }, 'Cliente').ok).toBe(true)
    expect(item.ph.signedVersion).toBe(2); expect(item.identity.authorization).toBe(false)
    expect(item.history[0]!.text).toContain('solicitud de alta')
  })
  it('rechazo negociable no retira ni firma; retirada requiere motivo', () => {
    const item = seed('DEMO-72003'); item.ph.state = 'Enviada'
    blocked(item, { type: 'ph-reject', note: '' }, 'Cliente')
    expect(act(item, { type: 'ph-reject', note: 'Honorarios altos' }, 'Cliente').ok).toBe(true)
    expect(item.contact).toBe('Aceptado')
    blocked(item, { type: 'withdraw', note: '' }, 'Cliente')
    expect(act(item, { type: 'withdraw', note: 'No continuar' }, 'Cliente').ok).toBe(true)
    blocked(item, { type: 'ph-edit', note: 'Cambio', fee: 100 })
  })
  it('llamada firma exactamente a 3 días y solo una vez', () => {
    const item = seed('DEMO-72003'); item.ph.state = 'Enviada'; item.ph.sentAt = '2026-06-09'
    blocked(item, { type: 'ph-call' }, 'Profesional', '2026-06-11')
    expect(act(item, { type: 'ph-call' }).ok).toBe(true)
    blocked(item, { type: 'ph-call' })
    expect(act(item, { type: 'ph-remind' }).ok).toBe(true)
    blocked(item, { type: 'ph-remind' })
    expect(act(item, { type: 'ph-sign' }, 'Cliente').ok).toBe(false)
  })
  it('resultado sin contacto no firma ni cierra y PH previa no se duplica', () => {
    const item = seed('DEMO-72003')
    expect(act(item, { type: 'contact-outcome', outcome: 'Sin contacto', note: 'Intento' }).ok).toBe(true)
    expect(item.ph.state).toBe('En revisión'); expect(item.tax.state).toBe('Pendiente')
    blocked(seed('DEMO-72002'), { type: 'ph-edit', note: 'Nueva', fee: 500 })
  })
})

describe('P04 · identidad, PBC, NAV', () => {
  it('DNI vencido mantiene bloqueo; fecha válida y dos caras permiten revisión', () => {
    const item = seed('DEMO-R04')
    expect(act(item, { type: 'request-identity' }).ok).toBe(true)
    blocked(item, { type: 'identity', field: 'dni', value: true, validUntil: '2025-12-31' })
    blocked(item, { type: 'identity', field: 'dni', value: true, validUntil: '2030-02-31' })
    expect(act(item, { type: 'identity', field: 'dni', value: true, validUntil: '2030-12-31' }).ok).toBe(true)
    expect(item.identity.certificate).toBe(false); expect(item.identity.authorization).toBe(false)
  })
  it('PBC pendiente/incidencia bloquea alta; resolución humana con nota habilita NAV manual', () => {
    const item = seed('DEMO-R06')
    blocked(item, { type: 'nav-register', reference: 'NAV-1' }, 'Altas')
    blocked(item, { type: 'pbc-decide', state: 'Apto', note: '' }, 'PBC')
    expect(act(item, { type: 'pbc-decide', state: 'Apto', note: 'Coincidencia descartada' }, 'PBC').ok).toBe(true)
    blocked(item, { type: 'nav-register', reference: 'NAV-1' })
    expect(act(item, { type: 'nav-register', reference: 'NAV-1' }, 'Altas').ok).toBe(true)
    expect(item.history[0]!.text).toContain('Aviso al paralegal')
    expect(act(item, { type: 'portal-send' }).ok).toBe(true)
    expect(item.identity.authorization).toBe(false)
  })
  it('bloquea presentación RCD sin autorización aunque certificado disponible', () => {
    const item = seed('DEMO-R05')
    blocked(item, { type: 'present', receipt: 'REF', date: now })
    expect(act(item, { type: 'identity', field: 'authorization', value: true }).ok).toBe(true)
    expect(act(item, { type: 'present', receipt: 'REF', date: now }).ok).toBe(true)
  })
})

describe('P05 · documentos y entregas', () => {
  it.each([
    { kind: '', name: 'a.pdf', size: 1 },
    { kind: 'Datos fiscales', name: 'a.exe', size: 1 },
    { kind: 'Datos fiscales', name: 'a.pdf', size: 10_000_001 },
    { kind: 'Datos fiscales', name: 'a.pdf', size: 0 },
  ])('rechaza metadata inválida %o sin alterar', data => blocked(seed('DEMO-R07'), { type: 'add-document', ...data }, 'Cliente'))
  it('10 MB exactos admitidos; versiones y entrega explícita, faltantes bloquean completitud', () => {
    const item = seed('DEMO-R07')
    expect(act(item, { type: 'add-document', kind: 'Datos fiscales', name: 'datos.xlsx', size: 10_000_000 }, 'Cliente').ok).toBe(true)
    expect(item.delivered).toBe(false); expect(item.docsComplete).toBe(false)
    expect(currentDocuments(item).find(doc => doc.kind === 'Datos fiscales')!.version).toBe(2)
    blocked(item, { type: 'complete-documents' })
    const id = currentDocuments(item).find(doc => doc.kind === 'Datos fiscales')!.id
    blocked(item, { type: 'review-document', id, valid: true, note: '' })
    expect(act(item, { type: 'deliver-documents' }, 'Cliente').ok).toBe(true)
    blocked(item, { type: 'review-document', id, valid: false, note: '' })
    expect(act(item, { type: 'review-document', id, valid: true, note: '' }).ok).toBe(true)
    expect(act(item, { type: 'complete-documents' }).ok).toBe(true)
    expect(missingKinds(item)).toEqual([])
    expect(item.documents.filter(doc => doc.kind === 'Datos fiscales')).toHaveLength(2)
  })
  it('sustituir tras presentación no borra justificante o estado presentado', () => {
    const item = seed('DEMO-72009')
    expect(act(item, { type: 'add-document', kind: 'Bienes en el extranjero', name: 'nuevo.pdf', size: 100 }).ok).toBe(true)
    expect(item.tax.state).toBe('Presentado'); expect(item.tax.receipt).toBe('720-DEMO-009')
    expect(item.docsComplete).toBe(false)
  })
  it('recordatorio incluye faltantes, solo una vez y se detiene tras completitud', () => {
    const item = seed('DEMO-R07')
    expect(act(item, { type: 'docs-remind', afterDays: 3 }).message).toContain('Datos fiscales')
    blocked(item, { type: 'docs-remind', afterDays: 3 })
    const ready = seed('DEMO-R08')
    blocked(ready, { type: 'docs-remind', afterDays: 3 })
  })
})

describe('P06 · Renta completa', () => {
  it('preparación sin completitud bloqueada; cambios conservan versiones y requieren acuerdo vigente', () => {
    blocked(seed('DEMO-R07'), { type: 'tax-draft' })
    const item = seed('DEMO-R08')
    expect(act(item, { type: 'tax-respond', accept: false, note: 'Corregir domicilio' }, 'Cliente').ok).toBe(true)
    expect(act(item, { type: 'tax-draft' }).ok).toBe(true)
    expect(item.tax.version).toBe(2); expect(item.tax.drafts).toHaveLength(2)
    expect(act(item, { type: 'tax-send' }).ok).toBe(true)
    blocked(item, { type: 'present', receipt: 'REF', date: now })
    expect(act(item, { type: 'tax-respond', accept: true, note: '' }, 'Cliente').ok).toBe(true)
    expect(act(item, { type: 'tax-draft' }).ok).toBe(true)
    expect(item.tax.acceptedVersion).toBeNull()
    blocked(item, { type: 'present', receipt: 'REF', date: now })
  })
  it('RCD presenta una vez, exige fecha real del demo; justificante y factura para cerrar', () => {
    const item = seed('DEMO-R08')
    expect(act(item, { type: 'tax-respond', accept: true, note: '' }, 'Cliente').ok).toBe(true)
    blocked(item, { type: 'present', receipt: 'REF', date: '2026-06-13' })
    blocked(item, { type: 'present', receipt: '', date: now })
    expect(act(item, { type: 'present', receipt: 'REF', date: now }).ok).toBe(true)
    blocked(item, { type: 'present', receipt: 'REF', date: now })
    blocked(item, { type: 'close' })
    expect(act(item, { type: 'invoice', number: 'DEMO-001' }, 'Administrativo').ok).toBe(true)
    expect(act(item, { type: 'invoice-send' }, 'Administrativo').ok).toBe(true)
    blocked(item, { type: 'close' })
    expect(act(item, { type: 'receipt-send' }).ok).toBe(true)
    expect(act(item, { type: 'close' }).ok).toBe(true)
    expect(item.tax.state).toBe('Cerrado'); expect('paid' in item.invoice).toBe(false)
    blocked(item, { type: 'tax-draft' })
  })
  it('cliente presenta sin certificado RCD, cierra sin envío de justificante RCD', () => {
    const item = seed('DEMO-R09')
    blocked(item, { type: 'present', receipt: 'CLIENTE-REF', date: now })
    expect(act(item, { type: 'present', receipt: 'CLIENTE-REF', date: now }, 'Cliente').ok).toBe(true)
    blocked(item, { type: 'receipt-send' })
    expect(act(item, { type: 'invoice', number: 'DEMO-CLIENTE' }).ok).toBe(true)
    expect(act(item, { type: 'invoice-send' }).ok).toBe(true)
    expect(act(item, { type: 'close' }).ok).toBe(true)
    expect(item.identity.certificate).toBe(false)
  })
})

describe('P07 · 720 extracción, Criteria y cierre', () => {
  it('bloquea pendientes; fallo no produce filas válidas y IT no valida', () => {
    blocked(seed('DEMO-72006'), { type: 'extract', fail: false })
    const item = seed('DEMO-72007')
    expect(act(item, { type: 'extract', fail: true }).ok).toBe(true)
    expect(item.extraction.rows).toEqual([])
    blocked(item, { type: 'criteria', reference: 'REF', date: now })
    blocked(item, { type: 'it-resolve', note: '' }, 'IT')
    expect(act(item, { type: 'it-resolve', note: 'Parser ajustado' }, 'IT').ok).toBe(true)
    expect(item.extraction.state).toBe('Pendiente')
    expect(act(item, { type: 'extract', fail: false }).ok).toBe(true)
    expect(item.extraction.version).toBe(3)
    expect(item.extraction.runs).toHaveLength(3)
    blocked(item, { type: 'extract', fail: false })
  })
  it('desviación descriptiva no es PBC y bloquea carga', () => {
    const item = seed('DEMO-72008')
    blocked(item, { type: 'it-report', note: '' })
    expect(act(item, { type: 'it-report', note: 'Fila sin origen' }).ok).toBe(true)
    expect(item.pbc).toBe('Apto')
    blocked(item, { type: 'criteria', reference: 'REF', date: now })
  })
  it('Excel validado no carga automáticamente; nueva versión invalida carga', () => {
    const item = seed('DEMO-72008')
    expect(act(item, { type: 'criteria', reference: 'CR-001', date: now }).ok).toBe(true)
    expect(act(item, { type: 'extract', fail: false }).ok).toBe(true)
    expect(item.extraction.criteriaVersion).toBeUndefined()
    blocked(item, { type: 'present', receipt: 'REF', date: now })
    expect(act(item, { type: 'extraction-review', rows: demoAssets() }).ok).toBe(true)
    expect(item.extraction.state).toBe('Revisado')
    expect(act(item, { type: 'criteria', reference: 'CR-002', date: now }).ok).toBe(true)
    expect(act(item, { type: 'present', receipt: '720-REF', date: now }).ok).toBe(true)
    blocked(item, { type: 'present', receipt: '720-REF', date: now })
  })
  it('PH previa puede completarse sin nueva PH ni alta, con confirmación explícita', () => {
    const item = seed('DEMO-72002')
    expect(item.pbc).toBe('Antecedente no confirmado'); expect(item.nav).toBe('')
    expect(act(item, { type: 'prior-confirm', note: 'Antecedentes históricos comprobados' }).ok).toBe(true)
    for (const kind of ['DNI anverso', 'DNI reverso', 'Bienes en el extranjero']) expect(act(item, { type: 'add-document', kind, name: 'demo.pdf', size: 10 }, 'Cliente').ok).toBe(true)
    expect(act(item, { type: 'deliver-documents' }, 'Cliente').ok).toBe(true)
    for (const doc of currentDocuments(item)) expect(act(item, { type: 'review-document', id: doc.id, valid: true, note: '' }).ok).toBe(true)
    expect(act(item, { type: 'complete-documents' }).ok).toBe(true)
    expect(act(item, { type: 'extract', fail: false }).ok).toBe(true)
    expect(act(item, { type: 'extraction-review', rows: demoAssets() }).ok).toBe(true)
    expect(act(item, { type: 'criteria', reference: 'CR-PREVIA', date: now }).ok).toBe(true)
    expect(act(item, { type: 'identity', field: 'certificate', value: true }).ok).toBe(true)
    expect(act(item, { type: 'identity', field: 'authorization', value: true }).ok).toBe(true)
    expect(act(item, { type: 'present', receipt: '720-PREVIA', date: now }).ok).toBe(true)
    expect(item.nav).toBe(''); expect(item.ph.version).toBe(0)
  })
  it('cierre 720 exige ambos envíos y no marca cobro', () => {
    const item = seed('DEMO-72009')
    blocked(item, { type: 'close' })
    expect(act(item, { type: 'receipt-send' }).ok).toBe(true)
    expect(act(item, { type: 'invoice', number: 'DEMO-720' }).ok).toBe(true)
    expect(act(item, { type: 'invoice-send' }).ok).toBe(true)
    expect(act(item, { type: 'close' }).ok).toBe(true)
    expect(nextTask(item, now)).toBe('Sin tareas pendientes')
  })
})
