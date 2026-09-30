import { PrismaClient } from '@prisma/client'
import { reconcileStoredFiles } from '../server/utils/prototype-file-storage.ts'

process.loadEnvFile()
const clean = process.argv.includes('--clean')
if (process.argv.some(value => value.startsWith('--') && !['--clean', '--confirm'].includes(value))) throw new Error('Unknown option.')
if (clean && !process.argv.includes('--confirm')) throw new Error('Cleanup requires --clean --confirm; inspection is default.')
const db = new PrismaClient({ errorFormat: 'minimal', log: [] })
try {
  const rows = await db.prototypeFile.findMany({ select: { storageKey: true } })
  const result = await reconcileStoredFiles(new Set(rows.map(row => row.storageKey)), clean)
  console.log(JSON.stringify(result, null, 2))
  if (result.failed.length) process.exitCode = 1
} catch (cause) {
  console.error('Reconciliation failed; no automatic reset.', {
    name: cause instanceof Error ? cause.name : 'Unknown',
    code: cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : 'STORAGE',
  })
  process.exitCode = 1
} finally { await db.$disconnect() }
