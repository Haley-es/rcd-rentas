import type { Prisma, PrototypeChangeHistory } from '@prisma/client'
import type { Role } from '../../app/types/domain'
import type { PrototypeHistoryEntry, PrototypeHistorySnapshot } from '../../shared/types/prototype-history'
import { changedHistoryFields } from '../../shared/utils/prototype-history'
import { isItAdministrator } from '../../shared/types/access-role'
import { withPrototypeHistoryAccess } from '../utils/prototype-history-access'
import { caseFile, PrototypeValidationError } from '../../shared/utils/prototype-validation'
import { prototypeDatabase, prototypeFailure } from '../utils/prototype-errors'
import type { PrototypeSessionContext } from '../utils/prototype-auth'
import { prisma } from '../utils/prisma'
import { ensurePrototypeState, internalPrototypeSnapshot, prototypeRole, type StoredPrototypeState } from './prototype-store'

export function collectPrototypeChanges(before: StoredPrototypeState, after: StoredPrototypeState,
  username: string, role: Role, restored = false): Prisma.PrototypeChangeHistoryCreateManyInput[] {
  const rows: Prisma.PrototypeChangeHistoryCreateManyInput[] = []
  const changedAt = new Date()
  const add = (tableName: 'expedientes' | 'ajustes', recordId: string, recordLabel: string,
    old: object, next: object, operation: PrototypeHistoryEntry['operation'], snapshot?: object) => {
    const changes = changedHistoryFields(old, next)
    if (!Object.keys(changes).length && operation === 'UPDATE') return
    rows.push({ id: crypto.randomUUID(), datasetId: after.datasetId, revision: before.revision + 1,
      tableName, recordId, recordLabel, operation, changedBy: username, changedRole: role,
      changedAt, changes: JSON.stringify(changes), snapshot: snapshot ? JSON.stringify(snapshot) : null,
      recordDeleted: operation === 'DELETE' })
  }
  const previous = new Map(before.cases.map(item => [item.id, item]))
  const current = new Map(after.cases.map(item => [item.id, item]))
  for (const item of after.cases) {
    const old = previous.get(item.id)
    add('expedientes', item.id, item.name, old ?? {}, item, old ? 'UPDATE' : restored ? 'RESTORE' : 'INSERT')
  }
  for (const item of before.cases) if (!current.has(item.id)) add('expedientes', item.id, item.name, item, {}, 'DELETE', item)
  const settings = (state: StoredPrototypeState) => ({ today: state.today, teams: state.teams,
    signatureEmail: state.signatureEmail, documentReminderDays: state.documentReminderDays })
  add('ajustes', 'demo', 'Ajustes de demostración', settings(before), settings(after), 'UPDATE')
  return rows
}

export async function recordPrototypeChanges(tx: Prisma.TransactionClient, before: StoredPrototypeState,
  after: StoredPrototypeState, username: string, role: Role, restored = false) {
  // Internal audit maintenance, never a user-facing query. Keep these writes in
  // the business transaction, including reset and visibility changes on restore.
  return withPrototypeHistoryAccess(tx, 'Administrador IT', async () => {
    if (before.datasetId !== after.datasetId) {
      // Explicit demo reset clears its shared history and trash together with business state.
      await tx.prototypeChangeHistory.deleteMany({})
      return
    }
    const rows = collectPrototypeChanges(before, after, username, role, restored)
    for (const row of rows) {
      if (row.operation !== 'DELETE' && row.operation !== 'RESTORE') continue
      await tx.prototypeChangeHistory.updateMany({ where: { datasetId: after.datasetId,
        tableName: row.tableName, recordId: row.recordId }, data: { recordDeleted: row.operation === 'DELETE' } })
    }
    if (rows.length) await tx.prototypeChangeHistory.createMany({ data: rows })
  })
}

function publicHistoryEntry(row: PrototypeChangeHistory): PrototypeHistoryEntry {
  try {
    const snapshot = row.snapshot ? JSON.parse(row.snapshot) : null
    if (snapshot) caseFile(snapshot, 'history.snapshot')
    const changes = JSON.parse(row.changes)
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) ||
      Object.values(changes).some(change => !change || typeof change !== 'object' || !('old' in change) || !('new' in change))) {
      throw new PrototypeValidationError('Historial de campos inválido.')
    }
    if (!['expedientes', 'ajustes'].includes(row.tableName) || !['INSERT', 'UPDATE', 'DELETE', 'RESTORE'].includes(row.operation)) {
      throw new PrototypeValidationError('Tipo de historial inválido.')
    }
    return { id: row.id, revision: row.revision, tableName: row.tableName as PrototypeHistoryEntry['tableName'],
      recordId: row.recordId, recordLabel: row.recordLabel, operation: row.operation as PrototypeHistoryEntry['operation'],
      changedBy: row.changedBy, changedRole: row.changedRole as Role, changedAt: row.changedAt.toISOString(), changes,
      snapshot, restoredAt: row.restoredAt?.toISOString() ?? null }
  } catch { prototypeFailure(500, 'STATE_INVALID', 'Historial persistido inválido. No se ha restaurado ningún registro.') }
}

export function readPrototypeHistory(session: PrototypeSessionContext, filters: { recordId?: string; trash?: boolean } = {}): Promise<PrototypeHistorySnapshot> {
  return prototypeDatabase(async () => {
    const admin = isItAdministrator(session.accessRole)
    if (filters.trash && !admin) prototypeFailure(403, 'ACTION_FORBIDDEN', 'La papelera es exclusiva de Administrador IT.')
    const state = await ensurePrototypeState()
    internalPrototypeSnapshot(state, session)
    const rows = await prisma.$transaction(tx => withPrototypeHistoryAccess(tx, session.accessRole, () =>
      tx.prototypeChangeHistory.findMany({ where: {
        datasetId: state.datasetId, revision: { lte: state.revision },
        ...(!admin ? { operation: { not: 'DELETE' }, recordDeleted: false } : {}),
        ...(filters.recordId ? { tableName: 'expedientes', recordId: filters.recordId } : {}),
        ...(filters.trash ? { operation: 'DELETE', restoredAt: null } : {}),
      }, orderBy: [{ revision: 'desc' }, { changedAt: 'desc' }, { id: 'asc' }] })))
    return { datasetId: state.datasetId, revision: state.revision, entries: rows.map(publicHistoryEntry) }
  })
}

export async function restorePrototypeCase(state: StoredPrototypeState, tx: Prisma.TransactionClient,
  historyId: string, session: PrototypeSessionContext) {
  if (!isItAdministrator(session.accessRole) || prototypeRole(state, session.username) === 'Cliente') {
    prototypeFailure(403, 'ACTION_FORBIDDEN', 'Solo Administrador IT puede restaurar expedientes.')
  }
  return withPrototypeHistoryAccess(tx, session.accessRole, async () => {
    const row = await tx.prototypeChangeHistory.findFirst({ where: { id: historyId, datasetId: state.datasetId,
      tableName: 'expedientes', operation: 'DELETE', restoredAt: null } })
    if (!row) prototypeFailure(404, 'CASE_NOT_FOUND', 'El registro ya no está en la papelera.')
    if (state.cases.some(item => item.id === row.recordId)) prototypeFailure(409, 'REVISION_CONFLICT', 'Ya existe un expediente con el ID original. No se ha sobrescrito.')
    const item = publicHistoryEntry(row).snapshot
    if (!item || item.id !== row.recordId) prototypeFailure(500, 'STATE_INVALID', 'Datos de restauración inválidos.')
    state.cases.push(item)
    const updated = await tx.prototypeChangeHistory.updateMany({ where: { id: row.id, restoredAt: null }, data: { restoredAt: new Date() } })
    if (updated.count !== 1) prototypeFailure(409, 'REVISION_CONFLICT', 'Otro usuario ya ha restaurado el expediente. Actualiza.')
    return { changed: true, restoredHistoryId: row.id,
      result: { ok: true, applied: 1, message: `Expediente ${item.id} restaurado con sus datos y archivos originales.` } }
  })
}
