export type AccessRole = 'Empleado' | 'Administrador IT'

export const isItAdministrator = (role: AccessRole | undefined) => role === 'Administrador IT'
