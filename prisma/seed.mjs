import { scryptSync } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'

// Public demo credentials. This module is only used by local tooling and tests,
// never imported into the app or accepted as a runtime authentication fallback.
export const prototypeAdminSeed = Object.freeze({
  username: 'admin',
  password: 'localtest',
  mfaCode: '123456',
  accessRole: 'Administrador IT',
})

export const prototypeEmployeeSeed = Object.freeze({
  username: 'empleado',
  password: 'localtest',
  mfaCode: '123456',
  accessRole: 'Empleado',
})

const salt = 'a80f263c71294daba3125103d8a6ee3f'
const passwordHash = `scrypt:${salt}:${scryptSync(prototypeAdminSeed.password, salt, 64).toString('hex')}`
const legacyAdminHash = `scrypt:${salt}:${scryptSync('RCD-Demo-IT-2026!', salt, 64).toString('hex')}`

export function seedPrototypeUserContents(source) {
  const existing = parseEnv(source)
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  let contents = source
  const statuses = []
  for (const [kind, account] of [['ADMIN', prototypeAdminSeed], ['EMPLOYEE', prototypeEmployeeSeed]]) {
    const usernameKey = `NUXT_PROTOTYPE_AUTH_${kind}_USERNAME`
    const hashKey = `NUXT_PROTOTYPE_AUTH_${kind}_PASSWORD_HASH`
    for (const key of [usernameKey, hashKey]) {
      const pattern = new RegExp(`^[\\t ]*(?:export[\\t ]+)?${key}[\\t ]*=.*$`, 'gm')
      if ([...source.matchAll(pattern)].length > 1) throw new Error('Variables de acceso duplicadas. El seed no las ha modificado.')
    }
    const username = existing[usernameKey]
    const hash = existing[hashKey]
    if (Boolean(username) !== Boolean(hash)) throw new Error('Configuración de acceso incompleta. El seed no la ha modificado.')
    // Upgrade only the known public seed; never overwrite rotated credentials.
    const legacy = kind === 'ADMIN' && username === 'admin.it' && hash === legacyAdminHash
    if (username && hash && !legacy) {
      statuses.push(username === account.username && hash === passwordHash ? 'present' : 'preserved')
      continue
    }
    for (const [key, value] of [[usernameKey, account.username], [hashKey, passwordHash]]) {
      const pattern = new RegExp(`^[\\t ]*(?:export[\\t ]+)?${key}[\\t ]*=.*$`, 'gm')
      const line = `${key}=${JSON.stringify(value)}`
      contents = pattern.test(contents) ? contents.replace(pattern, () => line) :
        `${contents}${contents && !contents.endsWith('\n') ? newline : ''}${line}${newline}`
    }
    statuses.push(legacy ? 'updated' : 'created')
  }
  const configured = parseEnv(contents)
  if (configured.NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME === configured.NUXT_PROTOTYPE_AUTH_EMPLOYEE_USERNAME) {
    throw new Error('Administrador y empleado deben tener usuarios diferentes. El seed no ha modificado la configuración.')
  }
  return { contents, status: ['updated', 'created', 'preserved', 'present'].find(status => statuses.includes(status)) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2 || process.env.NODE_ENV === 'production') {
    throw new Error('Este seed solo admite ejecución explícita de demo local: pnpm db:seed.')
  }
  const path = resolve('.env')
  const source = readFileSync(path, 'utf8')
  const database = parseEnv(source).DATABASE_URL ?? ''
  if (!/^sqlserver:\/\/(?:localhost|127\.0\.0\.1)(?=[:;])/i.test(database) ||
    !/;database=RCDRenta(?:E2E)?(?=;|$)/i.test(database)) {
    throw new Error('El seed requiere SQL Server localhost y RCDRenta o RCDRentaE2E en .env.')
  }
  const result = seedPrototypeUserContents(source)
  if (result.contents !== source) writeFileSync(path, result.contents, { mode: 0o600 })
  const configured = parseEnv(result.contents)
  console.log(`Seed de usuarios: ${result.status}. Administrador IT: ${configured.NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME}. Empleado: ${configured.NUXT_PROTOTYPE_AUTH_EMPLOYEE_USERNAME}.`)
  console.log('Las credenciales personalizadas se conservan. Acceso documentado en docs/usuarios-demo.md.')
  console.log('Sin cambios en expedientes, historial ni archivos. Reinicia el servidor para cargar la configuración.')
}
