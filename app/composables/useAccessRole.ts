import { isItAdministrator } from '../../shared/types/access-role'
import type { AccessRole } from '../../shared/types/access-role'

export function useAccessRole() {
  const { session } = usePrototypeAuth()
  const accessRole = computed<AccessRole>(() => session.value.authenticated ? session.value.user.accessRole : 'Empleado')
  const isAdminIT = computed(() => session.value.authenticated && isItAdministrator(accessRole.value))
  return { accessRole, isAdminIT }
}
