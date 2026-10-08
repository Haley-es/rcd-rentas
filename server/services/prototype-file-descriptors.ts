import { prisma } from '../utils/prisma'
import type { StoredPrototypeState } from './prototype-store'
import type { PrototypeFileDescriptor } from '../../shared/types/prototype-files'
import { publicFileDescriptor, artifactAnchor } from './prototype-artifacts'
import { portalCase, projectPrototypePortal, type PrototypePortalScope } from './prototype-portal'
import { storedFileAvailable } from '../utils/prototype-file-storage'

export function portalFileVisible(file: PrototypeFileDescriptor, state: StoredPrototypeState, scope: PrototypePortalScope, username: string) {
  const item = portalCase(state, scope)
  if (file.caseId !== item.id) return false
  if (file.category === 'document') return item.documents.some(doc => doc.id === file.documentId && doc.version === file.documentVersion)
  const capabilities = projectPrototypePortal(state, scope, username).capabilities
  const visible = file.category === 'ph' ? capabilities.phVisible : file.category === 'tax-draft' ? capabilities.draftVisible :
    file.category === 'receipt' ? capabilities.receiptAvailable : file.category === 'invoice' ? capabilities.invoiceAvailable : false
  // Portal publishes only its current public artifact, never an internal/historical revision.
  return visible && file.category !== 'extraction' && file.anchor === artifactAnchor(file.category, item)
}
export async function describePrototypeFiles(state: StoredPrototypeState, username: string, scope?: PrototypePortalScope) {
  const items = scope ? [portalCase(state, scope)] : state.cases
  const rows = await prisma.prototypeFile.findMany({ where: { datasetId: state.datasetId,
    caseId: { in: items.map(item => item.id) } }, orderBy: { createdAt: 'asc' } })
  const files: PrototypeFileDescriptor[] = await Promise.all(rows.map(async row => {
    const available = await storedFileAvailable(row)
    return { ...publicFileDescriptor(row), available, ...(!available ? { availabilityError: 'FILE_UNAVAILABLE' as const } : {}) }
  }))
  for (const item of items) for (const doc of item.documents) {
    if (!files.some(file => file.caseId === item.id && file.documentId === doc.id && file.documentVersion === doc.version)) files.push({
      fileId: null, caseId: item.id, category: 'document', anchor: doc.id, documentId: doc.id, documentVersion: doc.version,
      originalName: doc.name, mimeType: null, size: doc.size, sha256: null, source: 'metadata-only', available: false,
    })
  }
  return scope ? files.filter(file => portalFileVisible(file, state, scope, username)) : files
}
