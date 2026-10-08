import { documentKinds, roles, type WorkflowAction } from '../../app/types/domain'
import type { CommandEnvelope, PrototypePayload } from '../types/prototype'

type Validator = (value: unknown, path: string) => void
type Shape = Record<string, Validator>
export class PrototypeValidationError extends Error {}
function invalid(path: string): never { throw new PrototypeValidationError(`Valor inválido: ${path}.`) }
export const text: Validator = (v, p) => { if (typeof v !== 'string' || v.length > 100_000) invalid(p) }
const id: Validator = (v, p) => { text(v, p); if (typeof v !== 'string' || !v.trim() || v.length > 200) invalid(p) }
const bool: Validator = (v, p) => { if (typeof v !== 'boolean') invalid(p) }
const number = (min: number, max = Number.MAX_SAFE_INTEGER, integer = false): Validator => (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || integer && !Number.isSafeInteger(v)) invalid(p)
}
const uint = number(0, 2_147_483_646, true)
const positive = number(1, 2_147_483_646, true)
export const date: Validator = (v, p) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) invalid(p)
}
const enumeration = (values: readonly unknown[]): Validator => (v, p) => { if (!values.includes(v)) invalid(p) }
const optional = (check: Validator): Validator => (v, p) => { if (v !== undefined) check(v, p) }
const nullable = (check: Validator): Validator => (v, p) => { if (v !== null) check(v, p) }
const array = (check: Validator): Validator => (v, p) => {
  if (!Array.isArray(v) || v.length > 10_000) invalid(p)
  v.forEach((entry, i) => check(entry, `${p}[${i}]`))
}
export function record(v: unknown, p: string): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) invalid(p)
}
function object(shape: Shape): Validator {
  return (v, p) => {
    record(v, p)
    if (Object.keys(v).some(key => !Object.hasOwn(shape, key))) invalid(p)
    for (const [key, check] of Object.entries(shape)) check(v[key], `${p}.${key}`)
  }
}
const role = enumeration(roles)
const asset = object({ id, category: text, country: text, entity: text, value: number(0), origin: optional(text), observation: optional(text) })
const document = object({ id, kind: enumeration(documentKinds), name: id, version: positive,
  state: enumeration(['Pendiente', 'Enviado', 'Válido', 'Sustituir']), note: text, size: number(1, 10_000_000, true) })
export const caseFile = object({
  id, name: id, email: id, campaign: enumeration(['Renta', '720']), segment: text, owner: text, scenario: text,
  opened: bool, contact: enumeration(['Sin respuesta', 'Recordatorio', 'Llamada pendiente', 'Aceptado', 'No interesado', 'Retirado']),
  contactedAt: date, reminderAt: nullable(date), rentaType: enumeration(['Individual', 'Conjunta']),
  presenter: enumeration(['RCD', 'Cliente']), fee: number(0),
  ph: object({ state: enumeration(['No necesaria', 'Borrador', 'En revisión', 'Cambios solicitados', 'Aprobada', 'Enviada', 'Firmada', 'Rechazada']),
    version: uint, approvedVersion: nullable(uint), signedVersion: nullable(uint), sentAt: nullable(date),
    note: text, prior: bool, followupAt: optional(date), priorConfirmed: optional(bool) }),
  identity: object({ dni: bool, certificate: bool, authorization: bool, dniValidUntil: optional(date) }),
  pbc: enumeration(['Pendiente', 'En revisión', 'Incidencia', 'Apto', 'No apto', 'Antecedente no confirmado']),
  pbcNote: text, nav: text, portalSent: bool, documents: array(document), delivered: bool, docsComplete: bool,
  docsRequestedAt: optional(date), docsReminderKey: optional(text),
  tax: object({ state: enumeration(['Pendiente', 'Borrador', 'En revisión cliente', 'Cambios solicitados', 'Aceptado', 'Presentado', 'Cerrado']),
    version: uint, acceptedVersion: nullable(uint), note: text, receipt: text, receiptSent: bool,
    presentationDate: optional(date), drafts: optional(array(object({ version: positive, date, note: text }))) }),
  extraction: object({ state: enumeration(['Pendiente', 'Extraído', 'Incidencia IT', 'Revisado', 'Cargado en Criteria']),
    rows: array(asset), note: text, version: optional(positive), criteriaVersion: optional(positive), criteriaDate: optional(date),
    runs: optional(array(object({ version: positive, date, inputs: array(text), failed: bool }))) }),
  invoice: object({ number: text, amount: number(0), sent: bool }),
  history: array(object({ date, role, text, before: optional(text), after: optional(text) })),
})
const roleMap: Validator = (v, p) => {
  record(v, p)
  for (const [username, value] of Object.entries(v)) {
    if (!username.trim() || username !== username.trim()) invalid(p)
    role(value, p)
  }
}
const payload = object({ cases: array(caseFile), today: date, teams: bool, signatureEmail: bool,
  documentReminderDays: number(1, 30, true), rolesByPrincipal: roleMap })

function unique(values: string[], path: string) {
  if (new Set(values).size !== values.length) invalid(path)
}
export function assertPrototypePayload(value: unknown): asserts value is PrototypePayload {
  payload(value, 'payload')
  // Structural checks above precede reference checks; no snapshot is accepted by assertion alone.
  const checked = value as PrototypePayload
  unique(checked.cases.map(item => item.id), 'cases.id')
  for (const item of checked.cases) {
    unique(item.documents.map(doc => doc.id), `${item.id}.documents.id`)
    unique(item.documents.map(doc => `${doc.kind}:${doc.version}`), `${item.id}.documents.version`)
    unique(item.extraction.rows.map(row => row.id), `${item.id}.rows.id`)
    for (const version of [item.ph.approvedVersion, item.ph.signedVersion]) {
      if (version !== null && version > item.ph.version) invalid(`${item.id}.ph.version`)
    }
    if (item.tax.acceptedVersion !== null && item.tax.acceptedVersion > item.tax.version) invalid(`${item.id}.tax.version`)
    if ((item.extraction.criteriaVersion ?? 0) > (item.extraction.version ?? 1)) invalid(`${item.id}.criteriaVersion`)
    unique((item.tax.drafts ?? []).map(draft => String(draft.version)), `${item.id}.drafts`)
    unique((item.extraction.runs ?? []).map(run => String(run.version)), `${item.id}.runs`)
    if (item.tax.drafts?.some(draft => draft.version > item.tax.version) ||
      item.extraction.runs?.some(run => run.version > (item.extraction.version ?? 1))) invalid(`${item.id}.versions`)
  }
}

export const workflowFields: Record<WorkflowAction['type'], Shape> = {
  invite: {}, remind: {}, call: {},
  respond: { accept: bool, rentaType: optional(enumeration(['Individual', 'Conjunta'])), presenter: optional(enumeration(['RCD', 'Cliente'])),
    fee: optional(number(0)), consent: optional(bool), dniValidUntil: optional(date) },
  'contact-outcome': { outcome: enumeration(['Sigue interesado', 'Sin contacto', 'No interesado']), note: text },
  assign: { owner: id }, 'ph-submit': {}, 'ph-review': { approve: bool, note: text }, 'ph-edit': { note: text, fee: number(0) },
  'ph-send': {}, 'ph-sign': {}, 'ph-reject': { note: text }, 'ph-call': {}, 'ph-remind': {}, withdraw: { note: text },
  identity: { field: enumeration(['dni', 'certificate', 'authorization']), value: bool, validUntil: optional(date) },
  'request-identity': {}, 'prior-confirm': { note: text }, 'pbc-start': {},
  'pbc-decide': { state: enumeration(['Apto', 'No apto', 'Incidencia']), note: text },
  'nav-register': { reference: text }, 'portal-send': {},
  'add-document': { kind: enumeration(documentKinds), name: id, size: number(1, 10_000_000, true) },
  'deliver-documents': {}, 'review-document': { id, valid: bool, note: text }, 'complete-documents': {},
  'docs-remind': { afterDays: number(1, 30, true) }, 'tax-draft': {}, 'tax-send': {},
  'tax-respond': { accept: bool, note: text }, present: { receipt: text, date: optional(date) }, 'receipt-send': {},
  extract: { fail: bool }, 'extraction-review': { rows: array(asset) }, 'it-report': { note: text }, 'it-resolve': { note: text },
  criteria: { reference: text, date: optional(date) }, invoice: { number: text }, 'invoice-send': {}, close: {},
}
export function assertWorkflowAction(v: unknown, p = 'action'): asserts v is WorkflowAction {
  record(v, p)
  if (typeof v.type !== 'string' || !Object.hasOwn(workflowFields, v.type)) invalid(p)
  object({ type: enumeration([v.type]), ...workflowFields[v.type as WorkflowAction['type']] })(v, p)
}
const commands: Record<CommandEnvelope['command']['type'], Shape> = {
  workflow: { caseId: id, action: assertWorkflowAction },
  'set-role': { role }, 'advance-days': { days: number(1, 365_000, true) },
  'set-settings': { teams: optional(bool), signatureEmail: optional(bool), documentReminderDays: optional(number(1, 30, true)) },
  'invite-many': { caseIds: array(id) }, 'evaluate-followups': {}, 'reset-demo': { confirm: enumeration([true]) },
  'delete-case': { caseId: id, confirm: enumeration([true]) },
  'restore-case': { historyId: (v, p) => uuid(v, p), confirm: enumeration([true]) },
}
const uuid: Validator = (v, p) => { if (typeof v !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)) invalid(p) }
export function assertCommandEnvelope(v: unknown): asserts v is CommandEnvelope {
  object({ datasetId: uuid, expectedRevision: uint, command: (c, p) => {
    record(c, p)
    if (typeof c.type !== 'string' || !Object.hasOwn(commands, c.type)) invalid(p)
    object({ type: enumeration([c.type]), ...commands[c.type as CommandEnvelope['command']['type']] })(c, p)
    if (c.type === 'set-settings' && Object.keys(c).length === 1) invalid(p)
    if (c.type === 'invite-many') {
      if (!Array.isArray(c.caseIds) || !c.caseIds.length) invalid(p)
      unique(c.caseIds as string[], p)
    }
  } })(v, 'command')
}
