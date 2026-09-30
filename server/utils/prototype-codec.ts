import type { PrototypePayload } from '../../shared/types/prototype'
import { assertPrototypePayload, PrototypeValidationError } from '../../shared/utils/prototype-validation'

export function decodePrototypePayload(payload: string, schemaVersion: number): PrototypePayload {
  if (schemaVersion !== 1) throw new PrototypeValidationError('Versión de estado no compatible.')
  let parsed: unknown
  try { parsed = JSON.parse(payload) }
  catch { throw new PrototypeValidationError('JSON de estado corrupto.') }
  assertPrototypePayload(parsed)
  return parsed
}

export function encodePrototypePayload(payload: PrototypePayload): string {
  assertPrototypePayload(payload)
  return JSON.stringify(payload)
}
