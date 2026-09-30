export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/mfa') return
  const { role, refresh } = useMockApp()
  await refresh(to.path, to.query.token)
  if (role.value === 'Cliente' && !to.path.startsWith('/portal/')) return navigateTo('/portal/DEMO-R08?token=demo-DEMO-R08')
})
