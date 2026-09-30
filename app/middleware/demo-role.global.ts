export default defineNuxtRouteMiddleware((to) => {
  const { role } = useMockApp()
  if (role.value === 'Cliente' && !to.path.startsWith('/portal/')) return navigateTo('/portal/DEMO-R08?token=demo-DEMO-R08')
})
