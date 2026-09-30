import { createError, isError } from 'h3'
import { PrototypeValidationError } from '../../shared/utils/prototype-validation'
import type { PrototypeErrorCode } from '../../shared/types/prototype'
import type { PrototypeFileErrorCode } from '../../shared/types/prototype-files'

export function prototypeFailure(statusCode: number, code: PrototypeErrorCode | PrototypeFileErrorCode, message: string, extra: object = {}): never {
  throw createError({ statusCode, statusMessage: code, data: { code, message, ...extra } })
}
export async function prototypeDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation() }
  catch (cause) {
    if (isError(cause)) throw cause
    const incidentId = crypto.randomUUID()
    // Do not log driver messages: SQL Server connection errors may include credentials.
    console.error('[prototype-store]', { incidentId, name: cause instanceof Error ? cause.name : 'Unknown',
      code: cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined })
    if (cause instanceof PrototypeValidationError) prototypeFailure(500, 'STATE_INVALID', 'Estado persistido inválido. No se ha reinicializado la demo.', { incidentId })
    prototypeFailure(503, 'DATABASE_UNAVAILABLE', 'SQL Server no disponible. No se ha confirmado ningún cambio. Reintenta la sincronización.', { incidentId })
  }
}
