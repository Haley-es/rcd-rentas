import { prototypeReturnTo } from '#shared/utils/prototype-return-to'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = usePrototypeAuth()
  let session
  try {
    session = await auth.refresh()
  } catch {
    if (to.path !== '/login') return navigateTo('/login')
    return
  }
  const returnTo = prototypeReturnTo(to.query.returnTo)
  if (to.path === '/login') {
    if (session.authenticated) return navigateTo(returnTo)
    if (to.query.authError === 'MFA_CHALLENGE_INVALID') {
      auth.error.value = 'Desafío MFA ausente, consumido o caducado. Inicia sesión de nuevo.'
    }
    return
  }
  if (to.path === '/mfa') {
    if (session.authenticated) return navigateTo(returnTo)
    if (!session.pendingMfa) {
      auth.error.value = 'Desafío MFA ausente, consumido o caducado. Inicia sesión de nuevo.'
      return navigateTo({ path: '/login', query: { returnTo, authError: 'MFA_CHALLENGE_INVALID' } })
    }
    return
  }
  if (!session.authenticated) {
    return navigateTo({ path: '/login', query: { returnTo: prototypeReturnTo(to.fullPath) } })
  }
})
