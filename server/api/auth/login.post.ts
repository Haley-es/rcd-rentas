import { defineEventHandler } from 'h3'
import { beginPrototypeLogin, prototypeAuthText, readPrototypeAuthInput } from '../../utils/prototype-auth'

export default defineEventHandler(async (event) => {
  const body = await readPrototypeAuthInput(event)
  const username = prototypeAuthText(body.username, 'Usuario')
  prototypeAuthText(body.password, 'Contraseña')
  return beginPrototypeLogin(event, username)
})
