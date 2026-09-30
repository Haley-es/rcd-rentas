import { defineEventHandler } from 'h3'
import { requirePrototypeSession } from '../../../../server/utils/prototype-auth'

export default defineEventHandler(async (event) => {
  requirePrototypeSession(event)
  await new Promise(resolve => setTimeout(resolve, 5000))
  requirePrototypeSession(event)
  return { finished: true }
})
