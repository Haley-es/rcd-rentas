import { randomUUID, createHash } from 'node:crypto'
import { lstat, mkdir, open, rename, unlink, readFile, access, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, relative, isAbsolute, dirname, sep } from 'node:path'
import { prototypeFailure } from './prototype-errors'

const uuid = '[\\da-f]{8}(?:-[\\da-f]{4}){3}-[\\da-f]{12}'
export const storageKeyPattern = new RegExp(`^${uuid}\\\\${uuid}\\.(?:blob|tmp)$`, 'i')
export const datasetPattern = new RegExp(`^${uuid}$`, 'i')
export const hashBytes = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
export function storageIncident(operation: string, cause: unknown, key?: string) {
  console.error('[prototype-files]', { operation, key, code: cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : 'STORAGE' })
}
export function configuredUploadRoot() {
  const configured = process.env.PROTOTYPE_UPLOAD_DIR || resolve(process.cwd(), '.prototype-files')
  if (!isAbsolute(configured) || configured.startsWith('\\\\') || configured.startsWith('\\\\?\\')) throw new Error('PROTOTYPE_UPLOAD_DIR must be a private absolute local path.')
  const root = resolve(configured)
  const parts = root.toLowerCase().split(/[\\/]/)
  if (parts.some(part => ['public', '.output', '.nuxt', 'app', 'server'].includes(part))) throw new Error('PROTOTYPE_UPLOAD_DIR cannot be inside a served/source directory.')
  if (root === resolve(process.cwd()) || dirname(root) === root) throw new Error('PROTOTYPE_UPLOAD_DIR cannot be a workspace or filesystem root.')
  return root
}
async function noLinks(path: string) {
  const parent = dirname(path)
  if (parent !== path) await noLinks(parent)
  const info = await lstat(path)
  if (info.isSymbolicLink()) throw new Error('Filesystem links are forbidden in upload paths.')
}
async function checkExistingAncestors(path: string) {
  const parent = dirname(path)
  if (parent !== path) await checkExistingAncestors(parent)
  try {
    const info = await lstat(path)
    if (info.isSymbolicLink()) throw new Error('Filesystem links are forbidden in upload paths.')
  } catch (cause) {
    if (!(cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT')) throw cause
  }
}
export async function initializeUploadRoot() {
  const root = configuredUploadRoot()
  await checkExistingAncestors(root)
  await mkdir(root, { recursive: true })
  await noLinks(root)
  await access(root, constants.R_OK | constants.W_OK)
  return root
}
export async function resolveStorageKey(key: string) {
  if (!storageKeyPattern.test(key)) throw new Error('Invalid application storage key.')
  const root = await initializeUploadRoot()
  const path = resolve(root, ...key.split('\\'))
  const inside = relative(root, path)
  if (!inside || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error('Storage key outside private root.')
  const folder = dirname(path)
  await checkExistingAncestors(folder)
  await mkdir(folder, { recursive: true })
  await noLinks(folder)
  try { await noLinks(path) }
  catch (cause) { if (!(cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT')) throw cause }
  return path
}
export async function removeStoredFile(key: string): Promise<boolean> {
  try { await unlink(await resolveStorageKey(key)); return true }
  catch (cause) {
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT') return true
    storageIncident('cleanup-pending', cause, key)
    return false
  }
}
export async function stageStoredFile(datasetId: string, bytes: Buffer) {
  if (!datasetPattern.test(datasetId)) prototypeFailure(400, 'UPLOAD_INVALID', 'Dataset inválido.')
  const id = randomUUID()
  const temporaryKey = `${datasetId}\\${id}.tmp`
  const storageKey = `${datasetId}\\${id}.blob`
  try {
    const handle = await open(await resolveStorageKey(temporaryKey), 'wx', 0o600)
    try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
    await rename(await resolveStorageKey(temporaryKey), await resolveStorageKey(storageKey))
    return { id, storageKey, size: bytes.length, sha256: hashBytes(bytes) }
  } catch (cause) {
    storageIncident('write', cause)
    const temporaryRemoved = await removeStoredFile(temporaryKey)
    const finalRemoved = await removeStoredFile(storageKey)
    prototypeFailure(503, 'FILE_STORAGE_FAILED', 'No se ha guardado el archivo. Ningún cambio confirmado.', {
      cleanupPending: !temporaryRemoved || !finalRemoved,
    })
  }
}
export async function readStoredFile(row: { storageKey: string; size: number; sha256: string }) {
  try {
    const bytes = await readFile(await resolveStorageKey(row.storageKey))
    if (bytes.length !== row.size || hashBytes(bytes) !== row.sha256) throw new Error('Blob checksum mismatch.')
    return bytes
  } catch (cause) {
    storageIncident('read', cause, row.storageKey)
    prototypeFailure(503, 'FILE_UNAVAILABLE', 'Archivo conocido no disponible. Revisa disco y copia de seguridad; no se entrega otra muestra.')
  }
}
export async function storedFileAvailable(row: { storageKey: string; size: number }) {
  try {
    const path = await resolveStorageKey(row.storageKey)
    const info = await lstat(path)
    if (!info.isFile() || info.size !== row.size) throw new Error('Blob missing or size mismatch.')
    await access(path, constants.R_OK)
    return true
  } catch (cause) {
    storageIncident('availability', cause, row.storageKey)
    return false
  }
}
export async function reconcileStoredFiles(referenced: ReadonlySet<string>, clean = false, now = Date.now()) {
  const root = await initializeUploadRoot()
  const candidates: string[] = []
  const removed: string[] = []
  const failed: string[] = []
  for (const folder of await readdir(root, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.isSymbolicLink() || !datasetPattern.test(folder.name)) continue
    await noLinks(resolve(root, folder.name))
    for (const entry of await readdir(resolve(root, folder.name), { withFileTypes: true })) {
      const key = `${folder.name}\\${entry.name}`
      if (!entry.isFile() || entry.isSymbolicLink() || !storageKeyPattern.test(key) || referenced.has(key)) continue
      const info = await lstat(await resolveStorageKey(key))
      if (now - info.mtimeMs < 86_400_000) continue
      candidates.push(key)
      if (clean) (await removeStoredFile(key) ? removed : failed).push(key)
    }
  }
  return { candidates, removed, failed }
}
