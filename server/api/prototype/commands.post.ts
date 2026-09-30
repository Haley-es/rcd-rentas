import { defineEventHandler } from 'h3'
import { requirePrototypeSession } from '../../utils/prototype-auth'
import { readPrototypeCommand } from '../../utils/prototype-input'
import { executePrototypeCommand } from '../../services/prototype-commands'

export default defineEventHandler(async event => {
  const session = requirePrototypeSession(event)
  return executePrototypeCommand(session, await readPrototypeCommand(event))
})
