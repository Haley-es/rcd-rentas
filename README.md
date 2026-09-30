# RCD · Campañas fiscales

Mockup interactivo de la digitalización de campañas de Renta y Modelo 720, construido a partir de la documentación original de [docs](docs). Incluye gestión interna, comunicación y un portal individual de cliente.

**No es una aplicación de producción.** Los escenarios, nombres, correos, honorarios y plazos son ficticios. El estado y los metadatos se conservan en SQL Server local mediante Prisma. Los archivos seleccionados se transmiten y guardan como bytes reales en disco privado local: utiliza exclusivamente muestras autorizadas, sin información personal real. Identidad/MFA, correo/Teams, firma, extractor, presentación, NAV y Criteria siguen simulados y sin integraciones.

El [PRD 11: aplicación final y puesta en producción](docs/prds/todo/11-aplicacion-final-y-puesta-en-produccion.md) recoge el trabajo pendiente, incluido el registro de clientes, las prioridades, las decisiones que debe aprobar RCD y los criterios de aceptación. Es una hoja de ruta, no funcionalidad implementada.

## Puesta en marcha

Requiere Node.js `^22.19.0`, `^24.11.0` o `>=26` y pnpm `11.2.0`. Validado con Node `24.18.0`. El comando de reconciliación utiliza los hooks y el soporte TypeScript nativo de Node 24; usa Node 24 para esta entrega.

Un administrador debe disponer de SQL Server local con TCP habilitado y puerto conocido (1433 es ilustrativo), crear `RCDRenta` y conceder al login acceso a esa BD. En runtime se necesitan SELECT/INSERT/UPDATE/DELETE sobre las tres tablas del prototipo y lectura del marcador de instalación; las migraciones requieren permisos DDL separados (crear/alterar tablas, índices y restricciones). No se requiere un servicio SQL de producción.

```powershell
pnpm install --frozen-lockfile
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Editar .env localmente antes de continuar. Nunca imprimir ni versionar secretos.
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Antes de las operaciones de BD, configura `DATABASE_URL` en el archivo privado e ignorado `.env`, siguiendo [.env.example](.env.example), para SQL Server localhost y la BD existente `RCDRenta`. Prisma y `@prisma/client` están fijados a **6.19.3**. `db:deploy` aplica migraciones reproducibles; no utiliza `db push` ni necesita crear una BD shadow. La primera lectura autorizada inicializa una única vez los 18 escenarios. Una instalación inconsistente o corrupta produce un error, no un nuevo seed.

La URL sigue `sqlserver://localhost:1433;database=RCDRenta;schema=dbo;user=<usuario>;password=<secreto>;encrypt=true;trustServerCertificate=true`. Encierra valores con caracteres reservados JDBC (`;`, `=`, llaves) entre llaves según el conector Prisma SQL Server; consulta su documentación y prueba la conexión sin publicar la URL. La confianza en el certificado es exclusivamente para localhost. Nunca pases la URL ni la ruta de disco a configuración pública.

Configura también `PROTOTYPE_UPLOAD_DIR=C:\work\RCD.Rentas.blobs`, ruta absoluta local privada con permisos de lectura/escritura. No uses `public`, `.output`, `.nuxt`, rutas UNC, dispositivos, enlaces/junctions ni carpetas servidas. Si falta la variable, desarrollo utiliza `.prototype-files` ignorada por Git. La carpeta se comprueba al arrancar; un error de acceso es explícito. `.env` y `.env.*` están ignorados salvo el ejemplo sin secretos. Mantén cualquier directorio alternativo fuera del repositorio o excluido expresamente.

Abrir `http://127.0.0.1:3010`. Desarrollo y preview usan **3010** y escuchan únicamente en la interfaz local. Las pruebas usan servidores y una BD separados.

El acceso pasa por `/login` y `/mfa`. Cualquier usuario, contraseña y código que no estén vacíos tras recortar espacios son válidos; por ejemplo `x`, `!` y `texto`. **No introduzcas credenciales reales:** no se verifica ninguna identidad ni autorización. El rol sigue siendo una simulación de negocio, no permisos de producción.

El desafío dura 5 minutos y la sesión 8 horas absolutas, en el reloj del servidor, con cookies HttpOnly y sin almacenamiento web. «Cerrar sesión» revoca el acceso y limpia los datos del navegador; reiniciar Nitro invalida las sesiones. Las páginas, el portal y las APIs requieren sesión; las mutaciones también requieren mismo origen. [PRD 08](docs/prds/done/08-login-mfa-y-sesion-local.md) documenta los contratos para las siguientes etapas.

```powershell
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:persistence
pnpm exec playwright test --config playwright.prototype.config.ts prototype-10-files.spec.ts
pnpm build
pnpm preview
```

Los tests E2E usan exclusivamente `RCDRentaE2E` en localhost, con las mismas migraciones. Nunca reinician los datos de `RCDRenta`. Un administrador local puede provisionar la BD de pruebas y dar acceso al login SQL existente mediante `powershell -File scripts\provision-prototype-e2e.ps1`; el script usa los permisos del principal Windows actual, no almacena credenciales y no altera los permisos de desarrollo. Si no dispone de esos permisos, la preparación debe realizarla un administrador. `pnpm db:e2e:deploy` comprueba la conexión y aplica las migraciones. `PROTOTYPE_E2E_DATABASE_URL` permite configurar de forma privada otra conexión, pero sigue exigiendo localhost y exactamente el nombre `RCDRentaE2E`.

La regresión y las suites de persistencia/archivos usan **3011**, build separado, carpeta privada `node_modules\.cache\prototype-files-e2e` y `workers: 1`; no reutilizan servidores ajenos. Se ejecutan secuencialmente porque comparten la BD E2E. `pnpm test:e2e:persistence` ejecuta 09 y 10; `pnpm exec playwright test --config playwright.prototype.config.ts prototype-09-persistence.spec.ts` selecciona 09. `pnpm exec playwright test app.spec.ts prototype-08-auth.spec.ts` selecciona la regresión histórica y auth. Los argumentos de Playwright son expresiones de selección, no rutas Windows: utiliza estos nombres. La caducidad usa además **3012** con TTL cortos solo en su fixture. Los fixtures detienen exclusivamente sus procesos identificados. En Windows, generar Prisma mientras Nitro carga su DLL puede dar EPERM: detén únicamente el servidor propio, genera y vuelve a arrancarlo. Nunca mates procesos por nombre.

## Qué se puede explorar

- **Vista general:** indicadores calculados sobre los datos de la campaña seleccionada, distribución por fase y casos con bloqueos.
- **Expedientes:** 18 escenarios, filtros por campaña, fase y responsable, búsqueda y exportación de la vista a CSV ficticio.
- **Comunicación:** listas y segmentos, invitación a los contactos seleccionados, formularios, negativas, agradecimientos y aceptación que abre un expediente único.
- **Tareas:** bandejas de negocio, PBC e IT; evaluación manual de seguimientos con reloj de demostración. Captación: 7 días hasta recordatorio y 3 adicionales hasta llamada. Firma: llamada a los 3 días. El correo de firma opcional y la cadencia documental son supuestos configurables del mockup.
- **Propuesta de honorarios:** revisión del socio, versiones, envío manual del profesional, firma ficticia del cliente, rechazo negociable y retirada definitiva diferenciados.
- **Validaciones:** DNI vigente y dos caras, certificado y autorización independientes; incidencias PBC y resolución humana; registro manual de referencia NAV.
- **Documentos:** subida de bytes reales en gestión y portal, versiones inmutables y solicitudes de sustitución; entrega explícita al profesional y validación manual del conjunto.
- **Renta:** borradores iterativos, aceptación de la versión vigente, presentación por RCD o por cliente, justificante según rama, factura y cierre sin dar por confirmado el cobro.
- **720:** extractor activado manualmente, fallo técnico e incidencia IT separados de PBC, revisión de filas, representación CSV y registro de carga manual de la versión vigente en Criteria.
- **Portal:** requiere login y MFA simulado, conserva el enlace/token después del acceso y solo entrega datos del caso enlazado. Los enlaces incorrectos o expirados de demostración no muestran datos.

## Recorridos recomendados

| Escenario | Cómo probarlo |
| --- | --- |
| `DEMO-R01` | Abrir portal, aceptar consentimiento y confirmar respuesta; revisar la PH generada sin envío automático. |
| `DEMO-R04` | Validar DNI con una fecha vencida y comprobar bloqueo; indicar fecha futura, validar y continuar con PBC. |
| `DEMO-R06` | Cambiar rol a PBC o Socio, resolver incidencia con nota; cambiar a Altas para registrar NAV manualmente. |
| `DEMO-R07` | Sustituir Datos fiscales desde portal, entregar tanda, volver al profesional, revisar última versión y confirmar completitud. |
| `DEMO-R08` | Cliente acepta borrador en portal; profesional registra presentación, envía justificante y factura y cierra. |
| `DEMO-R09` | Cliente confirma presentación; profesional emite/envía factura y cierra sin certificado ni envío de justificante por RCD. |
| `DEMO-72002` | PH previa importada: confirmar antecedentes de forma explícita, entregar/revisar documentos y continuar sin nueva PH ni alta. |
| `DEMO-72003` | Socio aprueba PH; profesional la envía; cliente firma la misma versión desde portal. |
| `DEMO-72004` | Renegociar PH rechazada, crear versión nueva y repetir revisión y firma. |
| `DEMO-72007` | IT registra ajuste; profesional reintenta extractor, revisa Excel y registra carga manual Criteria. |
| `DEMO-72008` | Registrar carga manual en Criteria con fecha/referencia; después registrar presentación ficticia. |
| `DEMO-72009` | Enviar justificante, emitir/enviar factura y cerrar. |

Clara Martínez aparece en Renta y 720 como dos expedientes independientes. El selector de rol simula controles de UX; **no es una frontera de seguridad**. Al escoger Cliente, la navegación cambia al portal de un único caso. «Volver a gestión demo» devuelve explícitamente al modo profesional.

## Estado y archivos

El servidor es la única autoridad del estado de negocio. Todos los comandos del motor, ajustes y reloj se confirman en una transacción SQL con revisión global y `datasetId`; un conflicto devuelve 409 y exige refrescar y confirmar de nuevo. Recargar, abrir otra pestaña o reiniciar Nitro conserva expedientes e historial. Las preferencias de rol se guardan por usuario demo. No se usa almacenamiento persistente del navegador ni un fallback en memoria.

«Reiniciar demo» requiere confirmación explícita: borra los cambios compartidos de todos los usuarios, restaura los 18 escenarios y los ajustes, incrementa la revisión y cambia el dataset; no cierra la sesión. Un fallo de SQL conserva la última vista confirmada como no sincronizada y bloquea mutaciones hasta un reintento explícito. El portal recibe un DTO individual sin historial, PBC/NAV internos ni extracción/IT.

La autenticación mantiene un registro efímero independiente en Nitro; reiniciar el servidor exige repetir el acceso, sin perder SQL ni archivos. [PRD 09](docs/prds/done/09-persistencia-prisma-sql-server.md) contiene el contrato transaccional. [PRD 10](docs/prds/done/10-archivos-locales-y-arranque.md) está implementado y validado: 13 E2E propios, 11 de persistencia, 21 de auth/regresión, 70 unitarios, typecheck y build correctos.

Los archivos se validan también en servidor por extensión/MIME coherentes y tamaño: PDF, PNG, JPEG, DOC/DOCX o XLS/XLSX, **1 a 10.000.000 bytes** inclusive. Multipart admite un archivo y tres campos acotados, con máximo global 10.064.000 bytes medido durante lectura, no solo por `Content-Length`. No es antivirus ni validación legal. Los nombres nunca determinan rutas. La confirmación incluye negocio, metadatos SQL y blob; ante error se conserva selección y se exige consultar estado antes de reintentar.

Las descargas pasan por Nitro con sesión, caso, dataset y visibilidad portal, con attachment, nosniff y no-store. Nunca hay URLs públicas de disco. Las referencias PDF del seed son **solo metadatos**, sin originales inventados. «Preparar muestras TXT/CSV actuales» genera explícitamente la representación ficticia actual una sola vez por ancla; no reconstruye históricos. PH enviada, borrador enviado, filas revisadas, presentación y factura congelan TXT/CSV servidor dentro del comando correspondiente. No son PDF fiscales, XLSX, OCR, IA ni formatos importables en NAV/Criteria.

Reset confirmado retira todos los metadatos/IDs anteriores y después elimina solo sus blobs conocidos. Si falla limpieza, muestra «Datos reiniciados; limpieza de archivos pendiente» y registra claves en el log servidor. Cancelar no modifica nada. Una carga que cruza reset no se adjunta al nuevo dataset. No se elimina recursivamente la raíz.

## Reinicio, backup y diagnóstico

Detén el proceso propio con Ctrl+C y vuelve a ejecutar `pnpm dev`; repite login/MFA. No ejecutes seed ni reset como parte del arranque. Conserva `.env` original privado.

Para backup consistente, detén escrituras del prototipo, respalda la BD SQL Server y copia toda `PROTOTYPE_UPLOAD_DIR` durante la misma pausa. Guarda secretos aparte con acceso restringido. Restaura **BD y blobs juntos** de la misma copia; después arranca y vuelve a autenticar. No combines dataset de una copia con archivos de otra.

- SQL no disponible: 503 explícito, sin fallback ni seed. Revisa servicio/TCP y conexión privada.
- Migraciones pendientes: ejecuta `pnpm db:deploy` con principal DDL; nunca `db push --force-reset`.
- `STATE_INVALID`: estado corrupto/inconsistente; detén cambios y restaura backup conjunto. No se reinicia automáticamente.
- `FILE_STORAGE_FAILED`: carpeta sin permisos, enlaces o escritura fallida; el comando no avanza. Revisa acceso.
- `FILE_UNAVAILABLE`: blob perdido/alterado/ilegible; error 503 sin TXT sustitutivo. Restaura backup.
- 409: refresca, revisa versiones y confirma expresamente otra vez; no hay reintento automático.

Un crash antes del commit puede dejar un blob huérfano. Reconciliación es local y explícita, inspección por defecto:

```powershell
pnpm files:reconcile
pnpm files:reconcile --clean --confirm
```

Solo inspecciona claves UUID de esta aplicación. Conserva todos los archivos referenciados en SQL y temporales/blobs con menos de **24 horas**. No borra nombres ajenos, enlaces ni directorios. La limpieza requiere ambas opciones y elimina individualmente únicamente candidatos no referenciados y suficientemente antiguos; las incidencias devuelven fallo visible. Detén escrituras para una intervención de mantenimiento, no ejecutes barridos automáticos.

Fechas, checklists, tarifas y estructura del Excel son ilustrativos. Las plantillas y tarifas comerciales, campos NAV, prompt del extractor, formatos Criteria y calendario fiscal definitivo siguen pendientes de definición en las fuentes.

## Tecnología y estructura

- Nuxt 4, Vue 3 y TypeScript.
- Prisma 6.19.3 y SQL Server: codec versionado, bootstrap de instalación nueva, comandos servidor y concurrencia CAS.
- pnpm con lockfile y autorización explícita del script de esbuild.
- PrimeVue 4, tema Aura personalizado y PrimeIcons.
- [Motor de flujo](app/utils/workflow.ts): transiciones, roles, validaciones, versionado e historial.
- [Escenarios](app/data/seed.ts): datos ficticios reproducibles.
- [PRDs](docs/prds): requisitos derivados de las fuentes, con trazabilidad y criterios de aceptación.
- [Tests unitarios](tests/unit/workflow.test.ts) y [E2E](tests/e2e/app.spec.ts): umbrales exactos, aislamiento, bloqueos, versionado, carga documental, ramas fiscales y responsive móvil.
- [Presentación comercial](presentacion/README.md): web estática independiente con demo animada del ciclo completo sobre capturas del prototipo.
- [Landing para clientes](landing/README.md): web estática independiente para que los clientes de RCD contraten la Renta y el Modelo 720, con test orientativo del 720 y formulario de solicitud (sin envío real).

Los módulos implementados se trasladan de [todo](docs/prds/todo) a [done](docs/prds/done) después de validar sus recorridos de mockup. «Done» describe el prototipo, no una integración o servicio real.
