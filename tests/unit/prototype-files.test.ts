import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, unlink, utimes, writeFile, readdir, rmdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { validateUpload } from '../../server/utils/prototype-upload'
import { initializeUploadRoot, resolveStorageKey, stageStoredFile, readStoredFile, removeStoredFile, reconcileStoredFiles } from '../../server/utils/prototype-file-storage'

describe('prototype files', () => {
  it('validates exact decimal limits, coherent MIME and safe names', () => {
    expect(() => validateUpload('sample.pdf', 'application/pdf', 10_000_000)).not.toThrow()
    for (const [name, mime, size] of [
      ['sample.pdf', 'application/pdf', 0], ['sample.pdf', 'application/pdf', 10_000_001],
      ['sample.pdf', 'image/png', 1], ['../sample.pdf', 'application/pdf', 1],
      ['folder\\sample.pdf', 'application/pdf', 1], ['CON.pdf', 'application/pdf', 1],
      ['sample\r\n.pdf', 'application/pdf', 1], ['sample.html', 'text/html', 1],
    ] as const) expect(() => validateUpload(name, mime, size)).toThrow()
  })
  it('stores exact bytes, rejects paths and reconciles only aged application orphans', async () => {
    const previous = process.env.PROTOTYPE_UPLOAD_DIR
    const root = await mkdtemp(join(tmpdir(), 'rcd-files-unit-'))
    process.env.PROTOTYPE_UPLOAD_DIR = root
    const dataset = randomUUID()
    try {
      await initializeUploadRoot()
      await expect(resolveStorageKey('..\\outside.pdf')).rejects.toThrow()
      const outside = await mkdtemp(join(tmpdir(), 'rcd-outside-unit-'))
      const linkedDataset = randomUUID()
      const junction = resolve(root, linkedDataset)
      try {
        await symlink(outside, junction, 'junction')
        await expect(resolveStorageKey(`${linkedDataset}\\${randomUUID()}.blob`)).rejects.toThrow('links')
        expect(await readdir(outside)).toEqual([])
      } finally { await unlink(junction); await rmdir(outside) }
      const first = await stageStoredFile(dataset, Buffer.from('bytes\u0000ñ'))
      const orphan = await stageStoredFile(dataset, Buffer.from('orphan'))
      const fresh = await stageStoredFile(dataset, Buffer.from('fresh'))
      const temp = `${dataset}\\${randomUUID()}.tmp`
      await writeFile(await resolveStorageKey(temp), 'active')
      const unknown = resolve(root, dataset, 'untouched.txt')
      await writeFile(unknown, 'never delete')
      const yesterday = new Date(Date.now() - 86_400_001)
      await utimes(await resolveStorageKey(orphan.storageKey), yesterday, yesterday)
      expect(await readStoredFile(first)).toEqual(Buffer.from('bytes\u0000ñ'))
      expect((await reconcileStoredFiles(new Set([first.storageKey]))).candidates).toEqual([orphan.storageKey])
      expect(await readFile(await resolveStorageKey(orphan.storageKey), 'utf8')).toBe('orphan')
      expect((await reconcileStoredFiles(new Set([first.storageKey]), true)).removed).toEqual([orphan.storageKey])
      expect(await readStoredFile(fresh)).toEqual(Buffer.from('fresh'))
      await removeStoredFile(first.storageKey)
      await expect(readStoredFile(first)).rejects.toMatchObject({ statusCode: 503, data: { code: 'FILE_UNAVAILABLE' } })
      await removeStoredFile(fresh.storageKey)
      await removeStoredFile(temp)
      await unlink(unknown)
    } finally {
      if (previous === undefined) delete process.env.PROTOTYPE_UPLOAD_DIR
      else process.env.PROTOTYPE_UPLOAD_DIR = previous
      for (const name of await readdir(root)) await rmdir(resolve(root, name))
      await rmdir(root)
    }
  })
})
