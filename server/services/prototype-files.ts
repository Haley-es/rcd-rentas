import { getHeader, getQuery, getRouterParam, readBody, setHeader, type H3Event } from 'h3'
import { prisma } from '../utils/prisma'
import { requirePrototypeSession, requirePrototypeOrigin, type PrototypeSessionContext } from '../utils/prototype-auth'
import { prototypeDatabase, prototypeFailure } from '../utils/prototype-errors'
import { readPrototypeUpload } from '../utils/prototype-upload'
import { stageStoredFile, removeStoredFile, readStoredFile, datasetPattern } from '../utils/prototype-file-storage'
import { ensurePrototypeState, internalPrototypeSnapshot, mutatePrototype } from './prototype-store'
import { executePrototypeCommand, applyPrototypeCommand } from './prototype-commands'
import { portalCase, projectPrototypePortal, type PrototypePortalScope } from './prototype-portal'
import { describePrototypeFiles, portalFileVisible } from './prototype-file-descriptors'
import { publicFileDescriptor, prepareGeneratedArtifacts, seedArtifactCategories, rollbackStagedFiles } from './prototype-artifacts'

function fileScope(event: H3Event, portal: boolean) {
  const session = requirePrototypeSession(event)
  const caseId = getRouterParam(event, 'id') ?? ''
  const scope: PrototypePortalScope | undefined = portal ? { caseId, token: getQuery(event).token } : undefined
  return { session, caseId, scope }
}
async function authorizedCase(session: PrototypeSessionContext, caseId: string, scope?: PrototypePortalScope) {
  const state = await ensurePrototypeState()
  if (scope) portalCase(state, scope)
  else internalPrototypeSnapshot(state, session)
  if (!state.cases.some(item => item.id === caseId)) prototypeFailure(404, 'FILE_NOT_FOUND', 'Archivo no encontrado.')
  return state
}
export async function listPrototypeFiles(event: H3Event, portal = false) {
  const { session, caseId, scope } = fileScope(event, portal)
  return prototypeDatabase(async () => {
    const state = await authorizedCase(session, caseId, scope)
    return (await describePrototypeFiles(state, session.username, scope)).filter(file => file.caseId === caseId)
  })
}
export async function uploadPrototypeFile(event: H3Event, portal = false) {
  const { session, caseId, scope } = fileScope(event, portal)
  requirePrototypeOrigin(event)
  return prototypeDatabase(async () => {
    const initial = await authorizedCase(session, caseId, scope)
    const upload = await readPrototypeUpload(event)
    if (initial.datasetId !== upload.datasetId || initial.revision !== upload.expectedRevision) prototypeFailure(409, 'REVISION_CONFLICT', 'Estado cambiado. Actualiza antes de reintentar.')
    const command = { type: 'workflow' as const, caseId, action: { type: 'add-document' as const,
      kind: upload.kind, name: upload.name, size: upload.bytes.length } }
    const preflight = applyPrototypeCommand(structuredClone(initial), command, session.username, scope)
    if (!preflight.result.ok) prototypeFailure(422, 'WORKFLOW_REJECTED', preflight.result.message)
    const blob = await stageStoredFile(upload.datasetId, upload.bytes)
    let committed = false
    try {
      const result = await executePrototypeCommand(session, { datasetId: upload.datasetId, expectedRevision: upload.expectedRevision,
        command },
      scope, async ({ state }) => {
        const doc = state.cases.find(item => item.id === caseId)?.documents.at(-1)
        if (!doc || doc.kind !== upload.kind || doc.name !== upload.name || doc.size !== blob.size) prototypeFailure(500, 'STATE_INVALID', 'Vínculo documental inválido.')
        return {
          async beforeCommit(current, tx) {
            if (current.datasetId !== upload.datasetId) prototypeFailure(409, 'REVISION_CONFLICT', 'Dataset cambiado.')
            await tx.prototypeFile.create({ data: { ...blob, stateId: 1, datasetId: upload.datasetId, caseId, category: 'document',
              anchor: doc.id, documentId: doc.id, documentVersion: doc.version, originalName: upload.name, mimeType: upload.mime,
              source: 'uploaded', uploadedBy: session.username } })
          },
          async rollback() { await rollbackStagedFiles([blob]) },
        }
      })
      committed = true
      const file = result.snapshot?.files?.find(file => file.fileId === blob.id)
      return { ...result, file }
    } catch (cause) {
      // Projection/response may fail after commit. SQL is authority before deleting staged bytes.
      if (!committed) {
        let exists: boolean
        try { exists = !!await prisma.prototypeFile.findUnique({ where: { id: blob.id }, select: { id: true } }) }
        catch (lookupCause) {
          console.error('[prototype-files]', { operation: 'commit-uncertain', fileId: blob.id })
          throw lookupCause
        }
        if (!exists) {
          const cleaned = await removeStoredFile(blob.storageKey)
          if (!cleaned) prototypeFailure(503, 'FILE_STORAGE_FAILED', 'Carga no confirmada; limpieza pendiente. Consulta estado y reconciliación local.')
        }
      }
      throw cause
    }
  })
}
export async function downloadPrototypeFile(event: H3Event, portal = false) {
  const { session, caseId, scope } = fileScope(event, portal)
  return prototypeDatabase(async () => {
    const state = await authorizedCase(session, caseId, scope)
    const fileId = getRouterParam(event, 'fileId') ?? ''
    if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(fileId)) prototypeFailure(404, 'FILE_NOT_FOUND', 'Archivo no encontrado.')
    const row = await prisma.prototypeFile.findFirst({ where: { id: fileId, datasetId: state.datasetId, caseId } })
    if (!row || scope && !portalFileVisible(publicFileDescriptor(row), state, scope, session.username)) prototypeFailure(404, 'FILE_NOT_FOUND', 'Archivo no encontrado.')
    if (row.category === 'document' && !state.cases.find(item => item.id === caseId)?.documents.some(doc => doc.id === row.documentId && doc.version === row.documentVersion)) prototypeFailure(404, 'FILE_NOT_FOUND', 'Archivo no encontrado.')
    const bytes = await readStoredFile(row)
    const safeName = row.originalName.replace(/[\\/\x00-\x1f\x7f"]/g, '_')
    const ascii = safeName.replace(/[^\x20-\x7e]/g, '_')
    const encoded = encodeURIComponent(safeName).replace(/['()*]/g, value => `%${value.charCodeAt(0).toString(16).toUpperCase()}`)
    setHeader(event, 'Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`)
    setHeader(event, 'Content-Type', row.mimeType)
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'Content-Length', bytes.length)
    return bytes
  })
}
export async function generatePrototypeSeedArtifacts(event: H3Event, portal = false) {
  const { session, caseId, scope } = fileScope(event, portal)
  requirePrototypeOrigin(event)
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') prototypeFailure(400, 'UPLOAD_INVALID', 'La preparación explícita exige JSON.')
  const body: unknown = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).some(key => !['datasetId', 'expectedRevision', 'confirm'].includes(key)) ||
    !('datasetId' in body) || typeof body.datasetId !== 'string' || !datasetPattern.test(body.datasetId) ||
    !('expectedRevision' in body) || typeof body.expectedRevision !== 'number' ||
    !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision > 2_147_483_646 ||
    !('confirm' in body) || body.confirm !== true) prototypeFailure(400, 'UPLOAD_INVALID', 'Confirma muestras con dataset y revisión vigentes.')
  const { state } = await mutatePrototype({ session, datasetId: body.datasetId, expectedRevision: body.expectedRevision,
    apply: async (state, tx) => {
      if (scope) portalCase(state, scope)
      else internalPrototypeSnapshot(state, session)
      const item = state.cases.find(item => item.id === caseId)
      if (!item) prototypeFailure(404, 'CASE_NOT_FOUND', 'Expediente no encontrado.')
      const capabilities = scope ? projectPrototypePortal(state, scope, session.username).capabilities : undefined
      const categories = seedArtifactCategories(item).filter(category => !capabilities ||
        (category === 'ph' ? capabilities.phVisible : category === 'tax-draft' ? capabilities.draftVisible :
          category === 'receipt' ? capabilities.receiptAvailable : category === 'invoice' ? capabilities.invoiceAvailable : false))
      const artifacts = await prepareGeneratedArtifacts(state, tx, item, categories, session.username)
      return { changed: artifacts.createdCount > 0, result: true, artifacts }
    },
  })
  return { ok: true, message: 'Muestras TXT/CSV actuales guardadas. No se reconstruyen originales ni versiones históricas.',
    datasetId: state.datasetId, revision: state.revision, role: scope ? projectPrototypePortal(state, scope, session.username).role : internalPrototypeSnapshot(state, session).role, applied: 0,
    snapshot: { ...(scope ? projectPrototypePortal(state, scope, session.username) : internalPrototypeSnapshot(state, session)), files: await describePrototypeFiles(state, session.username, scope) } }
}
