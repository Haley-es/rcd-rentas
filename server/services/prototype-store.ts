import { Prisma, type PrototypeState } from '@prisma/client'
import { createSeed } from '../../app/data/seed'
import type { PrototypePayload, PrototypeSnapshot } from '../../shared/types/prototype'
import { decodePrototypePayload, encodePrototypePayload } from '../utils/prototype-codec'
import { prisma } from '../utils/prisma'
import { withPrototypeHistoryAccess } from '../utils/prototype-history-access'
import { prototypeDatabase, prototypeFailure } from '../utils/prototype-errors'
import type { PrototypeSessionContext } from '../utils/prototype-auth'
import { projectPrototypePortal, type PrototypePortalScope } from './prototype-portal'
import { describePrototypeFiles } from './prototype-file-descriptors'
import { recordPrototypeChanges } from './prototype-history'
import type { Role } from '../../app/types/domain'

export interface StoredPrototypeState extends PrototypePayload {
  schemaVersion: 1
  datasetId: string
  revision: number
}
export function newPrototypePayload(): PrototypePayload {
  return { cases: createSeed(), today: '2026-06-12', teams: true, signatureEmail: false,
    documentReminderDays: 3, rolesByPrincipal: {} }
}
function unpack(row: PrototypeState): StoredPrototypeState {
  if (row.id !== 1 || !Number.isSafeInteger(row.revision) || row.revision < 0 ||
    !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.datasetId)) {
    prototypeFailure(500, 'STATE_INVALID', 'Identificación de estado inválida.')
  }
  return { ...decodePrototypePayload(row.payload, row.schemaVersion), schemaVersion: 1,
    datasetId: row.datasetId, revision: row.revision }
}
async function load(tx: Prisma.TransactionClient): Promise<StoredPrototypeState | null> {
  const installation = await tx.prototypeInstallation.findUnique({ where: { id: 1 } })
  const row = await tx.prototypeState.findUnique({ where: { id: 1 } })
  if (!installation && !row) {
    if (await tx.prototypeFile.count() || await withPrototypeHistoryAccess(tx, 'Administrador IT', () => tx.prototypeChangeHistory.count())) prototypeFailure(500, 'STATE_INVALID', 'Datos sin instalación. No se ha reinicializado la demo.')
    return null
  }
  if (!installation || !row || installation.schemaVersion !== 1) {
    prototypeFailure(500, 'STATE_INVALID', 'Instalación inconsistente. No se ha reinicializado la demo.')
  }
  return unpack(row)
}
export async function ensurePrototypeState(): Promise<StoredPrototypeState> {
  const existing = await prisma.$transaction(load)
  if (existing) return existing
  try {
    return await prisma.$transaction(async tx => {
      const state = await load(tx)
      if (state) return state
      const payload = newPrototypePayload()
      await tx.prototypeInstallation.create({ data: { id: 1, schemaVersion: 1 } })
      return unpack(await tx.prototypeState.create({ data: {
        id: 1, schemaVersion: 1, revision: 0, datasetId: crypto.randomUUID(), payload: encodePrototypePayload(payload),
      } }))
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (cause) {
    if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || !['P2002', 'P2034'].includes(cause.code)) throw cause
    const winner = await prisma.$transaction(load)
    if (!winner) throw cause
    return winner
  }
}
export function prototypeRole(state: StoredPrototypeState, username: string) {
  return Object.hasOwn(state.rolesByPrincipal, username) ? state.rolesByPrincipal[username]! : 'Profesional'
}
export function internalPrototypeSnapshot(state: StoredPrototypeState, session: PrototypeSessionContext): PrototypeSnapshot {
  const role = prototypeRole(state, session.username)
  if (role === 'Cliente') prototypeFailure(403, 'ACTION_FORBIDDEN', 'El rol Cliente solo puede consultar su portal demo.')
  const { rolesByPrincipal: _preferences, ...snapshot } = state
  return { ...snapshot, role }
}
export function readPrototypeState(session: PrototypeSessionContext): Promise<PrototypeSnapshot> {
  return prototypeDatabase(async () => {
    const state = await ensurePrototypeState()
    return { ...internalPrototypeSnapshot(state, session), files: await describePrototypeFiles(state, session.username) }
  })
}
export function readPrototypePortal(session: PrototypeSessionContext, scope: PrototypePortalScope) {
  return prototypeDatabase(async () => {
    const state = await ensurePrototypeState()
    return { ...projectPrototypePortal(state, scope, session.username), files: await describePrototypeFiles(state, session.username, scope) }
  })
}

export interface PrototypeArtifacts {
  beforeCommit(state: StoredPrototypeState, tx: Prisma.TransactionClient): Promise<void>
  rollback(): Promise<void>
  afterCommit?(): Promise<boolean>
}
export interface PrototypeMutation<T> {
  changed: boolean
  result: T
  artifacts?: PrototypeArtifacts
  restoredHistoryId?: string
}
export async function mutatePrototype<T>(options: {
  session: PrototypeSessionContext
  datasetId: string
  expectedRevision: number
  actorRole?: Role
  apply(state: StoredPrototypeState, tx: Prisma.TransactionClient): Promise<PrototypeMutation<T>> | PrototypeMutation<T>
}): Promise<{ state: StoredPrototypeState; result: T; cleanupPending?: boolean }> {
  return prototypeDatabase(async () => {
    await ensurePrototypeState()
    let artifacts: PrototypeArtifacts | undefined
    let confirmed: { state: StoredPrototypeState; result: T }
    try {
      confirmed = await prisma.$transaction(async tx => {
        const state = await load(tx)
        if (!state) prototypeFailure(500, 'STATE_INVALID', 'Estado perdido. No se ha reinicializado la demo.')
        if (state.datasetId !== options.datasetId || state.revision !== options.expectedRevision) {
          prototypeFailure(409, 'REVISION_CONFLICT', 'Otro cambio se ha confirmado. Actualiza y confirma de nuevo; no se ha repetido la acción.')
        }
        const before = structuredClone(state)
        const mutation = await options.apply(state, tx)
        artifacts = mutation.artifacts
        if (!mutation.changed) return { state, result: mutation.result }
        const { schemaVersion, datasetId, revision, ...payload } = state
        if (revision >= 2_147_483_646) prototypeFailure(500, 'STATE_INVALID', 'Revisión agotada.')
        await artifacts?.beforeCommit(state, tx)
        const serialized = encodePrototypePayload(payload)
        const updated = await tx.prototypeState.updateMany({
          where: { id: 1, revision: options.expectedRevision, datasetId: options.datasetId },
          data: { payload: serialized, schemaVersion, datasetId, revision: { increment: 1 } },
        })
        if (updated.count !== 1) prototypeFailure(409, 'REVISION_CONFLICT', 'Otro cambio se ha confirmado. Actualiza y confirma de nuevo; no se ha repetido la acción.')
        await recordPrototypeChanges(tx, before, state, options.session.username,
          options.actorRole ?? prototypeRole(before, options.session.username), !!mutation.restoredHistoryId)
        state.revision++
        return { state, result: mutation.result }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 })
    } catch (cause) {
      if (artifacts) await artifacts.rollback()
      if (cause instanceof Prisma.PrismaClientKnownRequestError &&
        (cause.code === 'P2034' || cause.code === 'P2002' && artifacts)) {
        prototypeFailure(409, 'REVISION_CONFLICT', 'Conflicto SQL de concurrencia. Actualiza y confirma de nuevo.')
      }
      throw cause
    }
    // SQL is confirmed. A cleanup/response failure must never run the rollback hook.
    const complete = await artifacts?.afterCommit?.()
    return { ...confirmed, ...(complete === false ? { cleanupPending: true } : {}) }
  })
}
