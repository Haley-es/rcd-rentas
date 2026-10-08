import type { ActionResult, CaseFile, Role, WorkflowAction } from '../../app/types/domain'
import type { PrototypeFileDescriptor } from './prototype-files'

export interface PrototypePayload {
  cases: CaseFile[]
  today: string
  teams: boolean
  signatureEmail: boolean
  documentReminderDays: number
  rolesByPrincipal: Record<string, Role>
}

export interface PrototypeSnapshot extends Omit<PrototypePayload, 'rolesByPrincipal'> {
  files?: PrototypeFileDescriptor[]
  schemaVersion: 1
  datasetId: string
  revision: number
  role: Role
}

export type PrototypeCommand =
  | { type: 'workflow'; caseId: string; action: WorkflowAction }
  | { type: 'set-role'; role: Role }
  | { type: 'advance-days'; days: number }
  | { type: 'set-settings'; teams?: boolean; signatureEmail?: boolean; documentReminderDays?: number }
  | { type: 'invite-many'; caseIds: string[] }
  | { type: 'evaluate-followups' }
  | { type: 'reset-demo'; confirm: true }
  | { type: 'delete-case'; caseId: string; confirm: true }
  | { type: 'restore-case'; historyId: string; confirm: true }

export interface CommandEnvelope {
  datasetId: string
  expectedRevision: number
  command: PrototypeCommand
}

export type PrototypePortalCase = Pick<CaseFile,
  'id' | 'name' | 'email' | 'campaign' | 'opened' | 'contact' | 'contactedAt' |
  'rentaType' | 'presenter' | 'fee' | 'owner' | 'identity' | 'portalSent' |
  'documents' | 'delivered' | 'docsComplete' | 'invoice'> & {
  ph: Omit<CaseFile['ph'], 'note' | 'followupAt'>
  tax: Omit<CaseFile['tax'], 'note' | 'drafts'> & { drafts?: { version: number; date: string }[] }
}

export interface PrototypePortalCapabilities {
  canUpload: boolean
  canSign: boolean
  canWithdraw: boolean
  canDeliver: boolean
  canRespondToDraft: boolean
  canPresent: boolean
  phVisible: boolean
  draftVisible: boolean
  receiptAvailable: boolean
  invoiceAvailable: boolean
}

export interface PrototypePortalSnapshot {
  files?: PrototypeFileDescriptor[]
  schemaVersion: 1
  datasetId: string
  revision: number
  today: string
  role: Role
  case: PrototypePortalCase
  capabilities: PrototypePortalCapabilities
}

export interface PrototypeControl extends ActionResult {
  datasetId: string
  revision: number
  role: Role
}

export interface PrototypeCommandResult extends ActionResult {
  snapshot?: PrototypeSnapshot | PrototypePortalSnapshot
  datasetId: string
  revision: number
  role: Role
  results?: (ActionResult & { caseId: string; action: WorkflowAction['type'] })[]
  applied: number
}

export type PrototypeErrorCode = 'COMMAND_INVALID' | 'WORKFLOW_REJECTED' |
  'REVISION_CONFLICT' | 'ACTION_FORBIDDEN' | 'CASE_NOT_FOUND' |
  'DATABASE_UNAVAILABLE' | 'STATE_INVALID'

// PRD10 attaches file metadata to the version assigned by runAction in the same transaction.
export interface PrototypeDocumentReference {
  datasetId: string
  caseId: string
  documentId: string
  version: number
}
