# PRD 10. Archivos locales reales, versiones y arranque del prototipo

## Objetivo y alcance

Guardar y descargar los bytes reales de los archivos aportados expresamente al prototipo, con metadatos/versiones persistentes en SQL Server y autorización servidor. Vincularlos a los IDs y versiones existentes del flujo, sin crear una segunda colección documental desconectada.

**Estado:** implementado y validado como prototipo local.
**Dependencias:** [PRD 08](../done/08-login-mfa-y-sesion-local.md), para sesión/origen/logout, y [PRD 09](../done/09-persistencia-prisma-sql-server.md), para Prisma, transacciones, revisión/dataset, proyección portal y comandos.
**Pruebas propias:** `tests/e2e/prototype-10-files.spec.ts`.
**Entrega adicional:** actualizar la guía raíz de arranque y los avisos del prototipo para distinguir autenticación simulada, SQL Server real, archivos locales reales e integraciones ficticias.

NAV, Criteria, correo/Teams, firma, extractor y presentación siguen simulados. No incorporar SharePoint, S3, envío SMTP, OCR, IA, firma electrónica, cálculo fiscal ni un XLSX importable. Usar solo localhost y muestras sin datos personales reales.

## Contexto comprobado

- `DocumentItem` ya tiene `id`, `kind`, `name`, `version`, `state`, `note` y `size`.
- `runAction('add-document')` asigna ID por expediente y versión por tipo, invalida entrega/completitud y, cuando corresponde, acuerdo de borrador/Criteria. Esas reglas deben conservarse.
- `ClientPortal.vue` guarda hoy `{ name, size, mime }`, descarta el objeto `File` y espera `perform(action): Promise<ActionResult>` para confirmar el comando de metadatos. Recibe `PrototypePortalCase`, capacidades calculadas y `pending`. Sus descargas siguen siendo TXT creados en navegador.
- `app/pages/expedientes/[id].vue` añade una muestra de metadatos con nombre PDF y descarga PH/justificante/factura TXT y extractor CSV.
- El seed contiene referencias ficticias con extensión PDF, no PDFs guardados. No se debe fingir que estos bytes ya existen.
- El portal permite DNI temprano para captación 720 antes de `portalSent`; no exigir portal documental enviado para esas dos caras si el motor permite la acción.
- 09 ya está validado con Prisma 6.19.3 y SQL real. Sus contratos definitivos, hooks transaccionales, DTO, endpoints, scripts y helpers E2E están al final de su PRD en `done`. Añadir `PrototypeFile` exige ampliar la comprobación de bootstrap y la limpieza de reset; nunca persistir la proyección portal como payload privado.

## Flujo funcional

### 1. Aportación real por ambas superficies

Portal y gestión interna permiten seleccionar un archivo local, elegir tipo documental, revisar nombre/tamaño/tipo y confirmar. El archivo seleccionado se mantiene como `File` hasta obtener confirmación del servidor; no se convierte solo a metadatos ni se pierde al vaciar el input.

La petición multipart transmite bytes a un endpoint local autenticado. No cerrar diálogo, limpiar archivo ni anunciar «incorporado» hasta que archivo, comando de negocio y metadatos estén confirmados. Mostrar progreso/pending, bloquear doble envío y conservar selección ante error para reintento explícito.

Mantener el catálogo existente y límite **10.000.000 bytes decimales** inclusive por archivo. Rechazar cero bytes y 10.000.001 bytes, también desde API directa. Admitir PDF, PNG, JPEG, DOC/DOCX y XLS/XLSX; validar extensión y MIME coherentes en servidor además de la UI. No interpretar contenidos ni presentar estas comprobaciones como antivirus o validación legal.

Limitar la lectura multipart a un único archivo y un cuerpo máximo acotado (10.000.000 bytes de archivo más hasta 64.000 bytes de campos/overhead). Los campos textuales también tienen límites y validación. Rechazar tamaño global excesivo antes de cargarlo entero en memoria; no confiar solo en `Content-Length`. Los bytes recibidos determinan `size`, no un campo enviado por el cliente.

La nueva versión se calcula en el servidor dentro de la transacción de 09. Si ya existe el mismo tipo, conservar el aviso y confirmación de nueva versión. No deduplicar bytes de forma silenciosa: dos aportaciones confirmadas secuencialmente representan versiones distintas. Dos simultáneas con la misma revisión no crean el mismo número de versión.

### 2. Relación exacta con documentos y artefactos

Crear `PrototypeFile` en Prisma con:

- ID opaco UUID independiente del nombre del archivo.
- `datasetId`, `caseId`, `category` y `anchor`, con unicidad por dataset/caso/categoría/ancla.
- Para `category=document`, `documentId` y `documentVersion` copiados del `DocumentItem` creado por `runAction`; `anchor` es el ID documental existente. No fabricar IDs alternativos para la UI.
- Para artefactos ficticios, categorías `ph`, `tax-draft`, `extraction`, `receipt` e `invoice`, ancladas respectivamente a `ph.version`, `tax.version`, `extraction.version`, referencia/fecha de presentación e `invoice.number`. Definir el ancla con un formato determinista validado y versionado, no con concatenaciones ambiguas.
- `originalName`, `mimeType`, `size`, `sha256`, `storageKey`, `createdAt` y usuario local de aportación. Marcar `source` como `uploaded` o `generated-demo`.
- Relación con la fila raíz `PrototypeState`; el vínculo al documento embebido se valida en el mismo callback transaccional de 09.

Mantener `DocumentItem` y versiones de PH/borrador/extractor como fuente de verdad de negocio. Para listados, transmitir un descriptor público de archivo por ID/version: `fileId`, tamaño, MIME, nombre y disponibilidad, nunca `storageKey`, rutas absolutas o usuario de otro caso.

Los archivos precargados o creados durante 09 tienen `source=metadata-only` en el descriptor derivado, sin inventar una fila con bytes inexistentes. Mostrar «Muestra precargada: solo metadatos» y ofrecer, si se conserva, un TXT de metadatos claramente distinto del original PDF. La descarga del original debe indicar no disponible, no devolver TXT con extensión `.pdf`.

### 3. Almacenamiento privado y consistencia

La raíz `PROTOTYPE_UPLOAD_DIR` es configuración privada, preferiblemente una carpeta absoluta de Windows fuera de `public`, `.output`, `.nuxt` y del directorio servido. Puede usar una carpeta local ignorada por Git para desarrollo, pero nunca bajo `public`. Resolverla y validarla al arrancar; un directorio no accesible produce error explícito.

`storageKey` se genera en servidor con dataset/UUID y sin el nombre original. No aceptar rutas del navegador. Normalizar y comprobar que cualquier ruta resuelta pertenece a la raíz; rechazar separadores, `..`, dispositivos/rutas UNC y enlaces de filesystem que escapen de ella. No incluir el nombre original en el path de almacenamiento.

No existe una transacción distribuida entre NTFS y SQL Server. Usar este protocolo:

1. Comprobar sesión/origen, ámbito portal/caso, campos, revisión inicial y límites; escribir temporal con creación exclusiva dentro de la raíz.
2. Medir bytes y SHA-256; mover a un nombre final único dentro del mismo volumen antes de confirmar metadatos.
3. En `mutatePrototype`, repetir validación de revisión/dataset/permisos sobre el estado vigente, ejecutar `add-document` y crear `PrototypeFile` con el ID/version resultante dentro del mismo commit SQL.
4. Si no hay commit, eliminar temporal/blob recién creado con un intento de limpieza registrado. No publicar documento ni éxito.
5. Si hay commit, no borrar el blob por un fallo de envío de la respuesta; consultar el estado antes de reintentar. La BD confirmada sigue siendo autoridad.

Un crash antes del commit puede dejar un blob huérfano. Implementar un comando local de reconciliación explícito que solo actúe sobre claves generadas por esta aplicación, conserve los referenciados y temporales recientes, y respete un margen mínimo de 24 horas. No borrar de forma recursiva la raíz, usar glob destructivo ni hacer un barrido automático que pueda eliminar una carga activa.

Si un blob referenciado falta o no puede leerse, mostrar error `FILE_UNAVAILABLE` y registrar causa; no entregar una muestra de sustitución con 200. Comprobar hash si se detecta inconsistencia; no declarar una descarga íntegra con bytes distintos.

### 4. Descarga autorizada y versiones

La descarga siempre atraviesa Nitro y usa la cookie de 08. No exponer un path público o un enlace directo al disco.

- Gestión interna: consultar los archivos del expediente autenticado con rol demo compatible con consulta interna.
- Portal: verificar sesión, token del caso, correspondencia del archivo con ese caso/dataset y visibilidad del artefacto. No confiar en `fileId` o query del cliente.
- Documento aportado: descargar exactamente los bytes almacenados de la versión pedida, incluidos anteriores, con su ID existente. Revisar o sustituir una versión no sobrescribe bytes previos.
- PH/borrador/justificante/factura solo son visibles en portal cuando sus condiciones públicas actuales lo permiten: PH enviada, borrador enviado y justificante/factura con envío simulado correspondiente. No publicar PH interna en revisión ni documentos de otro caso.
- `Content-Disposition: attachment` con nombre saneado y codificación Unicode; `Content-Type` validado, `X-Content-Type-Options: nosniff` y `Cache-Control: no-store`. No renderizar contenido aportado como HTML activo.
- IDs inexistentes o de otro caso responden 404 genérico; sesión ausente/caducada, 401; enlace portal inválido, 403 sin datos. Un archivo conocido con blob perdido responde error de disponibilidad, nunca otro archivo.

El acceso portal es una previsualización por operadores autenticados con identidad ficticia, no una autorización real de clientes. Dentro de ese ámbito se aplica aislamiento de caso en cada petición.

### 5. TXT/CSV ficticios y versiones históricas

Conservar las descargas actuales como **TXT/CSV ficticios**, sin convertirlas en PDF, XLSX fiscal ni una salida de integración. Centralizar la representación en `server/services/prototype-artifacts.ts`, evitando que portal y detalle generen versiones contradictorias.

Guardar bytes y metadatos de PH, borrador, extracción CSV, justificante e invoice por su ancla existente en puntos definidos: `ph-send` congela el contenido de la PH enviada; `tax-send`, el borrador enviado; `extraction-review`, las filas revisadas; `present`, el justificante ficticio; e `invoice`, la factura ficticia. Antes de esos puntos pueden mostrarse previsualizaciones de trabajo, sin afirmar que son una versión publicada e inmutable. Su creación no sustituye los comandos de envío, firma o aceptación. La generación de un archivo no hace que el portal pueda verlo antes de tiempo.

09 debe exponer el punto transaccional para que 10 prepare estos artefactos en servidor y los adjunte al commit del comando correspondiente. Si crear un artefacto requerido falla, el comando no avanza silenciosamente. El contenido de una versión ya publicada no se regenera con valores actuales: conservar los bytes originales de cada ancla. La fila SQL/ancla única evita duplicados ante reintentos; un comando que ya tiene esa ancla verifica la correspondencia sin reemplazarla. Nueva versión de PH o extractor crea otra ancla sin heredar firma/validación.

Para escenarios precargados, generar una representación ficticia de la versión actual una sola vez de forma explícita/idempotente; no reconstruir versiones antiguas cuyo contenido no existe. Indicar «histórico sin archivo disponible» cuando corresponda.

La exportación de listado de expedientes puede continuar como CSV local de la vista filtrada autenticada: es un resultado transitorio, no un documento del expediente. Mantener su aviso ficticio y escape actual. No almacenar cada combinación de filtros como nueva versión.

### 6. Reset y retención local

10 integra `reset-demo` de 09: en el commit cambiar dataset/restaurar estado y retirar todos los metadatos anteriores. Después eliminar solo los blobs conocidos de ese dataset. Desde el commit los IDs antiguos dejan de descargar, aunque una limpieza física falle.

Si falla una eliminación, mostrar «Datos reiniciados; limpieza de archivos pendiente» y registrar las claves para el comando local de reconciliación, sin fingir limpieza completada. Un reset cancelado no borra bytes ni metadatos. Una carga iniciada antes del reset falla por dataset/revisión y limpia su propio temporal.

No revocar login ni borrar el directorio completo. Documentar que reset elimina datos y archivos compartidos de demostración; los archivos locales deben ser muestras autorizadas sin información sensible.

## Contratos compartidos y endpoints

El agente de 10 crea `shared/types/prototype-files.ts`, con descriptor `PrototypeFileDescriptor` y errores `UPLOAD_INVALID` (400), `UPLOAD_TOO_LARGE` (413), `FILE_NOT_FOUND` (404), `FILE_UNAVAILABLE` (503) y `FILE_STORAGE_FAILED` (503). Reutilizar los códigos auth/conflicto de 08/09 y el formato H3 `data.code/message`.

Rutas internas:

- `GET /api/prototype/cases/:id/files`: descriptores del caso/dataset autorizado.
- `POST /api/prototype/cases/:id/files`: multipart `file`, `kind`, `datasetId`, `expectedRevision`; responde resultado confirmado de 09, `snapshot` interno y `file` descriptor.
- `GET /api/prototype/cases/:id/files/:fileId/download`.

Rutas portal:

- `GET /api/prototype/portal/:id/files?token=demo-<id>`: solo descriptores visibles del caso.
- `POST /api/prototype/portal/:id/files?token=demo-<id>`: mismo multipart, fuerza actor Cliente y devuelve snapshot portal.
- `GET /api/prototype/portal/:id/files/:fileId/download?token=demo-<id>`.

Las dos familias llaman al mismo servicio de archivos y a los helpers auth/store. Las entradas multipart no admiten `actor`, `documentId`, `version`, `storageKey` ni path. Validar el contenido después de parsear los campos; 10 no modifica el formato de `CommandEnvelope`.

Tras 10, la incorporación nueva de documentos a través del endpoint JSON genérico queda rechazada con error explicativo: debe usarse multipart. La acción `add-document` permanece en el motor y se ejecuta dentro del servicio de archivos; el seed histórico permanece válido. El botón interno «Añadir muestra» debe pasar por el mismo servicio con bytes de muestra explícitos o sustituirse por selector real, no conservar una vía de éxito sin archivo.

Ampliar respuestas de lectura con descriptores separados, sin cambiar el significado de `DocumentItem.id/version`. No introducir `fileId` como reemplazo del ID usado por `review-document` ni duplicar `currentDocuments`.

`useMockApp` añade `uploadDocument(caseId, file, kind)` asíncrono usando revisión/dataset vigentes y sincronizando la respuesta confirmada. El componente recibe pending/error y un callback tipado para esperar el resultado; no depender de un `emit` sin respuesta. Si 09 ya define el callback de comandos, 10 lo amplía para subida sin reconstruir las confirmaciones.

## Mapa de archivos y ownership

Archivos nuevos propiedad de 10:

- `shared/types/prototype-files.ts`.
- `server/services/prototype-files.ts`: validación, escritura y coordinación transaccional.
- `server/services/prototype-artifacts.ts`: TXT/CSV versionados.
- `server/utils/prototype-file-storage.ts`: rutas, temporales, lectura y limpieza específica.
- `server/api/prototype/cases/[id]/files/index.get.ts`, `index.post.ts`, `[fileId]/download.get.ts`.
- `server/api/prototype/portal/[id]/files/index.get.ts`, `index.post.ts`, `[fileId]/download.get.ts`.
- `prisma/migrations/<fecha>_prototype_files/migration.sql`.
- `scripts/prototype-files-reconcile.ts`: comando local acotado y con modo de inspección por defecto.
- `tests/e2e/prototype-10-files.spec.ts`, `tests/unit/prototype-files.test.ts`, `tests/unit/prototype-artifacts.test.ts`.

Archivos existentes que 10 extiende después de 09:

- `prisma/schema.prisma`: modelo `PrototypeFile`; no cambiar proveedor ni rehacer las tablas de estado.
- `server/services/prototype-commands.ts`: hooks de artefactos/reset y rechazo de aportación JSON, sin duplicar reglas del motor.
- `server/services/prototype-store.ts`: solo la extensión de transacción/reset pactada; conservar revisión/CAS.
- `app/composables/useMockApp.ts`: subida y descriptores, manteniendo nombre y operaciones de 09.
- `app/components/ClientPortal.vue`, `app/pages/portal/[id].vue`, `app/pages/expedientes/[id].vue`: selección `File`, espera de confirmación y descarga autenticada/versiones.
- `app/utils/download.ts`: mantener exportación de vista; las descargas persistentes dejan de fabricar originales en navegador.
- `app/layouts/default.vue`: avisos definitivos y alcance real del reset; no sustituir logout de 08.
- `nuxt.config.ts`, `.env.example`, `.gitignore`, `package.json`, `pnpm-lock.yaml`: raíz privada, limpieza y scripts, solo si hacen falta.
- `README.md`, `docs/prds/README.md`: guía de arranque y estado de implementación verificado.
- `tests/e2e/app.spec.ts`: adaptar las expectativas históricas que afirmaban «solo metadatos» para nuevas cargas; conservar flujo/versionado.

Reutilizar `tests/e2e/helpers/prototype-auth.ts`, `prototype-state.ts`, `prototype-server.ts` y `playwright.prototype.config.ts`. No editar estos helpers a la vez que 08/09. `app/utils/workflow.ts` no recibe lógica de filesystem ni Prisma; solo ajustar texto de `add-document` si dejó de describir correctamente el resultado, conservando su validación y mutaciones.

## Documentación de arranque que debe quedar completa

Actualizar la guía raíz únicamente cuando las tres etapas estén implementadas y comprobadas:

1. Requisitos Node/pnpm existentes, versión Prisma fijada, SQL Server local con TCP/puerto conocido y creación de `RCDRenta`. Explicar permisos mínimos de runtime y permisos separados si las migraciones requieren DDL.
2. `.env.example` sin credenciales reales. Ejemplo de URL `sqlserver://localhost:1433;database=RCDRenta;user=<usuario>;password=<clave>;encrypt=true;trustServerCertificate=true`; puerto ilustrativo/configurable. La confianza en certificado local es solo para desarrollo. Documentar escape de valores según el driver elegido, no copiar passwords al repositorio.
3. `PROTOTYPE_UPLOAD_DIR` privada con ejemplo de ruta Windows absoluta, permisos de lectura/escritura y exclusiones Git. No pasar URL SQL ni ruta de disco a `runtimeConfig.public`.
4. Comandos PowerShell exactos: instalar dependencias con lockfile, generar cliente Prisma, aplicar migraciones y arrancar en `http://127.0.0.1:3010`. El bootstrap autorizado ocurre solo en instalación nueva; no recomendar un seed que sobrescriba siempre.
5. Login de dos pasos con cualquier valor no vacío; logout y reinicio del servidor invalidan sesiones, no datos. Advertencias de identidad/MFA ficticios y no producción.
6. Qué persiste, quién comparte el dataset, qué borra reset y cómo cancelar. Explicar que la BD y la carpeta de archivos deben respaldarse/restaurarse juntas.
7. Distinción de archivos subidos reales, seed de metadatos y artefactos TXT/CSV ficticios. No asegurar que existe extracción, firma o presentación real.
8. Comandos de unitarios, E2E por los tres ficheros y build/typecheck; BD `RCDRentaE2E`, carpeta/puerto E2E aislados y guardas antes de reset. No reutilizar silenciosamente un servidor ajeno.
9. Diagnóstico de SQL no disponible, migraciones pendientes, estado corrupto, carpeta sin permisos/blob perdido y conflictos 409. Ninguno se resuelve con fallback o reset automático.
10. Comando de reconciliación con inspección por defecto, confirmación explícita para limpieza y mínimo de 24 horas; no instrucciones de eliminación recursiva de la raíz.

## Criterios de aceptación Playwright

Pruebas en SQL Server real y carpeta temporal específica del fixture, usando archivos de muestra generados en memoria. No usar documentos privados ni detener SQL Server compartido.

- **P10-CA01.** Subir un PDF de muestra conocido por portal; verificar descriptor enlazado al `DocumentItem.id/version` confirmado. Descargar después de recarga y comparar bytes y SHA-256 exactamente con el buffer original. Repetir desde gestión interna.
- **P10-CA02.** Dos aportaciones secuenciales del mismo tipo generan v2/v3 del expediente preparado, IDs distintos y dos archivos; revisar/descargar ambos después de recarga. La versión nueva invalida entrega/completitud y acuerdo/Criteria según el motor, no hereda «Válido».
- **P10-CA03.** Verificar cero bytes, 10.000.000 aceptados y 10.000.001 rechazados. Probar extensión/MIME incompatibles y multipart sin archivo/tipo. Tras rechazo, cantidad de documentos, metadatos y revisión no cambia, no queda un blob publicado. Probar API directa, no solo filtro del input.
- **P10-CA04.** Sin sesión o tras logout/caducidad, listado/subida/descarga devuelven 401. Portal de caso A con `fileId` de B devuelve 404 sin bytes; token inválido, 403 sin datos. Clara Renta y Clara 720 no comparten archivos.
- **P10-CA05.** Solicitar originales de seed indica «solo metadatos», no descarga un TXT como PDF. PH/borrador no enviados y justificante/factura no enviados no aparecen en portal. Publicados mantienen avisos ficticios y extensión/MIME TXT o CSV verdaderos.
- **P10-CA06.** Crear nueva PH/extracción y comprobar dos anclas/versiones persistentes con bytes inmutables de la anterior; nueva versión no conserva firma/Criteria. CSV incluye aviso «no XLSX ni importable en Criteria» y no se hace ninguna llamada externa.
- **P10-CA07.** Dos cargas concurrentes con la misma revisión producen un commit y un 409, sin IDs/versiones duplicados ni blob de la petición rechazada. Refrescar/reconfirmar conserva ambos archivos. Subida que cruza un reset no se adjunta al dataset nuevo.
- **P10-CA08.** Reiniciar solo el servidor de pruebas, repetir login y descargar mismos bytes/versiones desde SQL y disco existentes. No limpiar fixtures entre subida y reinicio.
- **P10-CA09.** Nombre con `..`, separadores o caracteres de cabecera no crea archivo fuera de raíz ni inyecta cabeceras; path o `storageKey` proporcionados por cliente se rechazan. Descriptores y HTML no exponen rutas locales. Descargas tienen attachment, no-store y nosniff.
- **P10-CA10.** Provocar escritura/lectura fallida o blob ausente en almacenamiento aislado del fixture: error visible 503, sin avance del motor por escritura fallida ni respuesta TXT de sustitución. Un fallo SQL posterior a escritura elimina el blob nuevo o deja una incidencia de limpieza explícita comprobable.
- **P10-CA11.** Cancelar reset conserva archivos/estado. Confirmar retira metadatos y acceso a IDs previos; se eliminan solo sus blobs. Fallo de limpieza conserva el reset confirmado pero muestra aviso pendiente. Reconciliación no elimina blobs referenciados ni temporales menores de 24 horas.
- **P10-CA12.** Ciclo completo R07: sustituir Datos fiscales con bytes, entregar explícitamente, revisar última versión y confirmar completitud; portal/gestión coinciden después de recarga. Ciclo 720 inicial admite ambos DNI antes del portal documental, conservando sus bloqueos de vigencia/consentimiento.
- **P10-CA13.** Sobre una instalación local de pruebas vacía, seguir comandos documentados de generación/migraciones/arranque, completar login, obtener 18 escenarios y subir/descargar archivo. La guía distingue persistencia y simulaciones; comprobación de enlaces de documentación y regresiones 08/09/históricas pasan.

## Validación y definición de terminado

Ejecutar unitarios de almacenamiento/artefactos, el fichero E2E de 10, regresión de 08/09 e históricos, `pnpm typecheck` y `pnpm build`. El filesystem y Prisma deben inspeccionarse desde helpers de prueba además del DOM para comprobar que no hay commits/archivos publicados en errores.

10 termina cuando se recuperan los mismos bytes tras recarga y reinicio, todas las rutas de archivo están autenticadas y aisladas por caso, las versiones se mantienen y la documentación permite arrancar con SQL Server local. No termina con metadatos persistidos y un `Blob` ficticio generado al descargar.

## Evidencia de implementación

Validación realizada el 30 de septiembre de 2026 con SQL Server real en localhost, Prisma y cliente `6.19.3`, Node `24.18.0`, pnpm `11.2.0` y Chromium real de Playwright. No se han realizado commits.

### Comandos y resultados

- `pnpm db:generate`: correcto. Se detuvo únicamente el árbol identificado del servidor propio porque Windows bloqueaba la DLL de Prisma; después se restauró el servidor principal con el entorno privado original.
- `pnpm db:deploy` y `pnpm db:e2e:deploy`: migración aditiva `20260930190000_prototype_files` aplicada correctamente a `RCDRenta` y `RCDRentaE2E`. No se utilizó `db push`, una BD shadow ni un reset de desarrollo.
- `pnpm exec prisma migrate diff --from-schema-datasource prisma\schema.prisma --to-schema-datamodel prisma\schema.prisma --script`: resultado `This is an empty migration`; el schema real y Prisma coinciden.
- `pnpm exec playwright test --config playwright.prototype.config.ts prototype-10-files.spec.ts`: **13 tests correctos**, P10-CA01 a P10-CA13, última ejecución completa en **1,5 minutos**. Navegador, API, SQL y filesystem reales; sin mocks de persistencia.
- `pnpm exec playwright test --config playwright.prototype.config.ts prototype-09-persistence.spec.ts`: **11 tests correctos**, incluida la tabla de los 40 discriminantes del motor con estado/historial conservados y los seis comandos adicionales.
- `pnpm exec playwright test app.spec.ts prototype-08-auth.spec.ts`: **21 tests correctos**, regresión histórica y autenticación. La regresión P05 vuelve a comprobar la confirmación visible después de una subida real.
- `pnpm typecheck`, `pnpm test`, `pnpm build`: correctos; **70 unitarios en siete ficheros**. Incluyen límites exactos, rutas/junctions, bytes y hashes, reconciliación y representación de artefactos sin notas internas.
- `pnpm files:reconcile`: inspección correcta, sin candidatos ni eliminaciones en desarrollo. El modo de limpieza se comprueba sobre almacenamiento aislado.
- Smoke del build de producción en un proceso propio en `127.0.0.1:3013`: listado sin sesión 401; login, MFA, lectura SQL y listado autenticado 200; 18 escenarios, revisión 0. Ese proceso se detuvo al terminar.
- Inspección Prisma de desarrollo después de migraciones/smoke: **una instalación, 18 escenarios, revisión 0, cero filas de archivos**. No se reiniciaron datos del usuario ni se inventaron originales del seed.

La ejecución combinada `pnpm test:e2e:persistence` sigue seleccionando 09 y 10. Para seleccionar una suite se usan los nombres indicados arriba: los argumentos de Playwright son expresiones regulares, no rutas Windows.

### Aceptación comprobada

1. **P10-CA01:** subida desde el selector real del portal y el selector interno; ID/version iguales a `DocumentItem`; descargas de navegador y API después de recarga idénticas al buffer original y al SHA-256 inspeccionado en SQL/disco.
2. **P10-CA02:** v2 entregada, revisada y completada antes de incorporar v3; IDs distintos, v2 mantiene su revisión y bytes, v3 queda pendiente de entrega/revisión e invalida completitud. También se comprueban invalidación del acuerdo Renta y de Criteria.
3. **P10-CA03:** cero bytes rechazados, 10.000.000 aceptados, 10.000.001 rechazados. Se comprueban todos los MIME admitidos, incompatibilidades y campos obligatorios. Un cuerpo chunked superior a 10.064.000 sin `Content-Length` devuelve 413; los rechazos no cambian revisión, documentos, filas SQL ni blobs publicados.
4. **P10-CA04:** todas las rutas de listado/subida/descarga requieren sesión; logout bloquea descarga. Token inválido 403 e ID ajeno 404. Los archivos de Clara Renta y Clara 720 tienen ámbitos independientes. P10-CA08 y la regresión 08 comprueban la caducidad/revocación servidor.
5. **P10-CA05:** originales de seed no disponibles, descriptor `metadata-only` sin fila inventada. PH no enviada y justificante/factura no enviados permanecen privados; los dos últimos solo aparecen después de sus envíos simulados. La generación explícita desde el navegador conserva revisión/anclas al repetirse, con extensión/MIME TXT/CSV reales.
6. **P10-CA06:** dos PH y dos extracciones conservan anclas distintas. Una PH anterior mantiene los mismos bytes; las dos extracciones contienen filas diferentes congeladas, sin reconstruir la primera con valores actuales. CSV indica «no XLSX ni importable en Criteria». No hay llamadas externas ni filtración de notas PH/fiscales internas.
7. **P10-CA07:** dos uploads simultáneos sobre una revisión producen un 200 y un 409, un solo blob/commit; reconfirmar conserva ambos. Una petición HTTP iniciada antes de reset y completada después falla 409 y elimina su blob, sin adjuntarse al dataset nuevo.
8. **P10-CA08:** reinicio real del PID del fixture, reautenticación, mismos datos SQL y descargas exactas desde disco sin reconstruir la BD ni limpiar archivos entre subida y reinicio.
9. **P10-CA09:** nombres con rutas, `..`, controles de cabecera o dispositivos rechazados; también `path`, `storageKey`, `actor`, `documentId` y `version` suministrados por el cliente. JSON/HTML no exponen rutas ni usuarios internos. Descarga Unicode con attachment, no-store y nosniff; unitarios comprueban rechazo de junctions sin escribir fuera.
10. **P10-CA10:** escritura fallida en almacenamiento aislado, constraint SQL de prueba posterior a escribir bytes y blob ausente producen 503 visible. No avanzan ni upload ni PH-send si su archivo requerido falla. Rollback elimina blobs no confirmados; la selección sigue disponible. Un blob ausente señala `FILE_UNAVAILABLE`, nunca una muestra sustituta.
11. **P10-CA11:** cancelación conserva estado/archivos; confirmación retira metadatos/IDs y limpia solo claves conocidas. Un fallo físico conserva el reset confirmado y devuelve aviso de limpieza pendiente. Reconciliación conserva blobs referenciados y temporales recientes; inspección no elimina, limpieza explícita elimina solo huérfanos con antigüedad mínima de 24 horas.
12. **P10-CA12:** R07 sustituye bytes, entrega expresamente, revisa última versión y confirma completitud visible en portal/gestión tras recarga. 720 inicial admite y descarga ambas caras del DNI antes del portal documental y conserva los rechazos por consentimiento o vigencia.
13. **P10-CA13:** instalación E2E vacía, migraciones y arranque mediante fixture documentado, login, exactamente 18 escenarios (nueve por campaña), subida/descarga reales. La comprobación documental de enlaces/estado y las regresiones históricas/08/09 forman parte de la validación.

### Contrato implementado y operación local

`PrototypeFile` se relaciona con `PrototypeState`; los documentos usan el ID/version resultantes del motor dentro del mismo commit. Los blobs usan claves UUID del dataset y nombres opacos, con temporales exclusivos y SHA-256. El servicio vuelve a validar ámbito/revisión dentro de la transacción y comprueba SQL antes de borrar tras un resultado de commit incierto. Un fallo de proyección/respuesta posterior a commit no borra un blob confirmado.

Los listados/snapshots añaden descriptores separados, sin sustituir `DocumentItem.id`. Detectan archivos ausentes/ilegibles y notifican disponibilidad; la descarga verifica tamaño/hash y autorización de nuevo. El endpoint JSON genérico rechaza `add-document`: únicamente multipart puede incorporar nuevos documentos.

Para el seed existe un endpoint adicional explícito e idempotente, `POST /api/prototype/cases/:id/files/artifacts` y su equivalente portal con token. Recibe `{ datasetId, expectedRevision, confirm: true }`, genera solo representaciones actuales publicables y no ejecuta un envío de negocio. El portal solo puede preparar categorías actualmente visibles; nunca extracción interna ni versiones privadas. No se modifica `CommandEnvelope`.

La [guía principal](../../../README.md) documenta instalación, permisos SQL, variables privadas, reinicio sin seed, backup/restauración conjunta y reconciliación con inspección por defecto. `.env` original se conserva y nunca se versionan secretos. El servidor principal se mantiene en `127.0.0.1:3010`; los fixtures solo utilizan sus propios procesos en 3011/3012.

**Pendiente únicamente fuera del alcance de producción:** identidad/MFA y permisos reales, antivirus/DLP, plantillas fiscales/contables finales, firma electrónica, cálculo/presentación fiscal, OCR/IA/extractor real, correo/Teams y conexiones NAV/Criteria/almacenamiento externo. No quedan criterios locales omitidos.
