# PRD 11. De prototipo local a aplicación final de RCD

**Estado:** pendiente de implementación.
**Fecha:** 30 de septiembre de 2026.
**Prioridad:** P0 para identidad, autorización, protección de datos y operación; P1 para completar los procesos de negocio; P2 para mejoras posteriores.
**Tipo:** PRD marco y hoja de ruta. No acredita una auditoría ni una aplicación lista para producción.

## 1. Objetivo y alcance

Convertir el prototipo de Renta y Modelo 720 en una aplicación que pueda utilizar RCD con clientes, documentos y expedientes reales. Debe permitir dar de alta a un cliente, verificar su acceso, vincularlo únicamente a sus expedientes y gestionar su documentación y los procesos profesionales con evidencias verificables.

La solicitud de este documento no implica implementar estas funciones. Antes del desarrollo se deben acordar las decisiones pendientes y desglosar los bloques en PRDs de entrega, cada uno con pruebas Playwright. Este PRD permanecerá en `todo` hasta cumplir todos los criterios de la salida acordada; las entregas parciales no lo convierten en terminado.

Una primera versión final puede conservar determinados trámites manuales si RCD los aprueba y define sus responsables y evidencias. No puede conservar identidad o MFA falsos, permisos elegibles por el usuario, resultados fiscales ficticios ni mensajes de éxito que no correspondan a una operación real.

## 2. Base existente y trazabilidad

El punto de partida es la [guía del prototipo](../../../README.md) y los diez PRDs anteriores:

- [01: panel y expedientes](../done/01-panel-campanas-y-expedientes.md) y [02: captación y formularios](../done/02-captacion-y-formularios.md).
- [03: honorarios y firma](../done/03-propuesta-honorarios-y-firma.md) y [04: validaciones, PBC y NAV](../done/04-validaciones-pbc-y-alta-nav.md).
- [05: portal y documentos](../done/05-portal-y-revision-documental.md), [06: Renta](../done/06-renta-borrador-presentacion-y-cierre.md) y [07: Modelo 720](../done/07-modelo-720-extraccion-criteria-y-cierre.md).
- [08: acceso simulado](../done/08-login-mfa-y-sesion-local.md), [09: persistencia SQL](../done/09-persistencia-prisma-sql-server.md) y [10: archivos locales](../done/10-archivos-locales-y-arranque.md).

Los PRDs históricos contienen referencias a los diagramas, la propuesta y el correo originales. Sus tarifas, checklists, campos NAV, formatos Criteria y determinadas reglas son supuestos o pendientes, no requisitos de producción aprobados. Las propuestas de este documento deben validarse con RCD y no sustituyen esas fuentes.

| Área | Lo que existe | Lo que falta para uso real |
| --- | --- | --- |
| Acceso | Login y MFA aceptan cualquier valor no vacío; sesiones efímeras del servidor | Cuentas, credenciales verificadas, MFA real, recuperación y gestión de sesiones |
| Cliente | Portal de un expediente con enlace determinista de demostración | Registro/activación, identidad vinculada al cliente y autorización por expediente |
| Permisos | Selector de rol y controles de flujo | Roles y asignaciones administrados, comprobados en servidor |
| Datos | Prisma y SQL Server; estado de negocio en un snapshot global versionado | Modelo e índices adecuados al volumen, segregación por expediente y migración a datos reales |
| Documentos | Bytes privados, metadatos, versiones, hashes, límites y descargas | Análisis de contenido, cuarentena, almacenamiento operable, retención y recuperación |
| Procesos | Flujos y validaciones humanas demostrables | Reglas, tarifas, plazos, evidencias y procedimientos aprobados |
| Comunicaciones | Eventos simulados y evaluación manual de seguimientos | Envíos reales, planificación durable, reintentos y tratamiento de fallos |
| Firma, fiscal y ERP | TXT/CSV de muestra, confirmaciones y referencias ficticias | Documentos válidos y trámites reales, manuales o integrados según decisión de RCD |
| Operación | Arranque local, migraciones y backup manual documentados | Entornos, despliegue, supervisión, continuidad, soporte y conformidad |

## 3. Registro, acceso y portal del cliente — P0

### 3.1. Alta y activación

**Propuesta pendiente de aprobación:** comenzar con registro por invitación emitida por RCD. El registro público puede añadirse si existe una necesidad comercial definida; una solicitud pública no debe dar acceso automático a clientes o expedientes existentes.

El recorrido debe ser:

1. Un empleado autorizado crea o importa el cliente, revisa posibles duplicados y asigna el responsable.
2. RCD envía una invitación de activación a un contacto autorizado. El enlace utiliza un token aleatorio, de un solo uso, con caducidad y revocación; no revela información fiscal.
3. El cliente verifica el correo y establece sus credenciales, o usa el proveedor de identidad aprobado. Verificar el correo acredita su control, no valida por sí solo un DNI ni una identidad legal.
4. Se configura MFA real y su recuperación. RCD aprueba el método y la política para clientes y empleados.
5. El servidor vincula la cuenta al cliente previamente autorizado. Una coincidencia de nombre, correo o DNI introducida por el usuario no concede acceso por sí sola.
6. El cliente accede a su inicio privado y selecciona entre sus expedientes autorizados de Renta/720 y ejercicios, sin entrar en la gestión interna.

Definir el caso de representantes, unidades familiares y varios contactos por cliente: cada persona debe tener cuenta propia y una delegación explícita, acotada y revocable. No se deben compartir contraseñas.

### 3.2. Ciclo de vida de cuentas

- Recuperación de contraseña y MFA, cambio de correo con nueva verificación, bloqueo y baja de cuenta.
- Revocación de invitaciones y sesiones; caducidad absoluta y por inactividad aprobadas.
- Mensajes que no revelen si un correo está registrado; límites de intentos y prevención de abuso.
- Si se almacenan contraseñas propias, usar un mecanismo de hash de contraseñas aprobado, nunca texto claro ni cifrado reversible.
- Usuarios internos gestionados por RCD; valorar SSO corporativo sin imponer un proveedor en este PRD.
- Sesiones y revocaciones compatibles con varias instancias. No depender únicamente del registro en memoria de un proceso Nitro.
- El cliente no puede elegir un rol interno ni volver a gestión desde su portal.

### 3.3. Portal final

Además de la carga existente, el portal debe mostrar solicitudes pendientes, checklist aplicable, versiones, estado de revisión, motivos de sustitución y confirmación de entrega. Subir un archivo no debe equivaler a entregarlo, validarlo o dar por completo el expediente.

Incluir datos de contacto editables según permisos, consentimientos versionados, propuestas y documentos enviados, borradores y respuestas, justificantes y facturas reales cuando correspondan. Los datos internos de PBC, notas del equipo, extracciones y otros clientes permanecen excluidos también de API y SSR.

Los enlaces de notificación deben exigir autenticación y autorización por cuenta/expediente. Reemplazar `demo-<id>`; un enlace válido nunca puede conceder por sí solo acceso a un tercero.

## 4. Autorización, auditoría y administración — P0

- Acordar una matriz de permisos para Cliente, Profesional, Socio, Paralegal, PBC, Altas, IT y administración, conservando la separación de responsabilidades de los flujos.
- Asociar permisos a la identidad autenticada y a la asignación del expediente. Validar lectura, cambios, exportaciones, archivos y acciones fiscales en el servidor, no solo en botones.
- Restringir especialmente PBC, datos identificativos, certificados, facturación y administración. IT no debe recibir acceso general a documentación fiscal por resolver una incidencia técnica.
- Mantener las comprobaciones de transición del motor: disponer de un rol autorizado no permite saltar aprobaciones, versiones o documentación exigidas.
- Registrar actor real, operación, expediente, fecha UTC, correlación, versiones y resultado. Proteger el registro frente a modificación por usuarios ordinarios; evitar copiar documentos, secretos o datos personales innecesarios en logs.
- Definir el proceso de altas/bajas del equipo, reasignaciones, delegaciones, revisión periódica de permisos y acceso excepcional con justificación.
- Sustituir reset global, reloj de demostración, generadores de muestras y selector de rol por herramientas de pruebas que no estén disponibles en producción, ni por UI ni por API.

## 5. Datos, archivos y privacidad — P0

### 5.1. Datos de negocio

El [esquema Prisma actual](../../../prisma/schema.prisma) tiene un snapshot global de negocio y archivos asociados. Debe diseñarse y medirse su evolución, no afirmar que la persistencia local ya resuelve el modelo final.

- Separar identidades, clientes, contactos/delegaciones, campañas y ejercicios, expedientes, asignaciones, documentos/versiones, propuestas, tareas y eventos según sus necesidades de consulta y autorización.
- Definir identificadores estables, relaciones y restricciones; impedir duplicados sin confundir campañas independientes del mismo cliente.
- Evaluar granularidad de concurrencia por expediente para no provocar conflictos globales entre casos independientes. Mantener versionado y transacciones, sin sobrescribir trabajo de otros usuarios.
- Preparar migraciones versionadas, índices, estrategia de actualización y compatibilidad durante despliegues; migrar los datos útiles sin introducir escenarios de demostración.
- La instalación de producción comienza vacía o mediante importación aprobada. No ejecutar seed automático de 18 casos ni reset de datos reales.

### 5.2. Documentos y certificados

- Mantener los límites actuales de 1 a 10.000.000 bytes hasta que RCD apruebe otra política; comprobarlos en servidor.
- Validar contenido real, no solo extensión/MIME declarado. Analizar malware y definir tratamiento de formatos Office, contenido activo y archivos no analizables.
- Guardar nuevas cargas en cuarentena hasta resultado aceptable; no habilitar descarga ni revisión como documento válido mientras estén pendientes o rechazadas.
- Adoptar almacenamiento privado respaldado y compatible con la topología elegida: disco administrado si es una única instancia o servicio compartido si hay varias. No depender de una carpeta local de desarrollo para un despliegue distribuido.
- Conservar versiones inmutables, hashes y relación con el expediente; coordinar transacciones, fallos y reconciliación sin borrar cargas en curso.
- Definir cuotas, capacidad, retención, eliminación autorizada y preservación por obligaciones legales.
- Definir cómo se custodian certificados y autorizaciones. Una casilla «disponible» no es evidencia suficiente; no almacenar claves privadas o contraseñas en documentos o logs sin una solución de custodia aprobada.

### 5.3. Privacidad y cumplimiento

RCD y sus responsables legales deben aprobar finalidad, base jurídica, información al cliente, encargados de tratamiento, ubicaciones y transferencias, plazos de conservación y atención de derechos conforme a la normativa aplicable. No confundir aceptación del servicio con consentimiento para todas las finalidades.

Definir cifrado en tránsito y reposo, acceso a backups, gestión/rotación de secretos, borrado y bloqueo por conservación, y respuesta a incidentes. Determinar si procede una evaluación de impacto. No incorporar datos reales hasta aprobar estas medidas y la salida de P0.

## 6. Completar los procesos e integraciones — P1

| Bloque | Trabajo pendiente | Condición para considerarlo real |
| --- | --- | --- |
| Captación | Importación real con previsualización, errores por fila, duplicados, responsable y PH previa; formularios y negativas | Importación aprobada y trazable; aceptar abre un expediente único y detiene seguimientos de captación |
| Campañas | Ejercicios, fechas, calendarios y checklist por servicio; reglas de asignación y excepciones | Reglas aprobadas por RCD, sin tarifas ni fechas ilustrativas |
| Correo y Teams | Plantillas, destinatarios autorizados, enlaces privados, entrega y rebotes; Teams solo si se acuerda | Diferenciar pendiente, aceptado por proveedor, entregado y fallido; nunca marcar enviado ante fallo |
| Seguimientos | Planificador durable, zona horaria, calendario, cancelación, deduplicación y recuperación tras caídas | Cadencias 7/3 de captación y 3 de firma preservadas, con días naturales/hábiles y excepciones aprobados |
| Honorarios y firma | Tarifas/impuestos, plantillas válidas, aprobación de socio, renegociación y firma real | Firma vinculada a la versión exacta, con evidencia y procedimiento jurídico aprobado |
| DNI y PBC | Checklist de revisión, vigencia, evidencias y resolución humana; WorldCheck solo con acceso/contrato autorizado | «Apto» requiere una decisión responsable; no se deduce de subir un documento ni de una respuesta simulada |
| NAV/Navision | Acordar campos, referencias, exportación/importación y conciliación | El alta manual puede mantenerse según las fuentes, con actor/evidencia; no exigir una API no acordada |
| Renta | Borradores reales versionados, conformidad de la versión vigente y presentación por RCD o cliente | Justificante válido y autorización cuando corresponda; no confirmar presentación solo por un botón |
| Modelo 720 | Especificar extractor, formato y validaciones; revisión humana; carga en Criteria y presentación | Archivos y referencias reales; rechazo de resultados incompletos; carga manual permitida si se aprueba |
| Facturación y cierre | Numeración, impuestos, emisión y envío en el sistema oficial; conciliación | Distinguir emitida, enviada, cobrada y cierre; cerrar no confirma cobro por inferencia |

Para cada integración definir propietario, proveedor/sistema oficial, entorno de pruebas, autenticación, contrato de datos, timeout, idempotencia, reintentos acotados, conciliación y alternativa manual aprobada. Los callbacks/webhooks, si existen, deben verificarse y tolerar duplicados y llegada fuera de orden.

Si el extractor emplea OCR o IA, acordar qué documentos procesa, tratamiento de datos, campos, exactitud mínima evaluada con un corpus autorizado y revisión humana. El resultado no puede presentar como hechos datos ausentes ni permitir presentación automática sin validación.

La generación de PDF/XLSX debe responder al formato acordado; renombrar TXT/CSV no produce un documento válido ni un fichero importable. Si un trámite sigue siendo manual, la pantalla debe declararlo y recoger la evidencia real sin simular una integración.

## 7. Operación, calidad y soporte — P0/P1

- Separar desarrollo, pruebas, preproducción y producción, con bases y almacenamiento propios. Los tests destructivos nunca usarán datos o credenciales de producción.
- Desplegar con HTTPS, configuración del proxy/origen correcta, secretos externos al repositorio y cuenta SQL de ejecución sin permisos de migración.
- Establecer CI con tipos, unitarios, pruebas de API/integración, Playwright y build; migraciones revisadas, despliegue controlado y recuperación ante una actualización fallida.
- Supervisar disponibilidad, errores SQL, disco/capacidad, escáner, colas, envíos e integraciones. Añadir alertas con responsables y procedimientos de actuación.
- Automatizar backups coherentes de SQL y archivos, cifrarlos y probar restauraciones. Acordar continuidad, mantenimiento y recuperación antes de atender clientes.
- Validar navegación móvil, teclado, foco, etiquetas y mensajes accesibles; objetivo WCAG 2.2 AA sujeto a aprobación. Evitar que un error pierda el formulario o indique un éxito falso.
- Acordar volumen de clientes, usuarios concurrentes, tamaño documental y tiempos de respuesta; medir consultas, cargas y conflictos con datos representativos sin información personal real.
- Preparar administración de campañas, plantillas y catálogos, manuales de cliente/equipo, formación, soporte y piloto acotado.

**Objetivos no funcionales propuestos, pendientes de aprobación:** disponibilidad mensual del 99,5 %, RPO máximo de 1 hora, RTO máximo de 4 horas y p95 inferior a 2 segundos para lectura de listados/detalles bajo la carga acordada. Las subidas, descargas y operaciones externas tendrán presupuestos propios. No declarar estos objetivos cumplidos sin medición; documentar ventanas y exclusiones.

## 8. Decisiones pendientes y responsables

| Decisión antes de desarrollar | Responsable que debe aprobar |
| --- | --- |
| Invitación o registro público; verificación, representantes y vinculación a clientes | RCD negocio y responsables de identidad |
| SSO/proveedor de identidad, MFA, recuperación y duración de sesiones | RCD IT y responsables de seguridad |
| Matriz de permisos y acceso excepcional | Responsables de cada departamento y RCD IT |
| Campos de formularios, tarifas, impuestos, checklists, plazos y días hábiles/naturales | RCD negocio y responsables fiscales |
| Alcance de PH previa, evidencia de firma, PBC, certificados y autorizaciones | Socios, PBC y responsables legales |
| Qué operaciones siguen manuales y cuáles se integran; NAV, Criteria, facturación y extractor | Dueños de proceso y sistemas oficiales |
| Retención, privacidad, tratamiento por terceros y ubicación de datos | RCD legal/protección de datos e IT |
| Hosting, almacenamiento, capacidad, RPO/RTO, disponibilidad, alertas y soporte | RCD IT y operación |

Una decisión no resuelta debe figurar como bloqueo del bloque afectado; no se debe sustituir por una regla inventada ni un resultado favorable por defecto.

## 9. Orden de entrega y dependencias

1. **Acordar alcance de salida:** aprobar las decisiones de identidad, permisos, datos, reglas y trámites manuales; convertir este marco en PRDs ejecutables.
2. **P0: acceso y aislamiento:** implementar registro/activación, identidad/MFA reales, recuperación y permisos. Depende de las decisiones anteriores.
3. **P0: protección y operación:** preparar modelo/migración, archivos seguros, privacidad, auditoría, entornos, backups y monitorización. La autorización define qué datos y documentos se segregan.
4. **P1: recorrido completo real:** cerrar reglas de campaña, comunicaciones/planificador, PH/firma, validaciones y ramas Renta/720 con documentos reales. Cada integración depende de su contrato; las alternativas manuales deben quedar aprobadas y probadas.
5. **P1: aceptación y piloto:** ejecutar recorridos completos, pruebas de restauración, carga, accesibilidad y revisión de seguridad independiente; formar al equipo y obtener aprobación de salida.
6. **P2: evolución:** automatizaciones adicionales y mejoras de UX basadas en el piloto. Ningún elemento P0 ni trámite esencial se pospone a P2 para anunciar una aplicación final.

Se puede trabajar en bloques independientes en paralelo, pero no iniciar pruebas con datos reales antes de completar y aprobar P0. Este orden no obliga a automatizar NAV ni la presentación fiscal si su ejecución manual satisface el alcance acordado.

## 10. Criterios de aceptación y pruebas obligatorias

Cada entrega tendrá un fichero Playwright propio, pruebas positivas y negativas, una BD y almacenamiento aislados y evidencias reproducibles. Las pruebas de proveedores se ejecutarán en sandbox/preproducción: los dobles sirven para fallos controlados, pero no sustituyen la verificación del contrato real. Playwright no sustituye pruebas de carga, restauración, revisión legal ni revisión de seguridad.

1. **P11-CA01 — Activación:** una invitación aprobada permite activar una cuenta una sola vez; invitaciones caducadas, revocadas o reutilizadas no permiten acceder. Playwright verifica todos los casos y ausencia de acceso antes de verificar.
2. **P11-CA02 — Registro y vinculación:** introducir datos de un cliente existente no concede acceso. Playwright verifica duplicados y aprobación de vinculación; si se aprueba registro público, su recorrido no accede a expedientes hasta autorización.
3. **P11-CA03 — Identidad y MFA:** credenciales/códigos inválidos fallan, válidos permiten acceso y el desafío no abre APIs de negocio. Playwright usa cuentas de prueba reales del proveedor o sistema aprobado y comprueba caducidad y límites de intentos.
4. **P11-CA04 — Recuperación y revocación:** restablecer credenciales/MFA y dar de baja una cuenta sigue la política aprobada; tokens reutilizados y sesiones revocadas no recuperan acceso. Playwright comprueba también recarga y navegación atrás.
5. **P11-CA05 — Portal multiexpediente:** un cliente accede a sus ejercicios/servicios autorizados y un representante solo a su delegación vigente. Playwright verifica alta, revocación y segregación entre dos clientes.
6. **P11-CA06 — Autorización completa:** el cliente no accede a gestión, datos ajenos ni acciones internas cambiando rutas, IDs, cuerpos, archivos o enlaces. Playwright comprueba UI, API y SSR; el selector de rol no concede permisos.
7. **P11-CA07 — Roles internos:** cada rol y asignación respeta la matriz aprobada; reasignar/revocar elimina acceso. Playwright cubre al menos una operación permitida y una denegada por cada rol, además de las aprobaciones de socio/PBC.
8. **P11-CA08 — Datos reales:** una instalación de producción no crea casos demo ni expone reset, reloj o muestras, tampoco por API directa. Las migraciones conservan relaciones y versiones. Playwright verifica el modo final y la integridad tras actualización.
9. **P11-CA09 — Concurrencia y reinicio:** operaciones independientes no pierden datos; cambios incompatibles se resuelven sin sobrescritura silenciosa. Playwright utiliza dos sesiones y verifica persistencia tras reinicio según la topología elegida.
10. **P11-CA10 — Carga segura:** se mantienen los límites exactos de tamaño, se rechaza contenido inválido y un archivo en cuarentena/rechazado no se descarga ni valida. Playwright usa muestras de prueba autorizadas y un escáner de pruebas para estados y fallos.
11. **P11-CA11 — Entrega documental:** sustitución crea versión inmutable, entrega parcial no marca completitud y revisión profesional requiere evidencias. Playwright verifica hash, versiones, mensajes y rechazo de revisión sobre versión obsoleta.
12. **P11-CA12 — Auditoría y privacidad:** operaciones sensibles y denegaciones relevantes producen eventos con actor/correlación, sin secretos ni bytes. Playwright verifica el acceso autorizado al registro y su denegación; pruebas adicionales inspeccionan logs y políticas de conservación.
13. **P11-CA13 — Captación:** importación informa errores/duplicados; aceptación crea una sola vez el expediente correcto y negativa detiene la campaña correspondiente. Playwright comprueba reintento, asignación pendiente y separación Renta/720.
14. **P11-CA14 — Comunicaciones:** un fallo de proveedor no muestra «enviado» ni genera envíos duplicados. Playwright verifica cola, envío en sandbox, rebote/fallo, reintento y notificación dirigida al destinatario aprobado.
15. **P11-CA15 — Seguimientos:** el planificador respeta los límites aprobados de 7/3 y 3 días, no actúa antes del umbral y cancela tareas tras respuesta. Playwright controla reloj de pruebas, reinicia el worker y verifica deduplicación.
16. **P11-CA16 — PH y firma:** una PH válida usa tarifa/plantilla aprobada; solo firma de la versión enviada vigente y evidencia verificada permiten avanzar. Playwright cubre rechazo, renegociación, callback duplicado y alternativa manual si está aprobada.
17. **P11-CA17 — Validaciones y alta:** DNI, autorización, certificado, PBC y NAV conservan su independencia; pendientes y fallos bloquean solo lo definido por RCD. Playwright cubre incidencia, resolución humana y antecedentes 720 con PH previa.
18. **P11-CA18 — Renta:** se completan ambos recorridos, presentación por RCD y por cliente, con aceptación vigente, documentos y justificante real de prueba. Playwright comprueba los bloqueos y que cerrar no confirma cobro.
19. **P11-CA19 — Modelo 720:** extractor/archivo revisado, carga manual o integrada en Criteria y presentación conservan versión y evidencia. Playwright cubre fallo IT, resultado incompleto y rechazo de carga de versión obsoleta.
20. **P11-CA20 — Facturación:** la emisión usa numeración/importes aprobados y el envío/cobro procede de evidencia o sistema oficial. Playwright comprueba fallo, reintento y separación entre cierre y cobro.
21. **P11-CA21 — Fallos y recuperación:** SQL, almacenamiento, escáner y proveedores no disponibles generan errores visibles sin éxito ficticio, seed ni fallback. Playwright verifica conservación del formulario, reintento seguro y ausencia de efectos duplicados.
22. **P11-CA22 — Experiencia y accesibilidad:** recorridos de cliente y equipo funcionan con teclado y a 390 × 844 y 1440 × 900, sin desbordamiento ni pérdida de foco. Playwright comprueba medidas, formularios y avisos; revisión manual completa la accesibilidad.
23. **P11-CA23 — Operación:** un backup conjunto se restaura con documentos/hash y permisos coherentes dentro del RPO/RTO aprobado; las alertas detectan fallos. Playwright comprueba el sistema restaurado; pruebas operativas registran tiempos y carga contra objetivos aprobados.
24. **P11-CA24 — Salida:** CI, contratos reales acordados, revisión legal/de seguridad, manuales, formación y piloto tienen evidencias y aceptación de RCD. Playwright ejecuta el recorrido final de un cliente nuevo y las ramas Renta/720; ningún criterio esencial queda sustituido por una simulación.

## 11. Definición de aplicación final

La entrega puede llamarse aplicación final únicamente cuando los criterios anteriores estén cumplidos para el alcance aprobado, se hayan retirado las funciones de demostración de producción y exista aceptación de los responsables de negocio, IT y cumplimiento.

El cierre debe identificar qué integraciones son reales y qué trámites siguen siendo manuales, quién los ejecuta y dónde queda su evidencia. Tener un build correcto, SQL Server y archivos persistentes es una base técnica, no demuestra por sí solo preparación para uso con clientes reales.
