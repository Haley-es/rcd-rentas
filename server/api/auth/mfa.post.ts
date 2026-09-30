import { defineEventHandler } from 'h3'
import { completePrototypeMfa, prototypeAuthText, readPrototypeAuthInput } from '../../utils/prototype-auth'

export default defineEventHandler(async (event) => {
  const body = await readPrototypeAuthInput(event)
  prototypeAuthText(body.code, 'Código MFA simulado')
  return completePrototypeMfa(event)
})
