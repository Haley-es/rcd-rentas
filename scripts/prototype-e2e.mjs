import { PrismaClient } from '@prisma/client'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
export function prototypeTestDatabaseURL() {
  if (!process.env.DATABASE_URL) process.loadEnvFile()
  const source = process.env.PROTOTYPE_E2E_DATABASE_URL ??
    process.env.DATABASE_URL?.replace(/;database=RCDRenta(?=;|$)/i, ';database=RCDRentaE2E')
  if (!source || !/^sqlserver:\/\/(?:localhost|127\.0\.0\.1)(?=[:;])/i.test(source) ||
    !/;database=RCDRentaE2E(?=;|$)/i.test(source)) {
    throw new Error('E2E requires explicit localhost database RCDRentaE2E; development resets forbidden.')
  }
  return source
}
export async function deployPrototypeTestDatabase() {
  const url = prototypeTestDatabaseURL()
  const db = new PrismaClient({ datasourceUrl: url, errorFormat: 'minimal', log: [] })
  try { await db.$queryRaw`SELECT 1 AS connected` }
  catch (cause) {
    throw new Error(`RCDRentaE2E unavailable (${cause?.code ?? 'connection'}). Provision database and grant existing login first.`)
  } finally { await db.$disconnect() }
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`E2E migrate deploy exited ${code}`)))
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await deployPrototypeTestDatabase()
