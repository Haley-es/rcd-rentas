export type PrototypeFileCategory = 'document' | 'ph' | 'tax-draft' | 'extraction' | 'receipt' | 'invoice'
export type PrototypeFileErrorCode = 'UPLOAD_INVALID' | 'UPLOAD_TOO_LARGE' | 'FILE_NOT_FOUND' | 'FILE_UNAVAILABLE' | 'FILE_STORAGE_FAILED'
export interface PrototypeFileDescriptor {
  fileId: string | null
  caseId: string
  category: PrototypeFileCategory
  anchor: string
  documentId: string | null
  documentVersion: number | null
  originalName: string
  mimeType: string | null
  size: number
  sha256: string | null
  source: 'uploaded' | 'generated-demo' | 'metadata-only'
  available: boolean
  availabilityError?: 'FILE_UNAVAILABLE'
}
