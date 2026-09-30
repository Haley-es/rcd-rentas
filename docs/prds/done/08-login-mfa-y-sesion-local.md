# PRD 08. Login, MFA simulado y sesión local

## Objetivo y alcance

Convertir el acceso libre del mockup en un acceso autenticado para un prototipo exclusivamente local. El usuario introduce un usuario y una contraseña, confirma un segundo factor ficticio y accede a los mismos recorridos de demostración. Cualquier valor no vacío es válido en cada campo. No se comprueban identidades, contraseñas, OTP ni proveedores externos.

**Estado:** implementado y validado como prototipo local.
**Origen:** nueva petición de prototipo local; complementa los PRDs históricos 01–07, no convierte sus simulaciones en servicios de producción.
**Dependencias:** ninguna para implementar esta capa sobre el mockup actual.
**Salidas:** [PRD 09: persistencia SQL Server](09-persistencia-prisma-sql-server.md) depende de sus contratos de sesión y protección. [PRD 10: archivos locales](10-archivos-locales-y-arranque.md) depende de 08 y 09.
**Pruebas propias:** `tests/e2e/prototype-08-auth.spec.ts`.

Esta entrega modifica el acceso, no el motor fiscal ni la persistencia del negocio. Durante 08, el estado de negocio todavía vive en `useMockApp`; durante 09 deja de ser un estado en memoria. Correo, Teams, firma, NAV, Criteria, presentación y extractor siguen simulados.

## Contexto comprobado

- `app/composables/useMockApp.ts` crea los 18 escenarios con `useState`, mantiene el rol y ejecuta `runAction` de forma síncrona.
- `app/middleware/demo-role.global.ts` solo redirige el rol Cliente. No autentica y no debe reutilizarse como middleware de seguridad.
- `app/layouts/default.vue` incorpora el selector de rol y un layout reducido para el portal. Actualmente no distingue las rutas de login.
- `app/pages/portal/[id].vue` compara en el navegador `token=demo-<id>` y obtiene el expediente desde el mismo listado interno.
- Los E2E existentes abren directamente páginas internas y portal; necesitan un login previo, no eliminar sus comprobaciones de negocio.

## Comportamiento funcional

### 1. Usuario y contraseña

Crear `/login` con layout de acceso separado y campos accesibles «Usuario» y «Contraseña». Usuario y contraseña son válidos si contienen al menos un carácter distinto de espacio; valores vacíos o compuestos solo por espacios muestran un error y no crean desafío. No aplicar reglas de email, longitud mínima, complejidad ni cuentas predefinidas. Admitir contraseñas cortas y símbolos; no guardar ni registrar su contenido.

Al confirmar, el servidor crea un desafío pendiente y redirige a `/mfa`. Este paso todavía no concede acceso a datos, APIs de negocio ni descargas. El desafío dura exactamente 5 minutos desde su creación, según reloj real del servidor, nunca según el reloj fiscal de demostración.

### 2. MFA ficticio

Crear `/mfa` con un campo accesible «Código MFA simulado». Cualquier texto no vacío tras comprobar espacios es válido; no exigir seis dígitos ni una expresión de OTP. El aviso indica expresamente «MFA simulado: cualquier valor no vacío es válido».

Solo un desafío pendiente válido permite completar el paso. Acceder directamente a `/mfa` sin desafío, reutilizarlo después de consumirlo o confirmar uno caducado devuelve un error visible y conduce a iniciar sesión de nuevo. Al completar MFA se consume el desafío, se elimina su cookie y se emite una sesión nueva con identificador distinto.

### 3. Sesión y logout

- Sesión de 8 horas absolutas desde la confirmación MFA, sin renovación deslizante. Consultar la sesión no prolonga su duración.
- Cookie `rcd-prototype-session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, sin `Domain`. `Secure` en HTTPS; en el HTTP de localhost no se establece `Secure`. Duración de cookie coherente con la expiración servidor.
- Cookie pendiente `rcd-prototype-challenge` con los mismos atributos y duración de 5 minutos.
- Identificadores opacos generados con al menos 32 bytes aleatorios criptográficos. No guardar usuario, contraseña, roles ni datos fiscales en la cookie.
- Registro servidor de desafíos y sesiones en memoria del proceso Nitro. Es estado efímero de autenticación, no un almacén alternativo del negocio. Un reinicio invalida sesiones y exige repetir login; no borra datos SQL ni archivos cuando existan.
- `POST /api/auth/logout` revoca la sesión en el registro servidor y borra ambas cookies. Es idempotente incluso sin sesión.
- Login y MFA no usan `localStorage`, `sessionStorage` ni tokens accesibles mediante JavaScript. El usuario puede mostrarse como nombre de demostración, nunca como identidad verificada.
- Al recibir 401, el cliente elimina los datos sensibles de sus estados Nuxt, cancela operaciones pendientes y vuelve a login. No conserva un expediente visible tras logout o caducidad.

### 4. Protección independiente

Crear `usePrototypeAuth` para consultar y completar los pasos de acceso. Crear un middleware de navegación independiente que se ejecute antes de `demo-role.global.ts`. Login y MFA usan layout de acceso; el middleware demo no debe redirigir estas rutas cuando el rol sea Cliente.

Proteger `/`, `/expedientes`, `/expedientes/:id`, `/campanas`, `/tareas` y `/portal/:id`, tanto en entrada SSR como en navegación cliente. No enviar datos del mockup en HTML o payload SSR de una página rechazada. El estado de negocio solo se inicializa o carga después de confirmar la sesión.

Un middleware Nitro protege todos los `/api/**` existentes y futuros salvo las rutas de autenticación declaradas abajo. La comprobación se repite en helpers reutilizables antes de leer o modificar datos. Una redirección de Vue o un selector de rol no protegen una API.

Las mutaciones requieren el mismo origen que la aplicación, sin CORS permisivo. Comprobar `Origin` y rechazar origen ajeno o ausente en solicitudes HTTP mutantes del navegador; las llamadas SSR internas usan un contexto servidor explícitamente confiable, no una cabecera que el cliente pueda falsificar. Login, MFA y logout también cumplen esta regla. JSON exige `Content-Type: application/json`; la carga multipart de 10 tendrá su validación específica.

`returnTo` solo acepta una ruta relativa interna que empiece por una única `/`, con query local opcional; rechaza URLs absolutas, `//`, barras invertidas y rutas de acceso que formen bucles. Conservar el portal solicitado y su query después del login. No redirigir fuera de localhost.

### 5. Rol demo y portal

Todos los usuarios que completan el acceso son operadores del prototipo con posibilidad de simular los roles existentes. No se introduce un directorio de usuarios, una asignación de expedientes por persona ni RBAC de producción. Advertir que introducir cualquier usuario no acredita autorización real.

El selector sigue siendo una simulación del actor de negocio; no omite login ni permite al portal recibir el listado interno. El token determinista del enlace sigue siendo un identificador de demostración, no una credencial suficiente para acceder sin sesión. Durante 08, conservar el rechazo visual de enlaces inválidos; 09 trasladará su comprobación y proyección de datos al servidor.

## Contratos compartidos obligatorios

El agente de 08 crea y es propietario de `shared/types/prototype-auth.ts`:

```ts
type PrototypeSession =
  | { authenticated: false; pendingMfa: boolean }
  | { authenticated: true; user: { username: string }; expiresAt: string }
```

Los detalles internos de la sesión no se incluyen en el DTO. `expiresAt` es ISO UTC. El nombre se conserva recortado, con comparación sensible a mayúsculas para las preferencias locales de 09; no se almacenan contraseñas ni códigos MFA.

Endpoints públicos en la lista de exclusión del middleware:

- `GET /api/auth/session`: devuelve `PrototypeSession`, también sin sesión, con `Cache-Control: no-store`.
- `POST /api/auth/login`: recibe `{ username, password }`; responde `{ next: '/mfa' }`, crea solo el desafío.
- `POST /api/auth/mfa`: recibe `{ code }`; devuelve la sesión autenticada.
- `POST /api/auth/logout`: responde `{ ok: true }` y revoca las cookies.

Los errores usan el formato de error de H3, con `data: { code, message }`. Códigos compartidos de 08: `AUTH_INPUT_INVALID` (400), `MFA_CHALLENGE_INVALID` (401), `AUTH_REQUIRED` (401) y `ORIGIN_FORBIDDEN` (403). No responder 200 con una sesión autenticada de sustitución.

`server/utils/prototype-auth.ts` exporta:

- `requirePrototypeSession(event)`: devuelve el contexto servidor `{ username, sessionId, expiresAt }` o lanza 401. Los consumidores no conocen el registro de sesiones.
- `requirePrototypeOrigin(event)`: comprueba origen en mutaciones y lanza 403.
- Funciones internas para crear, consumir y revocar desafíos/sesiones; no exponerlas como API de prueba.

`usePrototypeAuth` expone `session`, `pending`, `error`, `refresh()`, `login(username, password)`, `verifyMfa(code)` y `logout()`. Las operaciones son asíncronas; solo cambian a autenticado tras respuesta servidor. Usa `useRequestFetch` o equivalente de Nuxt para propagar las cookies de la petición SSR sin crear un singleton cliente compartido entre usuarios.

09 y 10 importan estos tipos y helpers, sin reimplementarlos ni modificar las rutas auth. El middleware Nitro abarca sus endpoints sin que cada agente añada excepciones.

## Mapa de archivos y ownership

Archivos nuevos propiedad de 08:

- `shared/types/prototype-auth.ts`: DTO y códigos públicos de autenticación.
- `server/utils/prototype-auth.ts`: registro efímero, tiempos, cookies, origen y guardas.
- `server/middleware/prototype-auth.ts`: protección general de API con exclusiones exactas.
- `server/api/auth/session.get.ts`, `login.post.ts`, `mfa.post.ts`, `logout.post.ts`.
- `app/composables/usePrototypeAuth.ts`.
- `app/middleware/00.prototype-auth.global.ts`: guarda de páginas anterior al middleware demo.
- `app/layouts/access.vue`, `app/pages/login.vue`, `app/pages/mfa.vue`.
- `tests/e2e/prototype-08-auth.spec.ts`, `tests/e2e/helpers/prototype-auth.ts` y `tests/unit/prototype-auth.test.ts`.

Archivos existentes que 08 puede modificar:

- `app/middleware/demo-role.global.ts`: excluir login/MFA y no inicializar negocio antes de sesión.
- `app/layouts/default.vue`: logout, usuario y avisos de acceso ficticio, incluida la variante de portal. No añadir aquí la persistencia de 09 ni las cargas de 10.
- `app/pages/portal/[id].vue`: integración mínima con acceso y conservación de destino; no crear un segundo mecanismo de token.
- `tests/e2e/app.spec.ts`: helper de login antes de recorridos históricos, manteniendo todas sus aserciones.
- `tests/unit/prds.test.ts`: al implementar, sustituir la suposición histórica «todo vacío» por un inventario que distinga 01–07 de 08–10; mantener los 73 criterios históricos. No anticipar como implementados PRDs pendientes.

El layout y la página portal son archivos compartidos **por etapas**, no por edición concurrente: 08 entrega primero; 09 los adapta después para cargar estado; 10 añade la carga real. `app/composables/useMockApp.ts`, `app/types/domain.ts`, `app/utils/workflow.ts`, Prisma, configuración de BD y documentación de arranque completa quedan fuera del ownership de 08.

## Criterios de aceptación Playwright

Todos se implementan en el fichero propio. Usar contextos limpios, selectores accesibles y respuestas HTTP, no solo comprobar que un botón exista.

- **P08-CA01.** Sin cookies, abrir las seis superficies internas/portal redirige a `/login`; ninguna respuesta HTML/payload contiene «Clara Martínez» ni «Coincidencia ficticia». Una API protegida devuelve 401, no HTML con 200.
- **P08-CA02.** Usuario, contraseña o código vacíos/solo espacios mantienen el paso actual, muestran `role=alert` y no generan cookie de sesión. Probar usuario `x`, contraseña `!` y MFA `texto`: completar acceso correctamente sin requisitos adicionales.
- **P08-CA03.** Tras login hay desafío pero no sesión; visitar `/expedientes/DEMO-R08` y solicitar API protegida sigue bloqueado. Ir directamente a `/mfa` sin desafío o repetir un desafío consumido falla con 401.
- **P08-CA04.** Tras MFA, la cookie de sesión es `httpOnly`, `sameSite=Lax`, `path=/` y no aparece en `document.cookie` ni en almacenamiento web. Recargar y abrir otra pestaña del mismo contexto mantiene acceso durante su vigencia.
- **P08-CA05.** Login desde un portal conserva ruta y token. Destinos externos, `//host` y barras invertidas nunca se usan como destino de navegación.
- **P08-CA06.** Logout desde gestión y desde portal conduce a login, elimina los datos renderizados y revoca la cookie. Reutilizar el valor previo mediante un contexto API devuelve 401; botón atrás y recarga no recuperan datos sin autenticación.
- **P08-CA07.** Con un servidor de pruebas controlado, el desafío caduca y la sesión caduca exactamente en sus límites; después no se permite consulta ni mutación. Usar TTL cortos configurados solo en el entorno E2E y comprobar los valores de 5 minutos/8 horas con pruebas unitarias de reloj. No esperar ocho horas ni añadir un endpoint público para adelantar auth.
- **P08-CA08.** Peticiones POST con origen ajeno o sin origen reciben 403 y no crean desafíos, sesiones ni cambios. Enlaces demo, selector Cliente y peticiones directas no evitan la guarda.
- **P08-CA09.** Login, MFA y portal autenticado a 390 × 844 no tienen desbordamiento global ni errores `pageerror`; los avisos «no producción» y «MFA simulado» son visibles. Los recorridos históricos siguen pasando después del helper de login.

Para probar API antes de que exista 09, el test puede registrar una ruta mínima protegida dentro del servidor de pruebas, sin incorporarla al servidor distribuido. Desde 09 debe usar `/api/prototype/state` real. Las opciones de TTL se leen solo al iniciar el servidor de pruebas y el helper restaura la configuración normal al terminar.

## Validación y definición de terminado

Ejecutar los unitarios de auth/documentación, el fichero E2E de 08, los E2E históricos afectados y `pnpm typecheck`. Mantener Node/pnpm y las herramientas existentes; no introducir un servicio externo de autenticación.

08 termina cuando las páginas y las APIs están protegidas por sesión servidor, logout revoca realmente, los errores son visibles y los tests no necesitan omitir los pasos de acceso. No termina con una bandera `loggedIn` en el navegador ni con un login que permita leer datos antes de MFA.

## Evidencia de implementación

Validación local del 30 de septiembre de 2026, antes de mover este documento a `done`:

- `pnpm exec playwright test app.spec.ts prototype-08-auth.spec.ts --workers=1`: **21/21 pruebas**, 10 de acceso y 11 recorridos históricos íntegros, en Chromium.
- `pnpm typecheck`: **sin errores**, con los ámbitos separados de aplicación, servidor y shared de Nuxt 4.
- `pnpm test`: **52/52 pruebas**, incluidos registro/reloj de autenticación, inventario documental y motor histórico. Se conservan exactamente los 73 criterios históricos.
- P08-CA01: las seis superficies rechazan entrada SSR y navegador; HTML/payload no contienen nombres ni incidencias internas. La API protegida responde JSON 401.
- P08-CA02: campos vacíos y solo espacios muestran alertas; `x`, `!` y `texto` completan el acceso. El DTO conserva usuario recortado, sin contraseña ni código.
- P08-CA03: el desafío no concede acceso; cookies opacas independientes, consumo único y error 401 al reutilizar el desafío.
- P08-CA04: atributos HttpOnly/Lax/Path, ausencia en `document.cookie` y almacenamiento web, vigencia tras recarga y otra pestaña; consultas no renuevan `expiresAt`.
- P08-CA05: se completa el formulario sobre la redirección real desde el portal, conservando token; destinos externos, barras invertidas y bucles se rechazan. El SSR del portal solo serializa el caso solicitado y no el listado ni notas internas.
- P08-CA06: logout probado desde gestión y portal, sin errores JavaScript; revocación efectiva incluso reutilizando la cookie anterior, limpieza visual y bloqueo de atrás/recarga. Logout sin sesión es idempotente.
- P08-CA07: servidor Nuxt aislado en 3011, con TTL de 1800/3000 ms habilitados únicamente en su configuración de desarrollo. Las peticiones fuerzan la cookie anterior para comprobar el registro servidor, no solo la caducidad de la cookie. Los unitarios verifican los límites exactos de 300000/28800000 ms. Se prueba también un 401 real en el cliente que limpia datos y aborta otra consulta pendiente. El servidor de pruebas se detiene y elimina únicamente su propio lock al terminar.
- P08-CA08: origen ajeno, ausente, `null` y cabeceras de confianza falsas se rechazan sin cambios; una mutación con Content-Type incorrecto falla. El selector Cliente y los enlaces demo nunca sustituyen la sesión.
- P08-CA09: login, MFA y portal a 390 × 844, avisos visibles, sin desbordamiento ni `pageerror`. Los 11 recorridos históricos pasan con el helper común de login.

### Contratos definitivos para 09 y 10

- [DTO público](../../../shared/types/prototype-auth.ts): `PrototypeSession`, `PrototypeAuthErrorCode`, `PrototypeAuthError`. El usuario es un nombre de demostración, sensible a mayúsculas; `expiresAt` del DTO es ISO UTC. Nunca expone `sessionId`.
- [Guardas servidor](../../../server/utils/prototype-auth.ts): `requirePrototypeSession(event): PrototypeSessionContext`, con `{ username: string; sessionId: string; expiresAt: number }`; el último campo es tiempo Unix en milisegundos. 09 utiliza `username` para preferencias de rol y comprueba sesión antes de cargar estado o ejecutar comandos.
- `requirePrototypeOrigin(event): void` exige mismo origen en mutaciones. `withPrototypeServerContext(event, operation)` solo marca el objeto de evento en una WeakMap privada durante una operación servidor explícita; admite operaciones anidadas/concurrentes y no omite la guarda de sesión. Ninguna cabecera activa esta confianza. 09 puede llamar directamente a sus servicios desde SSR; si necesita una mutación interna, debe usar este contexto, nunca inventar cabeceras.
- `requirePrototypeMutationContentType(event): void` exige JSON o multipart para mutaciones protegidas. JSON de autenticación se valida estrictamente con `readPrototypeAuthInput`; 09 valida sus envelopes JSON y 10 valida boundary, campos y bytes multipart en su handler. Aceptar el media type no valida un archivo.
- [Middleware Nitro](../../../server/middleware/prototype-auth.ts): protege `/api` y `/api/**`; solo excluye los cuatro pares exactos de método/ruta de auth. Los handlers de 09/10 repiten guardas antes de leer/escribir; no necesitan nuevas exclusiones.
- [Composable](../../../app/composables/usePrototypeAuth.ts): conserva `session`, `pending`, `error`, `refresh()`, `login(username, password)`, `verifyMfa(code)`, `logout()`. Añade `request<T>(url, { method?, body?, headers? })` para las peticiones de 09/10: propaga cookies SSR con `useRequestFetch`, expone errores, y ante 401 limpia los estados y datos Nuxt, aborta peticiones registradas y vuelve a login. 09 debe usarlo para estado/comandos, con tipos concretos, y descartar su snapshot local al perder la sesión. `body` admite objetos de contrato y FormData, sin tokens JavaScript.
- [Destinos](../../../shared/utils/prototype-return-to.ts): `prototypeReturnTo(value: unknown): string`, compartido por formularios y middleware de navegación.
- [Puente temporal del mock](../../../app/utils/prototype-mock-scope.ts): `preparePrototypeMockScope`, `projectPrototypePortalCase`, `actPrototypePortal`, `clearPrototypeMockScope`. Guarda el listado únicamente en contexto privado efímero del mock y entrega 0/1 casos al estado del portal; no es persistencia del negocio. Oculta historial, extracción, escenario, segmento, nota PBC y referencia NAV; PBC/NAV se reducen a elegibilidad para conservar las condiciones del componente original. 09 debe sustituir este puente por su proyección/validación y comandos servidor, no persistir el caso proyectado como estado interno.
- [Login compartido E2E](../../../tests/e2e/helpers/prototype-auth.ts): `prototypeLogin(page, destination?)` y `completePrototypeLogin(page)`. 09/10 reutilizan el acceso y añaden su reset autenticado cuando corresponda. Las rutas de prueba están solo en [la configuración aislada](../../../tests/e2e/fixtures/auth/nuxt.config.ts), nunca en el servidor distribuido. Al implementar 09, se debe eliminar la sustitución de `/api/prototype/state` por `protected.ts` y adaptar sus aserciones al estado real, con la BD de pruebas aislada; se mantienen las comprobaciones de caducidad y cancelación de 08.

`useMockApp`, tipos de dominio, motor y componente `ClientPortal` permanecen sin modificaciones. El contenedor raíz oculta páginas protegidas en cuanto desaparece la sesión; el layout añade avisos/usuario/logout y el middleware demo excluye login/MFA sin inicializar negocio. Prisma, manifiestos, `.env`, SQL y bytes de archivos quedan fuera de esta entrega. No se ha realizado ninguna conexión externa ni commit. 09 y 10 siguen pendientes.

### Integración posterior de PRD 09

La evidencia anterior describe la entrega original de 08. Después de implementar 09, el fixture de caducidad usa SQL real `RCDRentaE2E` y el puerto aislado 3012, sin sustituir `/api/prototype/state`. El antiguo puente solo conserva su helper de limpieza; el negocio y la proyección se ejecutan en servidor. La regresión completa auth/app conserva sus 21 tests correctos, incluidos TTL, 401 y cancelación. PRD 09 está en `done`; PRD 10 sigue pendiente.
