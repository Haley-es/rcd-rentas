import { scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { AccessRole } from '../../shared/types/access-role'

const deriveKey = promisify(scrypt)

// Business-role simulation never grants this permission. Only server config and
// a verified credential can issue an administrator session.
export async function resolvePrototypeAccessRole(username: string, password: string,
  config: { adminUsername: string; adminPasswordHash: string; employeeUsername?: string; employeePasswordHash?: string }): Promise<AccessRole | null> {
  const admin = Boolean(config.adminUsername) && username === config.adminUsername
  const employee = Boolean(config.employeeUsername) && username === config.employeeUsername
  if (admin && employee) return null
  if (!admin && !employee) return 'Empleado'
  const hash = admin ? config.adminPasswordHash : config.employeePasswordHash
  const [algorithm, salt, expected, extra] = (hash ?? '').split(':')
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{32}$/.test(salt) ||
    !expected || !/^[a-f0-9]{128}$/.test(expected) || extra !== undefined) return null
  const actual = await deriveKey(password, salt, 64) as Buffer
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) ? (admin ? 'Administrador IT' : 'Empleado') : null
}
