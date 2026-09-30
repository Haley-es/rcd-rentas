import { defineEventHandler } from 'h3'
import { readPrototypeAuthInput, revokePrototypeSession } from '../../utils/prototype-auth'

export default defineEventHandler(async (event) => {
  await readPrototypeAuthInput(event)
  return revokePrototypeSession(event)
})
