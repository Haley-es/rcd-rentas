import { randomBytes, scryptSync } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const username = process.argv[2]?.trim()
if (!username || /[\r\n"\\]/.test(username) || process.argv.length !== 3) {
  throw new Error('Uso: node scripts/prototype-admin.mjs <usuario>. Configura el administrador local en .env.')
}
const path = resolve('.env')
let contents = readFileSync(path, 'utf8')
const password = randomBytes(24).toString('base64url')
const salt = randomBytes(16).toString('hex')
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`
for (const [key, value] of Object.entries({
  NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME: username,
  NUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH: hash,
})) {
  const line = `${key}=${JSON.stringify(value)}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  contents = pattern.test(contents) ? contents.replace(pattern, () => line) : `${contents.trimEnd()}\n${line}\n`
}
writeFileSync(path, contents, { mode: 0o600 })
console.log(`Administrador IT: ${username}\nContraseña generada (guárdala ahora): ${password}\nReinicia el servidor para aplicar el acceso y revocar las sesiones anteriores.`)
