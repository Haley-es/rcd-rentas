import type { Prisma, PrototypeFile } from '@prisma/client'
import type { CaseFile } from '../../app/types/domain'
import type { PrototypeCommand } from '../../shared/types/prototype'
import type { PrototypeFileCategory, PrototypeFileDescriptor } from '../../shared/types/prototype-files'
import type { PrototypeArtifacts, StoredPrototypeState } from './prototype-store'
import { stageStoredFile, removeStoredFile, readStoredFile } from '../utils/prototype-file-storage'
import { prototypeFailure } from '../utils/prototype-errors'
import { prisma } from '../utils/prisma'
import { storageIncident } from '../utils/prototype-file-storage'

export async function rollbackStagedFiles(staged: { id: string; storageKey: string }[]) {
  if (!staged.length) return
  let confirmed: Set<string>
  try {
    confirmed = new Set((await prisma.prototypeFile.findMany({ where: { id: { in: staged.map(file => file.id) } }, select: { id: true } })).map(row => row.id))
  } catch (cause) {
    storageIncident('rollback-commit-uncertain', cause)
    prototypeFailure(503, 'FILE_STORAGE_FAILED', 'Resultado SQL incierto; blobs conservados para comprobar estado. Revisa conexión y reconciliación, no repitas automáticamente.')
  }
  let complete = true
  for (const blob of staged) if (!confirmed.has(blob.id) && !await removeStoredFile(blob.storageKey)) complete = false
  if (!complete) prototypeFailure(503, 'FILE_STORAGE_FAILED', 'Comando no confirmado; limpieza de artefactos pendiente. Consulta estado y reconciliación local.')
}

type ArtifactCategory = Exclude<PrototypeFileCategory, 'document'>
export function artifactAnchor(category: ArtifactCategory, item: CaseFile) {
  const identity = category === 'ph' ? [item.ph.version] : category === 'tax-draft' ? [item.tax.version] :
    category === 'extraction' ? [item.extraction.version ?? 1] :
      category === 'receipt' ? [item.tax.receipt, item.tax.presentationDate ?? ''] : [item.invoice.number]
  if (identity.some(value => typeof value === 'number' ? value < 1 : !value)) prototypeFailure(400, 'UPLOAD_INVALID', 'El artefacto no tiene una versión publicable.')
  return `v1:${JSON.stringify(identity)}`
}
export function renderPrototypeArtifact(category: ArtifactCategory, item: CaseFile) {
  const version = category === 'ph' ? item.ph.version : category === 'tax-draft' ? item.tax.version : item.extraction.version ?? 1
  const name = `${item.id}-${category}-v${version}-DEMO.${category === 'extraction' ? 'csv' : 'txt'}`
  const title = 'DOCUMENTO FICTICIO - SIN VALIDEZ FISCAL, CONTABLE NI CONTRACTUAL\n'
  let content: string
  switch (category) {
    case 'ph': content = `${title}PH v${item.ph.version}\nCliente: ${item.name}\nCampaña: ${item.campaign}, ${item.rentaType}, presenta ${item.presenter}\nHonorarios ilustrativos: ${item.fee} EUR\nFirma simulada; ninguna autorización real.\n`; break
    case 'tax-draft': content = `${title}Borrador Renta v${item.tax.version}\nCliente: ${item.name}\nPresentador: ${item.presenter}\nSin cálculo tributario ni presentación real.\n`; break
    case 'receipt': content = `${title}JUSTIFICANTE FICTICIO\n${item.tax.receipt}\nFecha demo: ${item.tax.presentationDate}\nNinguna presentación real realizada.\n`; break
    case 'invoice': content = `${title}FACTURA FICTICIA\n${item.invoice.number}\nImporte ilustrativo: ${item.invoice.amount} EUR\nSin emisión contable ni cobro confirmado.\n`; break
    case 'extraction': {
      const cell = (value: unknown) => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`
      content = '\uFEFFDEMO;no XLSX ni importable en Criteria\nOrigen;Entidad;País;Tipo;Valor ficticio;Observación\n' +
        item.extraction.rows.map(row => [row.origin, row.entity, row.country, row.category, row.value, row.observation].map(cell).join(';')).join('\n') + '\n'
      break
    }
  }
  return { originalName: name, mimeType: category === 'extraction' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8', bytes: Buffer.from(content, 'utf8') }
}
export function publicFileDescriptor(row: PrototypeFile): PrototypeFileDescriptor {
  const categories: PrototypeFileCategory[] = ['document', 'ph', 'tax-draft', 'extraction', 'receipt', 'invoice']
  const category = categories.find(category => category === row.category)
  if (!category || !['uploaded', 'generated-demo'].includes(row.source)) prototypeFailure(500, 'STATE_INVALID', 'Metadatos de archivo inválidos.')
  return { fileId: row.id, caseId: row.caseId, category, anchor: row.anchor,
    documentId: row.documentId, documentVersion: row.documentVersion, originalName: row.originalName,
    mimeType: row.mimeType, size: row.size, sha256: row.sha256,
    source: row.source === 'uploaded' ? 'uploaded' : 'generated-demo', available: true }
}
export function seedArtifactCategories(item: CaseFile): ArtifactCategory[] {
  const categories: ArtifactCategory[] = []
  if (!item.ph.prior && item.ph.sentAt && ['Enviada', 'Firmada', 'Rechazada'].includes(item.ph.state)) categories.push('ph')
  if (item.campaign === 'Renta' && item.tax.version > 0 && ['En revisión cliente', 'Cambios solicitados', 'Aceptado', 'Presentado', 'Cerrado'].includes(item.tax.state)) categories.push('tax-draft')
  if (item.campaign === '720' && item.extraction.rows.length && ['Revisado', 'Cargado en Criteria'].includes(item.extraction.state)) categories.push('extraction')
  if (item.tax.receipt && item.tax.presentationDate) categories.push('receipt')
  if (item.invoice.number) categories.push('invoice')
  return categories
}
export async function prepareGeneratedArtifacts(state: StoredPrototypeState, tx: Prisma.TransactionClient,
  item: CaseFile, categories: ArtifactCategory[], username: string): Promise<PrototypeArtifacts & { createdCount: number }> {
  const staged: Awaited<ReturnType<typeof stageStoredFile>>[] = []
  const rows: Prisma.PrototypeFileCreateManyInput[] = []
  try {
    for (const category of categories) {
      const anchor = artifactAnchor(category, item)
      const existing = await tx.prototypeFile.findUnique({ where: {
        datasetId_caseId_category_anchor: { datasetId: state.datasetId, caseId: item.id, category, anchor },
      } })
      if (existing) {
        if (existing.source !== 'generated-demo' || existing.documentId !== null) prototypeFailure(500, 'STATE_INVALID', 'Ancla de artefacto inconsistente.')
        await readStoredFile(existing)
        continue
      }
      const rendered = renderPrototypeArtifact(category, item)
      const blob = await stageStoredFile(state.datasetId, rendered.bytes)
      staged.push(blob)
      rows.push({ ...blob, stateId: 1, datasetId: state.datasetId, caseId: item.id, category, anchor,
        originalName: rendered.originalName, mimeType: rendered.mimeType, source: 'generated-demo', uploadedBy: username })
    }
    return {
      createdCount: rows.length,
      async beforeCommit(_state, transaction) { if (rows.length) await transaction.prototypeFile.createMany({ data: rows }) },
      async rollback() { await rollbackStagedFiles(staged) },
    }
  } catch (cause) {
    for (const blob of staged) await removeStoredFile(blob.storageKey)
    throw cause
  }
}
export async function prepareCommandArtifacts(context: { state: StoredPrototypeState; command: PrototypeCommand; tx: Prisma.TransactionClient }, username: string): Promise<PrototypeArtifacts | undefined> {
  const { state, command, tx } = context
  if (command.type === 'reset-demo') {
    const old = await tx.prototypeFile.findMany({ select: { id: true, storageKey: true } })
    return {
      async beforeCommit(_state, transaction) { await transaction.prototypeFile.deleteMany({ where: { id: { in: old.map(row => row.id) } } }) },
      async rollback() {},
      async afterCommit() {
        let complete = true
        for (const row of old) if (!await removeStoredFile(row.storageKey)) complete = false
        return complete
      },
    }
  }
  if (command.type !== 'workflow') return
  const category: Partial<Record<typeof command.action.type, ArtifactCategory>> = {
    'ph-send': 'ph', 'tax-send': 'tax-draft', 'extraction-review': 'extraction', present: 'receipt', invoice: 'invoice',
  }
  const selected = category[command.action.type]
  if (!selected) return
  const item = state.cases.find(item => item.id === command.caseId)!
  return prepareGeneratedArtifacts(state, tx, item, [selected], username)
}
