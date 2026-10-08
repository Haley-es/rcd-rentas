# Usuarios de demostración

El seed local define una cuenta de **Administrador IT** y una de **Empleado** para las pruebas:

| Campo | Administrador IT | Empleado |
| --- | --- | --- |
| Usuario | `admin` | `empleado` |
| Contraseña de demo | `localtest` | `localtest` |
| Código MFA de ejemplo | `123456` | `123456` |
| Permiso de acceso | Administrador IT | Empleado |
| Rol de negocio inicial | Profesional | Profesional |

Estas credenciales son públicas y exclusivas de esta demostración local. El MFA acepta cualquier código no vacío cuando la URL usa `localhost`, `127.0.0.1` o `::1`; por ejemplo `123456` o `cualquier MFA`. Fuera de esos hosts se rechaza el acceso con `MFA_LOCAL_ONLY`: el prototipo no implementa un proveedor MFA real. No se deben usar para producción ni con datos reales.

## Preparación y acceso

Con `.env` configurado para SQL Server localhost y la base `RCDRenta`, ejecuta:

```powershell
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Si ya hay un servidor abierto, reinícialo después del seed. Abre `http://localhost:3010/login`, introduce usuario y contraseña anteriores y completa el MFA simulado.

El prototipo resuelve los permisos de acceso desde la configuración privada del servidor. El seed guarda ambos usuarios y sus hashes scrypt en `.env`, mediante `NUXT_PROTOTYPE_AUTH_ADMIN_USERNAME`, `NUXT_PROTOTYPE_AUTH_ADMIN_PASSWORD_HASH`, `NUXT_PROTOTYPE_AUTH_EMPLOYEE_USERNAME` y `NUXT_PROTOTYPE_AUTH_EMPLOYEE_PASSWORD_HASH`. Las contraseñas no se guardan en texto plano ni se añaden al estado de expedientes enviado al navegador.

Ambas cuentas requieren exactamente su contraseña configurada: `localtest` en este seed. Las pruebas reutilizan estos mismos usuarios. Los nombres sin configurar mantienen el acceso simulado de Empleado con cualquier contraseña no vacía; nunca reciben Administrador IT.

El comando es idempotente: repetirlo conserva el mismo acceso. Actualiza el antiguo seed público `admin.it` a `admin / localtest` solamente cuando conserva el hash original. Si existe una cuenta personalizada o se ha cambiado su contraseña, conserva esa configuración; no vuelve a habilitar la contraseña pública. Una configuración parcial, duplicada o con el mismo usuario para ambos permisos se rechaza. No reinicia expedientes, historial, papelera ni archivos, y no se ejecuta automáticamente al arrancar. Para sustituir el acceso del administrador por una contraseña aleatoria, usa `node scripts/prototype-admin.mjs <usuario>` y reinicia el servidor.

## Comprobación de permisos

- **Administrador IT:** ve Papelera, los eventos DELETE y los cambios anteriores de expedientes eliminados. Puede restaurarlos con su ID original.
- **Empleado:** usa la cuenta del seed `empleado`, con contraseña `localtest` y cualquier MFA no vacío en localhost. No ve Papelera ni datos de eliminados; la API y RLS también lo bloquean.
- **Simular rol:** cambia únicamente el rol de negocio. Seleccionar IT, Socio o Profesional no convierte un empleado en Administrador IT. El modo Cliente mantiene su acceso restringido al portal.

## Pruebas Playwright

```powershell
pnpm exec playwright test --config playwright.prototype.config.ts prototype-access-roles.spec.ts prototype-history.spec.ts
pnpm exec playwright test prototype-08-auth.spec.ts
```

Estas pruebas usan las mismas cuentas y la misma lógica del seed en un servidor aislado, puerto **3011**, con la base **RCDRentaE2E**. No modifican la configuración de acceso ni los expedientes de desarrollo. Cubren contraseñas correctas e incorrectas de ambas cuentas, MFA arbitrario en localhost, rechazo de hosts externos y cabeceras reenviadas, reinicio y reset, ocultación de Papelera a `empleado`, restauración, logout, consultas SQL bajo RLS y vistas móviles a 320 y 390 píxeles.

Playwright guarda una captura de acceso en `test-results/seed-admin-papelera.png`.

Validación del 3 de octubre de 2026: **23 pruebas Playwright correctas** (13 de permisos/historial y 10 de autenticación), **88 unitarios correctos** y `pnpm typecheck` correcto. El seed local actualizó las cuentas a `admin` y `empleado`; una segunda ejecución devolvió `present` sin cambiar la configuración.
