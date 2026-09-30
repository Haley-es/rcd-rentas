# PRD 09. Persistencia integral con Prisma y SQL Server

## Objetivo y alcance

Conservar el comportamiento del mockup, pero hacer persistentes en SQL Server el estado de negocio, los ajustes de demostración y todas sus mutaciones. El servidor es la única autoridad: ejecuta el motor existente, valida los comandos y devuelve el estado confirmado. La UI mantiene el nombre `useMockApp` para minimizar cambios; deja de ejecutar transiciones localmente.

**Estado:** implementado y validado como prototipo local.
**Dependencias:** [PRD 08](08-login-mfa-y-sesion-local.md), por `requirePrototypeSession`, origen, cookie y DTO de acceso.
**Salida:** [PRD 10](10-archivos-locales-y-arranque.md), por transacciones, IDs/versiones, estado y migraciones.
**Pruebas propias:** `tests/e2e/prototype-09-persistence.spec.ts`.
**Destino de desarrollo:** SQL Server real en localhost, base de datos `RCDRenta`. No SQLite, almacenamiento web ni fallback en memoria.

### Entorno confirmado para la implementación

Una comprobación independiente aportada el 30 de septiembre de 2026 confirmó acceso a SQL Server localhost con el usuario previsto, versión `16.0.1200.5`, y existencia de `RCDRenta` con **0 tablas**. Node es `24.18.0` y pnpm `11.2.0`. No se necesita crear otra BD de desarrollo ni pedir de nuevo estos datos; sí aplicar las migraciones y validar el bootstrap sobre esta instalación vacía. Las credenciales se configuran de forma privada, sin incluirlas en este documento.

Existe un servidor del proyecto en `127.0.0.1:3010`. Los fixtures usan su servidor y puerto aislados; no deben detener ni reemplazar una instancia existente sin gestionar explícitamente su propiedad. `.env` y `.env.*` están ignorados por Git, salvo `.env.example`, que puede versionarse sin secretos.

No se reescribe `runAction`, no se normaliza todo el dominio fiscal ni se implementan integraciones. Se conserva su matriz de roles, reloj demo, PH previa, validación documental humana, ramas RCD/Cliente e incidencias IT separadas de PBC.

## Contexto comprobado y superficies completas

`useMockApp` contiene `cases`, `role`, `today`, `teams`, `signatureEmail`, `documentReminderDays`, `act`, `advanceDays` y `reset`. Actualmente `act` devuelve `ActionResult` síncrono y modifica el expediente en el navegador.

Consumidores que deben adaptarse, no solo la página de detalle:

- `app/pages/index.vue`, `app/pages/expedientes/index.vue` y `app/components/CaseTable.vue`: indicadores, filtros, exportación y siguiente tarea.
- `app/pages/expedientes/[id].vue`: acciones, confirmaciones, referencia/fecha, DNI y filas editables de extracción. Su 404 actual ocurre antes de una futura carga asíncrona y debe esperar a conocer el resultado servidor.
- `app/pages/campanas.vue`: invitación a múltiples contactos y ajuste Teams.
- `app/pages/tareas.vue`: evaluación de cadencias, correo de firma opcional y días de recordatorio.
- `app/layouts/default.vue`: rol, avance del reloj y reset.
- `app/pages/portal/[id].vue` y `app/components/ClientPortal.vue`: acciones Cliente, confirmaciones y proyección individual. El componente cierra hoy el diálogo y anuncia envío antes de conocer el resultado; debe esperar confirmación real.

Las fechas de negocio continúan como strings `YYYY-MM-DD`, con inicio `2026-06-12`; no se sustituyen por la fecha del sistema. La autenticación usa su propio reloj real.

## Arquitectura pragmática

### 1. Prisma y modelo SQL Server

El agente verifica una versión de Prisma compatible con el Node/Nuxt existente y SQL Server, la fija en el manifiesto/lockfile y usa su cliente generado y, si esa versión lo requiere, el adaptador SQL Server correspondiente. No copiar una configuración de otro proveedor.

`server/utils/prisma.ts` contiene un único cliente por proceso Nitro, reutilizable durante HMR mediante una referencia tipada en `globalThis`. Las conexiones y credenciales son privadas; ningún import de Prisma llega al bundle cliente.

Modelos mínimos en `prisma/schema.prisma` con proveedor `sqlserver`:

- `PrototypeInstallation`: fila con ID fijo `1`, versión de instalación y fecha de inicialización. Es el marcador durable que distingue instalación nueva de estado perdido.
- `PrototypeState`: fila con ID fijo `1`, `revision` entera, `datasetId` UUID, `schemaVersion`, `payload` como `String @db.NVarChar(Max)` y `updatedAt`. El JSON se serializa en texto porque no se debe asumir un tipo Prisma `Json` soportado por SQL Server.
- 10 añadirá `PrototypeFile`; 09 no implementa anticipadamente el almacenamiento de bytes.

El payload contiene todos los `CaseFile` completos, incluyendo documentos/versiones, `history`, PH, identidad, PBC, NAV, borradores, ejecuciones/filas/Criteria, presentación e invoice, además de `today`, `teams`, `signatureEmail`, `documentReminderDays` y `rolesByPrincipal`.

`rolesByPrincipal` conserva el rol demo por usuario local autenticado, utilizando exactamente el nombre recortado de 08. Usuarios distintos no cambian mutuamente su rol. Se puede omitir una entrada en su primer acceso: ausencia significa el valor inicial explícito `Profesional`, no recuperación de un fallo. No exponer el mapa completo al cliente; no guardar contraseñas ni códigos MFA.

El modelo de snapshot único es intencionado para 18 escenarios y permite conservar el motor sin duplicarlo. No es una propuesta de escalabilidad ni de permisos de producción.

### 2. Serialización explícita

Crear un codec versionado para validar y reconstruir el payload. No usar `JSON.parse(...) as CaseFile[]` ni aceptar snapshots enviados por el navegador.

- Guardar strings Unicode, arrays ordenados, números finitos y booleanos; preservar campos opcionales ausentes y valores `null` de versiones/fechas.
- Mantener las fechas fiscales como strings sin conversiones de huso horario. Las fechas técnicas se transmiten como ISO UTC.
- Comprobar IDs únicos, enums, referencias de versiones, catálogo documental y límites de valores. No invalidar escenarios históricos legítimos por inferir nuevas reglas fiscales.
- Si el payload está corrupto o su `schemaVersion` no es compatible, responder con error visible. No ejecutar `createSeed`, ni normalizar silenciosamente descartando historial.
- Las migraciones de versión son explícitas y conservan datos existentes; no equivalen a un reset.

### 3. Bootstrap solo para instalación nueva

Las migraciones crean tablas, no restablecen escenarios. En la primera consulta autorizada, dentro de una transacción, si **no existen ni instalación ni estado ni metadatos de archivos**, crear marcador y snapshot con `createSeed()`, exactamente 18 escenarios: nueve Renta y nueve 720.

Si dos peticiones inicializan simultáneamente, la unicidad del ID y la transacción permiten un único bootstrap; la perdedora relee la instalación válida. No duplicar casos ni reinicializar datos. Un marcador existente sin snapshot, un snapshot sin marcador o archivos huérfanos indican inconsistencia y provocan error; no son una BD nueva.

Recargar, iniciar sesión, reiniciar Nitro, generar Prisma o aplicar migraciones sobre una instalación existente no vuelven a sembrar. Un snapshot válido con cero casos tampoco es motivo para sembrar.

### 4. Comandos servidor y concurrencia

`server/services/prototype-store.ts` carga/valida snapshots y controla transacciones. `server/services/prototype-commands.ts` valida el contrato y llama al mismo `runAction` de `app/utils/workflow.ts` sobre una copia del caso, usando el rol autorizado para la simulación y `today` persistido.

No introducir un segundo switch de reglas fiscales. Sí validar en servidor la estructura completa de la unión discriminada `WorkflowAction`, IDs, enums, fechas y valores antes de llamar al motor. El cliente no puede enviar el snapshot final, `now` ni un actor libre.

Toda mutación exige `expectedRevision` y `datasetId`. La revisión abarca el estado compartido completo, incluidos ajustes y preferencias de rol. En una transacción:

1. Leer el snapshot vigente y verificar versión/dataset.
2. Ejecutar el comando sobre una copia validada; un fallo del motor no modifica caso, historial ni revisión.
3. Actualizar condicionalmente `WHERE id=1 AND revision=expectedRevision AND datasetId=...`, incrementar revisión y confirmar.
4. Si otra operación ganó, responder 409 y descartar la copia; no sobrescribir con estado viejo ni reejecutar automáticamente una acción de negocio.

Usar transacciones con aislamiento y manejo de conflictos compatibles con SQL Server. Un mutex del proceso no basta con HMR o varios procesos. La revisión se mantiene monotónica también después de reset; `datasetId` cambia en cada reset para invalidar peticiones viejas y futuros enlaces de archivo.

Un doble clic se bloquea durante la petición. Dos solicitudes simultáneas con la misma revisión producen como máximo un commit, un incremento y un evento para una acción simple. Ante timeout incierto, volver a consultar antes de permitir reintento; nunca mostrar éxito sin confirmación ni repetir automáticamente una factura.

### 5. Inventario obligatorio de comandos

El endpoint interno admite el conjunto completo actual de `WorkflowAction`:

- Captación: `invite`, `remind`, `call`, `respond`, `contact-outcome`, `assign`.
- PH: `ph-submit`, `ph-review`, `ph-edit`, `ph-send`, `ph-sign`, `ph-reject`, `ph-call`, `ph-remind`, `withdraw`.
- Identidad/alta: `identity`, `request-identity`, `prior-confirm`, `pbc-start`, `pbc-decide`, `nav-register`, `portal-send`.
- Documentos: `add-document`, `deliver-documents`, `review-document`, `complete-documents`, `docs-remind`.
- Renta/presentación: `tax-draft`, `tax-send`, `tax-respond`, `present`, `receipt-send`.
- 720/IT: `extract`, `extraction-review`, `it-report`, `it-resolve`, `criteria`.
- Facturación/cierre: `invoice`, `invoice-send`, `close`.

Además, persistir los comandos antes implícitos:

- `set-role`: solo el rol demo del usuario autenticado, validado contra `roles`.
- `advance-days`: entero positivo, fecha resultante válida; la UI conserva `+1 día`.
- `set-settings`: únicamente `teams`, `signatureEmail` y/o `documentReminderDays`, este último entero entre 1 y 30.
- `invite-many`: IDs elegidos; elegibilidad y rol se comprueban en servidor.
- `evaluate-followups`: evaluar en servidor 7 días y 3 adicionales para captación, 3 días para firma y la cadencia documental configurada. La UI no calcula acciones para un estado posiblemente obsoleto.
- `reset-demo`: confirmación explícita con alcance de todos los datos compartidos.

Los lotes ejecutan el motor secuencialmente sobre la misma copia dentro de una única transacción. Conservar los resultados por caso/acción: errores de negocio individuales no se presentan como éxito global, y los resultados válidos del lote pueden confirmarse juntos. Un error de BD revierte todo el lote. Responder con resultados y número real de eventos confirmados; reevaluar sin vencimientos devuelve cero, no crea historial ni incrementa revisión.

Durante 09, `add-document` conserva la muestra de metadatos actual y se marca explícitamente como tal; no afirma conservar bytes. 10 cambia la aportación nueva a multipart y ejecuta esta misma acción desde su servicio de archivos. Los datos precargados permanecen metadatos ficticios.

### 6. Reset explícito

Cambiar el mensaje actual de «esta sesión» por una advertencia de datos persistentes compartidos. Cancelar no envía ninguna petición. Confirmar `reset-demo` restaura los 18 escenarios y ajustes iniciales, vacía las preferencias de rol demo y cambia el dataset, sin eliminar el marcador de instalación ni revocar la sesión auth.

El reset es una mutación autenticada con origen y revisión válidos. Antes de 10 no hay bytes que limpiar; 10 añade limpieza transaccional de metadatos y retirada de blobs. No ofrecer reset implícito por fallo de conexión.

## Contratos compartidos para 08, 09 y 10

El agente de 09 es propietario de `shared/types/prototype.ts`. Definir:

```ts
interface PrototypeSnapshot {
  schemaVersion: 1
  datasetId: string
  revision: number
  cases: CaseFile[]
  today: string
  teams: boolean
  signatureEmail: boolean
  documentReminderDays: number
  role: Role
}

interface CommandEnvelope {
  datasetId: string
  expectedRevision: number
  command: PrototypeCommand
}
```

`PrototypeCommand` es una unión discriminada por `type`. La variante `workflow` lleva `{ caseId, action: WorkflowAction }`; las otras variantes son exactamente los comandos adicionales enumerados. `reset-demo` exige `confirm: true`. La validación runtime se comparte con el servidor; un tipo TypeScript no valida JSON.

Endpoints de 09:

- `GET /api/prototype/state`: snapshot interno, solo con sesión y fuera de una solicitud portal.
- `POST /api/prototype/commands`: `CommandEnvelope`; el actor se obtiene del rol persistido del usuario, no del body.
- `GET /api/prototype/portal/:id?token=demo-<id>`: proyección del único caso solicitado.
- `POST /api/prototype/portal/:id/commands?token=demo-<id>`: envelope con variante `workflow`, caseId igual a ruta y acción Cliente permitida. Fuerza actor `Cliente`.

La proyección `PrototypePortalSnapshot` incluye `schemaVersion`, `datasetId`, `revision`, datos públicos del caso y capacidades calculadas. No es un `CaseFile` completo oculto con CSS: excluir `history`, `pbcNote`, `nav`, notas/ejecuciones/filas IT y datos de otros casos en JSON/HTML/payload. Para las condiciones actuales del componente, transmitir capacidades como `canUpload`, `canSign`, `canWithdraw`, `canDeliver`, `canRespondToDraft`, `canPresent`, `phVisible`, `draftVisible`, `receiptAvailable` e `invoiceAvailable`, junto a estados públicos necesarios. No publicar valores internos PBC/NAV para calcular botones.

Verificar sesión, existencia y token antes de devolver la proyección o ejecutar una acción. Un token inválido responde 403 genérico sin datos; expediente ausente responde 404. El token demo no es secreto ni login real de cliente: cualquier operador autenticado puede previsualizar casos. En portal nunca solicitar `/state`; los endpoints internos rechazan al usuario con rol simulado Cliente, y el portal usa siempre actor Cliente aunque la previsualización se haya abierto como Profesional.

La excepción explícita es `set-role` en `/commands`: cualquier sesión puede cambiar su propio rol demo, también desde Cliente para «Volver a gestión demo». Al pasar a Cliente, responder un DTO de control `{ ok, message, datasetId, revision, role }` sin `cases`, limpiar la vista interna y navegar al portal demo existente. Al volver a Profesional, se puede devolver/cargar el snapshot interno después de confirmar el nuevo rol. No bloquear esta vuelta por el rol anterior ni devolver el listado interno en la respuesta que entra en modo Cliente. El mismo endpoint sigue rechazando comandos internos de negocio mientras el actor sea Cliente.

La respuesta de un comando confirmado conserva `ActionResult` (`ok`, `message`) y añade `snapshot` del ámbito correspondiente, además de `results`/`applied` para lotes. Si hay fallos de negocio individuales, `ok` es falso aunque algunos resultados del lote se hayan confirmado, y se muestran ambos. Para fallos simples de negocio: HTTP 422, `data.code=WORKFLOW_REJECTED`, mensaje y snapshot actual del ámbito; ningún cambio. Para 409: `REVISION_CONFLICT`, sin commit. Otros errores: 400 `COMMAND_INVALID`, 401 de 08, 403 `ACTION_FORBIDDEN`, 404 `CASE_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE`, 500 `STATE_INVALID`. No filtrar credenciales/SQL/stack al navegador; registrar causa técnica en servidor con identificador.

`prototype-store.ts` exporta lectura interna, lectura portal y un helper transaccional `mutatePrototype({ session, datasetId, expectedRevision, apply })`. El callback recibe snapshot mutable validado y cliente Prisma de transacción. 10 lo utiliza para adjuntar metadatos a un ID/version confirmado por el motor dentro del mismo commit, no mediante dos llamadas HTTP.

El callback admite preparación asíncrona y un hook de artefactos antes del commit. Durante 09 el hook no escribe archivos; 10 lo implementa en un único punto de la ejecución de comandos para preparar blobs y añadir metadatos. Debe poder abortar el commit y limpiar solo los blobs preparados por esa petición, sin ejecutar de nuevo `runAction`.

## UI sincronizada y errores visibles

Conservar `useMockApp`, sus seis refs de lectura y nombres de operaciones. `act`, `advanceDays`, `reset` y las nuevas operaciones `setRole`, `setSettings`, `inviteMany`, `evaluateFollowups` son asíncronas. Añadir `ready`, `pending`, `error`, `refresh()` y estado de revisión/dataset.

Las refs persistentes son de solo lectura para los consumidores: sustituir `v-model` que modifica estado confirmado por modelos locales y setters explícitos. No persistir con watchers que hagan POST después de una mutación optimista. El servidor devuelve siempre el estado confirmado; `createSeed` no es el valor por defecto del composable.

- En carga inicial mostrar progreso y esperar antes de 404, cálculo de contadores o render de portal.
- Deshabilitar confirmación y acciones dependientes mientras haya una mutación; no cerrar diálogos ni borrar selección/archivo/notas hasta confirmar commit.
- Sustituir el snapshot solo si su revisión es igual o superior a la conocida y el dataset corresponde. Tras un reset propio aceptar explícitamente el nuevo dataset; respuestas pendientes del dataset anterior se descartan.
- En 409 informar conflicto, refrescar y pedir nueva confirmación. Conservar la edición local de filas/notas y marcarla obsoleta; el watcher actual de `extraction.rows` no debe destruir cambios sin guardar.
- Refrescar al entrar en rutas y recuperar foco de pestaña. No prometer tiempo real; una segunda pestaña ve cambios al refrescar/enfocar, y una petición obsoleta nunca sobrescribe la primera.
- Error SQL conserva la última vista confirmada marcada como no sincronizada y bloquea mutaciones hasta recuperar conexión. Si no hubo carga válida, mostrar error y reintento, no 18 casos inventados.
- Logout limpia datos de ambos ámbitos. Al navegar al portal no conservar un snapshot interno en su payload SSR ni transmitirlo al componente.

## Mapa de archivos y ownership

Archivos nuevos propiedad de 09:

- `prisma/schema.prisma`, `prisma/migrations/<fecha>_prototype_state/migration.sql` y configuración Prisma exigida por la versión elegida.
- `server/utils/prisma.ts`, `server/utils/prototype-codec.ts`.
- `server/services/prototype-store.ts`, `server/services/prototype-commands.ts`, `server/services/prototype-portal.ts`.
- `shared/types/prototype.ts`.
- `server/api/prototype/state.get.ts`, `commands.post.ts`.
- `server/api/prototype/portal/[id].get.ts`, `server/api/prototype/portal/[id]/commands.post.ts`.
- `tests/e2e/prototype-09-persistence.spec.ts`, `tests/e2e/helpers/prototype-state.ts`, `tests/e2e/helpers/prototype-server.ts`, `playwright.prototype.config.ts`.
- `tests/unit/prototype-codec.test.ts`, `tests/unit/prototype-commands.test.ts`.

Archivos existentes propiedad de 09 durante esta etapa:

- `app/composables/useMockApp.ts`: transporte, carga y setters.
- Todos los consumidores enumerados al inicio, incluido `ClientPortal.vue`, para esperar respuestas y consumir la proyección portal. 10 extiende después únicamente sus superficies de archivos.
- `app/middleware/demo-role.global.ts`: usar rol confirmado, evitar llamadas internas en rutas de acceso/portal y respetar orden de auth.
- `package.json`, `pnpm-lock.yaml`, `nuxt.config.ts`, `.env.example`, `.gitignore`: dependencias/scripts de BD y configuración privada sin secretos reales.
- `playwright.config.ts`, `tests/e2e/app.spec.ts`: `workers: 1`, login y reset autenticado explícito por test cuando los escenarios ya no se restablecen al recargar.
- `tests/unit/workflow.test.ts`: conservar expectativas; ampliar cobertura de equivalencia solo si es necesario.

`app/types/domain.ts`, `app/utils/workflow.ts` y `app/data/seed.ts` se reutilizan. Solo corregir referencias/textos estrechamente ligados al almacenamiento si es imprescindible; no modificar reglas o IDs de seed. La documentación definitiva de arranque pertenece a 10; 09 deja contratos de variables/scripts suficientes para su integración.

`schema.prisma`, manifiestos, composable, layout, portal y configuración E2E se editan en orden 08, luego 09, luego 10; no repartirlos simultáneamente. Los agentes pueden preparar sus pruebas/archivos exclusivos, pero deben integrar sobre la etapa anterior validada. 09 no modifica helpers auth de 08; 10 no sustituye el store ni el motor.

## Criterios de aceptación Playwright

Usar SQL Server real. Desarrollo usa `RCDRenta`; E2E usa una BD separada y explícita, por ejemplo `RCDRentaE2E`, en localhost con el mismo proveedor/migraciones. Validar el nombre permitido antes de resetear; nunca ejecutar pruebas destructivas sobre la BD de desarrollo por defecto.

- **P09-CA01.** Sobre BD E2E recién provisionada, dos consultas autorizadas concurrentes producen exactamente 18 IDs únicos, nueve por campaña. Repetir lectura/login no cambia revisión, historial ni cantidad. Comprobar marcador y snapshot mediante Prisma en el helper de pruebas.
- **P09-CA02.** Cambiar responsable, DNI, un ajuste y reloj; recargar y abrir otro contexto autenticado conserva los valores. Reiniciar únicamente el proceso Nuxt controlado por el fixture, repetir login por 08 y comprobar mismos IDs, revisión e historial. No reconstruir la BD durante este test.
- **P09-CA03.** Tabla parametrizada de comandos: cubrir cada `WorkflowAction` enumerada con su caso/rol/precondiciones, comprobar respuesta y estado/historial después de recarga. Incluir cadenas PH revisión/envío/firma, rechazo/retirada, PBC/NAV, tanda/revisión documental, ambas ramas Renta y 720 IT/Criteria/cierre. No considerar suficiente una única asignación persistente.
- **P09-CA04.** Persistir Teams, correo de firma y cadencia 1/30 días; rechazar 0/31/no entero en servidor sin commit. Rol Socio se conserva para el mismo usuario tras recarga; otro usuario sigue Profesional. Reset restaura sus valores iniciales.
- **P09-CA05.** Probar cadencias exactas con el reloj persistido: recordatorio no a 6 días/sí a 7, llamada no a 2 adicionales/sí a 3, firma no a 2/sí a 3. Reevaluar devuelve cero y no duplica historial. Lote de invitación devuelve resultados por caso y no invita PH previa/retirados.
- **P09-CA06.** Dos comandos distintos simultáneos sobre la misma revisión: un 200 y un 409; solo un commit. Refrescar y confirmar el segundo conserva ambos cambios con dos eventos, sin pérdida. Repetir sobre casos distintos demuestra que tampoco se pierde una actualización del snapshot global. Probar doble clic y edición obsoleta de filas.
- **P09-CA07.** Rol incorrecto, acción mal formada, ID ausente o versión fiscal no vigente devuelven 4xx visible; casos, revisión e historial permanecen iguales. Cliente simulado no obtiene `/state`, y portal nunca puede aprobar PH/PBC ni mutar otro ID. Entrar en Cliente no devuelve `cases`, pero «Volver a gestión demo» confirma `set-role` y permite recuperar gestión sin relogin.
- **P09-CA08.** Portal devuelve un único DTO sin `history`, `pbcNote`, `nav`, notas/filas IT ni otros clientes; verificar JSON y payload SSR, no solo DOM. Token incorrecto/no incluido oculta todos los datos. Clara Renta y Clara 720 siguen aisladas tras mutar una.
- **P09-CA09.** Cancelar reset deja revisión/dataset intactos. Confirmar desde UI restaura exactamente 18 escenarios y fecha inicial, cambia dataset, incrementa revisión y no necesita nuevo login. Una operación del dataset anterior falla; marcador existente sin estado y JSON corrupto dan error, nunca bootstrap.
- **P09-CA10.** Provocar fallo SQL de forma aislada en el servidor de prueba mediante conexión inválida o inyección de fallo del repositorio, sin detener servicios compartidos: lectura/mutación devuelve 503 y UI muestra error, sin datos seed ni éxito. Recuperar conexión conserva el último commit. Bloquear respuesta/red para probar error y reintento visible de UI.
- **P09-CA11.** Persistir y volver a leer acentos, notas, `null`, campos opcionales, borradores y ejecuciones. Comparar estado semántico completo del codec, orden de versiones e historial, no solo conteos. Mantener los tests unitarios actuales del motor y los recorridos E2E históricos con login/reset.

El helper `prototype-state.ts` es exclusivo de pruebas: inspección Prisma y reset autenticado con confirmación/revisión, sin endpoints secretos distribuidos. El fixture de servidor usa puerto local 3011, `workers: 1`, no reutiliza un servidor ajeno y reinicia solo su proceso identificado. No matar procesos por nombre ni hacer resets globales mientras otra suite comparte BD.

## Validación y definición de terminado

Ejecutar generación/migraciones Prisma, unitarios del codec/comandos y motor, fichero E2E de 09 sobre SQL Server real, regresión histórica y de 08, `pnpm typecheck` y `pnpm build`. Registrar en las instrucciones de implementación la versión, las variables privadas y los scripts definitivos para 10.

09 no termina con una lectura SQL inicial y mutaciones locales: todos los comandos y ajustes deben confirmarse en servidor. Tampoco termina si funciona solo mientras Nitro sigue vivo o si una caída de SQL vuelve silenciosamente a datos de memoria.

## Evidencia de implementación

Validación realizada el 30 de septiembre de 2026, con SQL Server `16.0.1200.5` real en localhost, Node `24.18.0`, pnpm `11.2.0`, Prisma y `@prisma/client` fijados a `6.19.3`.

- `pnpm db:generate`, `pnpm db:deploy` y `pnpm db:e2e:deploy`: correctos. La migración inicial se generó con `prisma migrate diff --from-empty --to-schema-datamodel prisma\schema.prisma --script` y se aplicó con `migrate deploy`, sin `db push` ni BD shadow. Se crearon únicamente las tablas del prototipo y el historial de migraciones en la BD vacía. El proveedor del schema es `sqlserver`; Prisma 6 utiliza el identificador de motor `mssql` en `migration_lock.toml`.
- Desarrollo `RCDRenta`: dos lecturas autorizadas devolvieron exactamente los mismos 18 escenarios, revisión 0 y dataset; el bootstrap quedó persistido. No se hizo ningún reset destructivo sobre esta BD.
- `pnpm test:e2e:persistence`: **11 tests correctos**, P09-CA01 a P09-CA11, con BD aislada `RCDRentaE2E`. No hay mock de persistencia. El fixture migra la BD, inicia Nuxt en 3011, verifica HTTP y reinicia/detiene solo su PID identificado.
- P09-CA01: primera instalación concurrente, 18 IDs únicos, nueve por campaña, un marcador y un snapshot inspeccionados mediante Prisma; las siguientes lecturas/login no modifican el estado.
- P09-CA02: responsable, DNI, ajuste y reloj conservados semánticamente tras recarga, otro contexto y reinicio real del proceso controlado. El acceso se repite después del reinicio sin reconstruir la BD.
- P09-CA03: los **40 discriminantes de `WorkflowAction`** ejecutados por API con sus roles y precondiciones. Cada paso compara el resultado con el motor existente, recarga una página real, compara su snapshot completo y vuelve a inspeccionar SQL. Incluye PH con versiones/rechazo/firma, PBC/NAV, documentos, Renta por RCD y por cliente, IT/Criteria/720 y cierre.
- P09-CA04 y P09-CA05: límites documentales 1/30 aceptados y 0/31/fracción rechazados sin commit, preferencias de rol individuales, defaults del reset, cadencias exactas 6/7 y 2/3 días, cadencia documental de un día, lotes con resultados parciales y reevaluación sin incremento ni duplicados.
- P09-CA06: concurrencia real CAS sobre el mismo caso y casos distintos produce un 200 y un 409; la segunda confirmación conserva ambos eventos. Doble clic produce una única petición. Una revisión de Excel obsoleta conserva las filas locales y exige revisarlas antes de confirmar.
- P09-CA07 y P09-CA08: contratos, roles, IDs y aceptación fiscal no vigente rechazados sin cambios; modo Cliente devuelve solo control y no obtiene `/state`; vuelta a gestión sin relogin. Portal individual comprobado en JSON y SSR, sin historial, notas internas PH/PBC/fiscales, NAV, extracción/IT ni datos de otros expedientes. Clara Renta y Clara 720 permanecen independientes.
- P09-CA09: cancelación no modifica estado; reset confirmado restaura 18 escenarios y fecha, incrementa revisión, cambia dataset y conserva marcador/sesión. Dataset antiguo, marcador sin snapshot, JSON corrupto y versión incompatible se rechazan. Un snapshot válido vacío no se vuelve a sembrar.
- P09-CA10: conexión SQL inválida únicamente en el fixture produce 503 en lectura y mutación, error visible y ausencia de seed en UI. Recuperar conexión conserva el último commit. Un fallo de red mantiene el diálogo/edición y bloquea mutaciones hasta una sincronización explícita.
- P09-CA11: comparación semántica completa del codec y del estado SQL, con acentos, notas, `null`, opcionales ausentes, orden documental, historial, borradores y ejecuciones.
- Regresión `pnpm exec playwright test app.spec.ts prototype-08-auth.spec.ts`: **21 tests correctos**. El fixture corto de 08 usa ahora la API y SQL reales en 3012; se eliminó su handler sustituto de `/state`. Conserva caducidad exacta, 401, cancelación y limpieza de datos.
- `pnpm test`: **67 unitarios correctos**, incluido el motor histórico, autenticación, documentación, codec y comandos. `pnpm typecheck` y `pnpm build`: correctos. El build requiere empaquetar las utilidades locales compartidas en SSR para evitar una reescritura incorrecta de externals de Rolldown 8 en Windows; el ajuste se limita a esas utilidades.
- Smoke del build de producción: HTTP 200, login/MFA, lectura SQL de 18 casos y portal SSR individual correctos, en un servidor propio 3013 detenido después de comprobarlo.

### Contratos definitivos para PRD 10

Los DTO están en [shared/types/prototype.ts](../../../shared/types/prototype.ts): `PrototypePayload`, `PrototypeSnapshot`, `CommandEnvelope`, `PrototypeCommand`, `PrototypeCommandResult`, `PrototypePortalCase`, `PrototypePortalCapabilities`, `PrototypePortalSnapshot`, `PrototypeControl`, `PrototypeErrorCode` y `PrototypeDocumentReference` (`datasetId`, `caseId`, `documentId`, `version`). El payload privado contiene `rolesByPrincipal`; ningún DTO público transmite ese mapa.

APIs existentes:

- `GET /api/prototype/state`.
- `POST /api/prototype/commands`, con `CommandEnvelope`.
- `GET /api/prototype/portal/:id?token=demo-<id>`.
- `POST /api/prototype/portal/:id/commands?token=demo-<id>`, únicamente acciones Cliente y el mismo `caseId`.

[prototype-store.ts](../../../server/services/prototype-store.ts) exporta `readPrototypeState(session)`, `readPrototypePortal(session, scope)`, `mutatePrototype({ session, datasetId, expectedRevision, apply })`, `StoredPrototypeState`, `PrototypeMutation<T>` y `PrototypeArtifacts`. `apply(state, tx)` admite un resultado asíncrono `{ changed, result, artifacts? }`; `tx` es `Prisma.TransactionClient`. `artifacts.beforeCommit(state, tx)` se ejecuta antes de CAS/commit y `artifacts.rollback()` limpia únicamente los artefactos preparados por esa petición cuando falla la transacción. La preparación que falle antes de devolver su hook debe limpiar sus propios recursos. No se repite el motor.

[prototype-commands.ts](../../../server/services/prototype-commands.ts) exporta `applyPrototypeCommand`, `executePrototypeCommand(session, envelope, scope?, prepareArtifacts?)` y `PrototypeArtifactPreparation`. Este último recibe `{ state, command, tx }` después de ejecutar correctamente el motor, y devuelve el hook de artefactos. Es el punto único para que 10 vincule bytes/metadatos al ID y versión ya asignados por el motor dentro de la misma transacción, nunca con dos llamadas HTTP.

[prototype-portal.ts](../../../server/services/prototype-portal.ts) exporta `PrototypePortalScope` (`caseId`, `token`), `portalCase` y `projectPrototypePortal`. 10 debe ampliar la proyección únicamente con descriptores públicos individuales, sin rutas privadas. Debe incorporar la comprobación de metadatos huérfanos al bootstrap y su limpieza al reset cuando exista `PrototypeFile`.

`useMockApp` conserva las refs confirmadas y operaciones requeridas, y añade `actPortal`, `portalSnapshot`, `loading` y `synchronized`. `ClientPortal` recibe `expediente: PrototypePortalCase`, `capabilities`, `pending` y `perform(action): Promise<ActionResult>`; ya no emite una acción sin esperar el servidor. Sus muestras siguen siendo solo metadatos, sin bytes, y conserva selección/notas/diálogo ante errores.

Variables privadas: `DATABASE_URL` para desarrollo, `PROTOTYPE_E2E_DATABASE_URL` opcional para la conexión E2E restringida. `PROTOTYPE_UPLOAD_DIR` está reservado en el ejemplo para 10 y no se utiliza todavía. Scripts: `db:generate`, `db:deploy`, `db:e2e:deploy`, `test:e2e:persistence`; `db:migrate` conserva `migrate dev` para desarrolladores que dispongan de permisos de shadow, pero no se ha utilizado para esta instalación.

El helper [prototype-state.ts](../../../tests/e2e/helpers/prototype-state.ts) valida la BD E2E y exporta inspección Prisma, login API y reset autenticado. [prototype-server.ts](../../../tests/e2e/helpers/prototype-server.ts) proporciona el fixture, el PID y `restart(failedDatabase?)`. El script [provision-prototype-e2e.ps1](../../../scripts/provision-prototype-e2e.ps1) provisiona exclusivamente `RCDRentaE2E` con los permisos del principal Windows actual y concede acceso al login existente, sin revelar ni almacenar credenciales.

No se ha implementado almacenamiento de bytes, ni integraciones externas, ni realizado commits en esta entrega. PRD 10 permanece pendiente.
