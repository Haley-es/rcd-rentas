import { scryptSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { resolvePrototypeAccessRole } from '../../server/utils/prototype-access-role'
import { createPrototypeAuthStore } from '../../server/utils/prototype-auth-store'

const salt = '00112233445566778899aabbccddeeff'
const password = 'only-a-unit-test-secret'
const config = { adminUsername: 'admin', adminPasswordHash: `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}` }

describe('server access roles', () => {
  it('defaults to employee even for usernames matching business roles', async () => {
    for (const username of ['x', 'IT', 'Socio', 'Administrador IT', 'Admin']) {
      expect(await resolvePrototypeAccessRole(username, password, config)).toBe('Empleado')
    }
    expect(await resolvePrototypeAccessRole('admin', password, { adminUsername: '', adminPasswordHash: '' })).toBe('Empleado')
  })
  it('issues admin permission only with a configured and matching credential', async () => {
    expect(await resolvePrototypeAccessRole('admin', password, config)).toBe('Administrador IT')
    expect(await resolvePrototypeAccessRole('admin', 'wrong', config)).toBeNull()
    for (const hash of ['', 'scrypt:bad:bad', config.adminPasswordHash + ':extra']) {
      expect(await resolvePrototypeAccessRole('admin', password, { ...config, adminPasswordHash: hash })).toBeNull()
    }
  })
  it('retains the verified permission through MFA and revokes it with the session', () => {
    const store = createPrototypeAuthStore()
    const challenge = store.begin('admin', 'Administrador IT')
    const session = store.consume(challenge.id)!
    expect(store.session(session.sessionId)?.accessRole).toBe('Administrador IT')
    expect(store.consume(challenge.id)).toBeUndefined()
    store.revoke(session.sessionId, undefined)
    expect(store.session(session.sessionId)).toBeUndefined()
    expect(store.consume(store.begin('admin').id)?.accessRole).toBe('Empleado')
  })
})
