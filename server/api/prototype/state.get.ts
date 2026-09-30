import { defineEventHandler } from 'h3'
import { requirePrototypeSession } from '../../utils/prototype-auth'
import { readPrototypeState } from '../../services/prototype-store'

export default defineEventHandler(event => readPrototypeState(requirePrototypeSession(event)))
