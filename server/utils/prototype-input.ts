import { getHeader, readBody, type H3Event } from 'h3'
import type { CommandEnvelope } from '../../shared/types/prototype'
import { assertCommandEnvelope, PrototypeValidationError } from '../../shared/utils/prototype-validation'
import { prototypeFailure } from './prototype-errors'
import { requirePrototypeMutationContentType, requirePrototypeOrigin, requirePrototypeSession } from './prototype-auth'

export async function readPrototypeCommand(event: H3Event): Promise<CommandEnvelope> {
  requirePrototypeSession(event)
  requirePrototypeOrigin(event)
  requirePrototypeMutationContentType(event)
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    prototypeFailure(400, 'COMMAND_INVALID', 'Los comandos requieren JSON.')
  }
  const body: unknown = await readBody(event)
  try { assertCommandEnvelope(body) }
  catch (cause) {
    if (!(cause instanceof PrototypeValidationError)) throw cause
    prototypeFailure(400, 'COMMAND_INVALID', cause.message)
  }
  return body
}
