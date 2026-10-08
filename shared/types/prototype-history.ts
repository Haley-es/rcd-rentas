import type { CaseFile, Role } from '../../app/types/domain'

export type ChangeValue = string | number | boolean | null | ChangeValue[] | { [key: string]: ChangeValue }
export interface FieldChange { old: ChangeValue; new: ChangeValue }
export interface PrototypeHistoryEntry {
  id: string
  revision: number
  tableName: 'expedientes' | 'ajustes'
  recordId: string
  recordLabel: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE'
  changedBy: string
  changedRole: Role
  changedAt: string
  changes: Record<string, FieldChange>
  snapshot: CaseFile | null
  restoredAt: string | null
}
export interface PrototypeHistorySnapshot {
  datasetId: string
  revision: number
  entries: PrototypeHistoryEntry[]
}
