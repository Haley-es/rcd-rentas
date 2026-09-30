import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import { requirePrototypeSession } from '../../../utils/prototype-auth'
import { readPrototypePortal } from '../../../services/prototype-store'

export default defineEventHandler(event => readPrototypePortal(requirePrototypeSession(event), {
  caseId: getRouterParam(event, 'id') ?? '', token: getQuery(event).token,
}))
