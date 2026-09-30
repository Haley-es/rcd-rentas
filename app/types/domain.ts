export type Campaign = 'Renta' | '720'
export type Role = 'Gestor de campañas' | 'Profesional' | 'Socio' | 'Altas' | 'Paralegal' | 'PBC' | 'IT' | 'Administrativo' | 'Cliente'
export type ContactState = 'Sin respuesta' | 'Recordatorio' | 'Llamada pendiente' | 'Aceptado' | 'No interesado' | 'Retirado'
export type PhState = 'No necesaria' | 'Borrador' | 'En revisión' | 'Cambios solicitados' | 'Aprobada' | 'Enviada' | 'Firmada' | 'Rechazada'
export type DocState = 'Pendiente' | 'Enviado' | 'Válido' | 'Sustituir'
export type PbcState = 'Pendiente' | 'En revisión' | 'Incidencia' | 'Apto' | 'No apto' | 'Antecedente no confirmado'
export type TaxState = 'Pendiente' | 'Borrador' | 'En revisión cliente' | 'Cambios solicitados' | 'Aceptado' | 'Presentado' | 'Cerrado'

export interface DocumentItem {
  id: string
  kind: string
  name: string
  version: number
  state: DocState
  note: string
  size: number
}

export interface HistoryItem {
  date: string
  role: Role
  text: string
  before?: string
  after?: string
}

export interface CaseFile {
  id: string
  name: string
  email: string
  campaign: Campaign
  segment: string
  owner: string
  scenario: string
  opened: boolean
  contact: ContactState
  contactedAt: string
  reminderAt: string | null
  rentaType: 'Individual' | 'Conjunta'
  presenter: 'RCD' | 'Cliente'
  fee: number
  ph: { state: PhState; version: number; approvedVersion: number | null; signedVersion: number | null; sentAt: string | null; note: string; prior: boolean; followupAt?: string; priorConfirmed?: boolean }
  identity: { dni: boolean; certificate: boolean; authorization: boolean; dniValidUntil?: string }
  pbc: PbcState
  pbcNote: string
  nav: string
  portalSent: boolean
  documents: DocumentItem[]
  delivered: boolean
  docsComplete: boolean
  docsRequestedAt?: string
  docsReminderKey?: string
  tax: { state: TaxState; version: number; acceptedVersion: number | null; note: string; receipt: string; receiptSent: boolean; presentationDate?: string; drafts?: { version: number; date: string; note: string }[] }
  extraction: { state: 'Pendiente' | 'Extraído' | 'Incidencia IT' | 'Revisado' | 'Cargado en Criteria'; rows: AssetRow[]; note: string; version?: number; criteriaVersion?: number; criteriaDate?: string; runs?: { version: number; date: string; inputs: string[]; failed: boolean }[] }
  invoice: { number: string; amount: number; sent: boolean }
  history: HistoryItem[]
}

export interface AssetRow {
  id: string
  category: string
  country: string
  entity: string
  value: number
  origin?: string
  observation?: string
}

export type WorkflowAction =
  | { type: 'invite' }
  | { type: 'remind' }
  | { type: 'call' }
  | { type: 'respond'; accept: boolean; rentaType?: 'Individual' | 'Conjunta'; presenter?: 'RCD' | 'Cliente'; fee?: number; consent?: boolean; dniValidUntil?: string }
  | { type: 'contact-outcome'; outcome: 'Sigue interesado' | 'Sin contacto' | 'No interesado'; note: string }
  | { type: 'assign'; owner: string }
  | { type: 'ph-submit' }
  | { type: 'ph-review'; approve: boolean; note: string }
  | { type: 'ph-edit'; note: string; fee: number }
  | { type: 'ph-send' }
  | { type: 'ph-sign' }
  | { type: 'ph-reject'; note: string }
  | { type: 'ph-call' }
  | { type: 'ph-remind' }
  | { type: 'withdraw'; note: string }
  | { type: 'identity'; field: 'dni' | 'certificate' | 'authorization'; value: boolean; validUntil?: string }
  | { type: 'request-identity' }
  | { type: 'prior-confirm'; note: string }
  | { type: 'pbc-start' }
  | { type: 'pbc-decide'; state: 'Apto' | 'No apto' | 'Incidencia'; note: string }
  | { type: 'nav-register'; reference: string }
  | { type: 'portal-send' }
  | { type: 'add-document'; kind: string; name: string; size: number }
  | { type: 'deliver-documents' }
  | { type: 'review-document'; id: string; valid: boolean; note: string }
  | { type: 'complete-documents' }
  | { type: 'docs-remind'; afterDays: number }
  | { type: 'tax-draft' }
  | { type: 'tax-send' }
  | { type: 'tax-respond'; accept: boolean; note: string }
  | { type: 'present'; receipt: string; date?: string }
  | { type: 'receipt-send' }
  | { type: 'extract'; fail: boolean }
  | { type: 'extraction-review'; rows: AssetRow[] }
  | { type: 'it-report'; note: string }
  | { type: 'it-resolve'; note: string }
  | { type: 'criteria'; reference: string; date?: string }
  | { type: 'invoice'; number: string }
  | { type: 'invoice-send' }
  | { type: 'close' }

export interface ActionResult { ok: boolean; message: string }

export const roles: Role[] = ['Profesional', 'Gestor de campañas', 'Socio', 'Altas', 'Paralegal', 'PBC', 'IT', 'Administrativo', 'Cliente']
export const documentKinds = ['DNI anverso', 'DNI reverso', 'Datos fiscales', 'Certificado digital', 'Autorización', 'Información bancaria', 'Bienes en el extranjero', 'Documentación adicional']
