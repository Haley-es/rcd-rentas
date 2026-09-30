import { defineEventHandler, getRequestURL, setHeader } from 'h3'
import { requirePrototypeMutationContentType, requirePrototypeOrigin, requirePrototypeSession } from '../utils/prototype-auth'

const publicRoutes = new Set([
  'GET /api/auth/session', 'POST /api/auth/login', 'POST /api/auth/mfa', 'POST /api/auth/logout',
])

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (path !== '/api' && !path.startsWith('/api/')) return
  setHeader(event, 'Cache-Control', 'no-store')
  requirePrototypeOrigin(event)
  if (!publicRoutes.has(`${event.method} ${path}`)) {
    requirePrototypeSession(event)
    requirePrototypeMutationContentType(event)
  }
})
