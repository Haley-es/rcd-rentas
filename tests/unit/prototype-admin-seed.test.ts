import { scryptSync } from 'node:crypto'
import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { prototypeAdminSeed, prototypeEmployeeSeed, seedPrototypeUserContents } from '../../prisma/seed.mjs'
import { resolvePrototypeAccessRole } from '../../server/utils/prototype-access-role'

function accessConfig(contents: string) {
  const env = parseEnv(contents)
  return {
    adminUsername: env.NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME!, adminPasswordHash: env.NUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH!,
    employeeUsername: env.NUXT_PROTOTYPE_AUTH_EMPLOYEE_USERNAME!, employeePasswordHash: env.NUXT_PROTOTYPE_AUTH_EMPLOYEE_PASSWORD_HASH!,
  }
}

describe('local user seed', () => {
  it('creates both accounts without changing database settings or storing plaintext passwords', async () => {
    const source = '# Keep this setting\r\nDATABASE_URL="local-fixture"\r\nPROTOTYPE_UPLOAD_DIR=files\r\n'
    const seeded = seedPrototypeUserContents(source)
    expect(seeded.status).toBe('created')
    expect(seeded.contents.startsWith(source)).toBe(true)
    expect(seeded.contents).not.toContain(prototypeAdminSeed.password)
    const config = accessConfig(seeded.contents)
    expect(await resolvePrototypeAccessRole(prototypeAdminSeed.username, prototypeAdminSeed.password, config)).toBe('Administrador IT')
    expect(await resolvePrototypeAccessRole(prototypeAdminSeed.username, 'incorrecta', config)).toBeNull()
    expect(await resolvePrototypeAccessRole(prototypeEmployeeSeed.username, prototypeEmployeeSeed.password, config)).toBe(prototypeEmployeeSeed.accessRole)
    expect(await resolvePrototypeAccessRole(prototypeEmployeeSeed.username, 'incorrecta', config)).toBeNull()
    expect(await resolvePrototypeAccessRole('otro empleado demo', '!', config)).toBe('Empleado')
  })
  it('is idempotent and preserves an administrator whose password was rotated', () => {
    const seeded = seedPrototypeUserContents('')
    expect(seedPrototypeUserContents(seeded.contents)).toEqual({ contents: seeded.contents, status: 'present' })
    const custom = seeded.contents.replace(/NUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH=.*\n/, 'NUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH="rotated-hash"\n')
    expect(seedPrototypeUserContents(custom)).toEqual({ contents: custom, status: 'preserved' })
  })
  it('preserves a separately configured administrator', () => {
    const custom = 'NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME=otro\nNUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH=private-hash\n'
    const seeded = seedPrototypeUserContents(custom)
    expect(seeded.contents.startsWith(custom)).toBe(true)
    expect(accessConfig(seeded.contents).employeeUsername).toBe('empleado')
    expect(seedPrototypeUserContents(seeded.contents)).toEqual({ contents: seeded.contents, status: 'preserved' })
  })
  it('fills empty placeholders without duplicate assignments', () => {
    const seeded = seedPrototypeUserContents('export NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME = ""\nNUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH=\n')
    expect(seeded.contents.match(/NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME/g)).toHaveLength(1)
    expect(seeded.contents.match(/NUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH/g)).toHaveLength(1)
    expect(parseEnv(seeded.contents).NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME).toBe(prototypeAdminSeed.username)
  })
  it('rejects incomplete or ambiguous administrator configuration', () => {
    expect(() => seedPrototypeUserContents('NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME=otro\n')).toThrow('incompleta')
    expect(() => seedPrototypeUserContents('NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME=\nNUXT_PROTOTYPE_AUTH_ADMIN_USERNAME=\n')).toThrow('duplicadas')
    expect(() => seedPrototypeUserContents('NUXT_PROTOTYPE_AUTH_EMPLOYEE_USERNAME=otro\n')).toThrow('incompleta')
    expect(() => seedPrototypeUserContents('NUXT_PROTOTYPE_AUTH_EMPLOYEE_USERNAME=\nNUXT_PROTOTYPE_AUTH_EMPLOYEE_USERNAME=\n')).toThrow('duplicadas')
  })
  it('upgrades only the previous public admin seed and remains idempotent', async () => {
    const salt = 'a80f263c71294daba3125103d8a6ee3f'
    const hash = `scrypt:${salt}:${scryptSync('RCD-Demo-IT-2026!', salt, 64).toString('hex')}`
    const previous = `NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME=admin.it\nNUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH=${hash}\n`
    const seeded = seedPrototypeUserContents(previous)
    expect(seeded.status).toBe('updated')
    expect(accessConfig(seeded.contents).adminUsername).toBe('admin')
    expect(accessConfig(seeded.contents).employeeUsername).toBe('empleado')
    expect(await resolvePrototypeAccessRole('admin', 'localtest', accessConfig(seeded.contents))).toBe('Administrador IT')
    expect(await resolvePrototypeAccessRole('admin', 'RCD-Demo-IT-2026!', accessConfig(seeded.contents))).toBeNull()
    expect(seedPrototypeUserContents(seeded.contents)).toEqual({ contents: seeded.contents, status: 'present' })
    const rotated = previous.replace(hash, 'rotated-hash')
    expect(seedPrototypeUserContents(rotated).contents.startsWith(rotated)).toBe(true)
  })
  it('rejects role collisions and refuses ambiguous credentials at login', async () => {
    expect(() => seedPrototypeUserContents('NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME=empleado\nNUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH=custom\n')).toThrow('usuarios diferentes')
    const config = accessConfig(seedPrototypeUserContents('').contents)
    expect(await resolvePrototypeAccessRole('admin', 'localtest', { ...config, employeeUsername: 'admin' })).toBeNull()
  })
  it('preserves an employee whose password was rotated', () => {
    const seeded = seedPrototypeUserContents('')
    const custom = seeded.contents.replace(/NUXT_PROTOTYPE_AUTH_EMPLOYEE_PASSWORD_HASH=.*\n/, 'NUXT_PROTOTYPE_AUTH_EMPLOYEE_PASSWORD_HASH="rotated-hash"\n')
    expect(seedPrototypeUserContents(custom)).toEqual({ contents: custom, status: 'preserved' })
  })
})
