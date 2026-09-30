import { defineEventHandler } from 'h3'
import { getPrototypeSession } from '../../utils/prototype-auth'

export default defineEventHandler(event => getPrototypeSession(event))
