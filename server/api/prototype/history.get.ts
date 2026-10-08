import { defineEventHandler, getQuery } from 'h3'
import { requirePrototypeSession } from '../../utils/prototype-auth'
import { prototypeFailure } from '../../utils/prototype-errors'
import { readPrototypeHistory } from '../../services/prototype-history'

export default defineEventHandler(event => {
  const session = requirePrototypeSession(event)
  const query = getQuery(event)
  const { recordId, trash } = query
  if (Object.keys(query).some(key => !['recordId', 'trash'].includes(key)) ||
    recordId !== undefined && (typeof recordId !== 'string' || !recordId.trim() || recordId.length > 200) ||
    trash !== undefined && trash !== 'true') prototypeFailure(400, 'COMMAND_INVALID', 'Filtro de historial inválido.')
  return readPrototypeHistory(session, { recordId: recordId as string | undefined, trash: trash === 'true' })
})
