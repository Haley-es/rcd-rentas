import { getHeader, type H3Event } from 'h3'
import { documentKinds } from '../../app/types/domain'
import { prototypeFailure } from './prototype-errors'
import { datasetPattern } from './prototype-file-storage'

export const maximumFileBytes = 10_000_000
const maximumBodyBytes = maximumFileBytes + 64_000
export const uploadMimeTypes: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
export function validateUpload(name: string, mime: string, size: number) {
  if (size > maximumFileBytes) prototypeFailure(413, 'UPLOAD_TOO_LARGE', 'Límite: 10.000.000 bytes por archivo.')
  if (!Number.isSafeInteger(size) || size <= 0 || !name || name.length > 255 ||
    /[\\/:<>"|?*\x00-\x1f\x7f]/.test(name) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|2e|2f|5c)/i.test(name) || name.includes('..') || /[. ]$/.test(name) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    prototypeFailure(400, 'UPLOAD_INVALID', 'Archivo vacío o nombre no seguro. No se admiten rutas ni caracteres de cabecera.')
  }
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  if (!uploadMimeTypes[extension] || uploadMimeTypes[extension] !== mime) prototypeFailure(400, 'UPLOAD_INVALID', 'Extensión y MIME deben corresponder: PDF, PNG, JPEG, DOC/DOCX o XLS/XLSX.')
}
async function boundedBody(event: H3Event) {
  const declared = getHeader(event, 'content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximumBodyBytes)) prototypeFailure(413, 'UPLOAD_TOO_LARGE', 'Cuerpo multipart demasiado grande.')
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const request = event.node.req
    const fail = (cause: unknown) => { request.off('data', data); request.off('end', end); chunks.length = 0; request.resume(); reject(cause) }
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > maximumBodyBytes) {
        try { prototypeFailure(413, 'UPLOAD_TOO_LARGE', 'Cuerpo multipart demasiado grande.') } catch (cause) { fail(cause) }
      } else chunks.push(chunk)
    }
    const end = () => { request.off('error', fail); resolve(Buffer.concat(chunks, size)) }
    request.on('data', data); request.once('end', end); request.once('error', fail)
  })
}
export async function readPrototypeUpload(event: H3Event) {
  const contentType = getHeader(event, 'content-type') ?? ''
  const match = /^multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;\s]+))$/i.exec(contentType)
  const boundary = match?.[1] ?? match?.[2]
  if (!boundary || boundary.length > 70 || !/^[\w'()+,./:=?-]+$/.test(boundary)) prototypeFailure(400, 'UPLOAD_INVALID', 'Se requiere multipart válido.')
  const body = await boundedBody(event)
  const marker = Buffer.from(`--${boundary}`)
  const separator = Buffer.from(`\r\n--${boundary}`)
  if (!body.subarray(0, marker.length).equals(marker)) prototypeFailure(400, 'UPLOAD_INVALID', 'Multipart inválido.')
  const fields = new Map<string, string>()
  let file: { bytes: Buffer; name: string; mime: string } | undefined
  let offset = marker.length
  let count = 0
  while (!body.subarray(offset, offset + 2).equals(Buffer.from('--'))) {
    if (++count > 4 || body.toString('ascii', offset, offset + 2) !== '\r\n') prototypeFailure(400, 'UPLOAD_INVALID', 'Se admite un archivo y tres campos.')
    const headerEnd = body.indexOf('\r\n\r\n', offset + 2)
    if (headerEnd < 0 || headerEnd - offset > 4096) prototypeFailure(400, 'UPLOAD_INVALID', 'Cabeceras multipart inválidas.')
    const headers = body.toString('utf8', offset + 2, headerEnd)
    const disposition = /^Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]*)")?$/im.exec(headers)
    const end = body.indexOf(separator, headerEnd + 4)
    if (!disposition || end < 0) prototypeFailure(400, 'UPLOAD_INVALID', 'Campos multipart inválidos.')
    const key = disposition[1]!
    const value = body.subarray(headerEnd + 4, end)
    if (disposition[2] !== undefined) {
      if (key !== 'file' || file) prototypeFailure(400, 'UPLOAD_INVALID', 'Se admite exactamente un archivo.')
      const mime = /^Content-Type: ([^\r\n]+)$/im.exec(headers)?.[1]?.trim().toLowerCase() ?? ''
      file = { bytes: value, name: disposition[2], mime }
      validateUpload(file.name, mime, value.length)
    } else {
      if (!['kind', 'datasetId', 'expectedRevision'].includes(key) || fields.has(key) || value.length > 200) prototypeFailure(400, 'UPLOAD_INVALID', 'Campo duplicado, desconocido o demasiado largo.')
      fields.set(key, value.toString('utf8'))
    }
    offset = end + separator.length
  }
  if (!['', '\r\n'].includes(body.toString('ascii', offset + 2))) prototypeFailure(400, 'UPLOAD_INVALID', 'Contenido multipart sobrante.')
  const kind = fields.get('kind') ?? ''
  const datasetId = fields.get('datasetId') ?? ''
  const revision = fields.get('expectedRevision') ?? ''
  if (!file || !documentKinds.includes(kind) || !datasetPattern.test(datasetId) || !/^(0|[1-9]\d{0,9})$/.test(revision) || Number(revision) > 2_147_483_646) prototypeFailure(400, 'UPLOAD_INVALID', 'Archivo, tipo, dataset y revisión obligatorios.')
  return { ...file, kind, datasetId, expectedRevision: Number(revision) }
}
