# PRD 01. Panel de campañas y expedientes

## Objetivo

Crear la base navegable del mockup Nuxt + PrimeVue: distinguir campañas de comunicación, expedientes internos y portal del cliente, manteniendo una visión común de los datos y del historial. Este slice debe permitir localizar un caso, identificar su responsable y conocer el siguiente paso sin implementar todavía las operaciones de los demás slices.

**Estado:** implementado y validado como mockup.

**Dependencias:** ninguna.
**Entrega:** exclusivamente mockup; los siete PRDs permanecen en `todo`.

## Fuentes y trazabilidad

Los números de página se refieren a la posición física dentro del PDF, no a sus pies de página.

- **R:** [Flujo Rentas v7.pdf](<../../Flujo Rentas v7.pdf>), página 1. Diagrama completo; bloque «BD1 (Control campaña)» y cambios de estado.
- **720:** [Flujo 720 v5_Global.drawio.pdf](<../../Flujo 720 v5_Global.drawio.pdf>), página 1. Diagrama completo; listado de clientes, PH existente, responsables, paralegal, Altas, PBC y elaboración.
- **P:** [Propuesta de Digitalización de las Campañas de la Renta y 720.pdf](<../../Propuesta de Digitalización de las Campañas de la Renta y 720.pdf>), páginas 4, 6-7 y 9-17. Objetivos, fases funcionales y tres superficies: comunicación, gestión interna y portal.
- **E:** [Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml](<../../Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml>). Solo conversación del cuerpo; adjuntos duplicados excluidos.
  - **E-R1:** respuesta principal de Marc Jordana, 3 de febrero de 2026, «Fase 1: Notificación y aceptación». Carga de clientes, recordatorios, separación entre Customer Insights y gestión de expedientes, datos compartidos.
  - **E-R2:** misma respuesta, «Fase 2: Gestión del expediente». Notificación opcional por Teams, revisión/envío manual de PH, alta manual en NAV, envío documental explícito y aclaraciones sobre el agente y Criteria.
  - **E-P1 / E-P2:** preguntas de Vanessa Fojo, 30 de enero de 2026, fases 1 y 2. Revisión del socio, renegociación y petición de exportación NAV con campos todavía pendientes.
  - **E-O:** mensaje original de Marc Málaga, 19 de enero de 2026. La propuesta se enviaba pendiente de incorporar los diagramas.

### Naturaleza de los requisitos

- **Explícito:** comportamiento descrito directamente en un diagrama, propuesta o respuesta del correo.
- **Supuesto de mockup:** decisión de UI, datos de ejemplo o regla necesaria para demostrar el recorrido; no constituye una regla fiscal o un acuerdo de producción.
- **Pendiente:** cuestión que las fuentes no resuelven. Se muestra como tal; no se implementa una respuesta real por inferencia.

Las aclaraciones de E-R2 resuelven conflictos concretos sobre PH, aportación documental, NAV, agente y Criteria. No se aplica una precedencia general que borre diferencias entre los diagramas de Renta y 720.

## Inventario y orden de slices

1. [PRD 01: panel y expediente común](01-panel-campanas-y-expedientes.md): navegación, roles de demostración, datos e historial.
2. [PRD 02: captación y formularios](02-captacion-y-formularios.md): segmentación, correos, respuesta, recordatorios y apertura de expediente.
3. [PRD 03: PH y firma](03-propuesta-honorarios-y-firma.md): generación, revisión del socio, envío manual, firma y renegociación.
4. [PRD 04: validaciones y altas](04-validaciones-pbc-y-alta-nav.md): DNI, certificado, autorización, PBC y alta manual en NAV.
5. [PRD 05: portal documental](05-portal-y-revision-documental.md): aportación, envío explícito al abogado, revisión y faltantes.
6. [PRD 06: Renta](06-renta-borrador-presentacion-y-cierre.md): borrador, revisiones, presentación por RCD o cliente, factura y cierre.
7. [PRD 07: Modelo 720](07-modelo-720-extraccion-criteria-y-cierre.md): agente simulado, Excel, incidencias IT, carga manual en Criteria, presentación y cierre.

Orden recomendado: 01, 02, 03, 04, 05; después 06 y 07. La ruta 720 con PH previa usa 01 y 05 directamente. Cada slice puede demostrarse con casos ficticios ya situados en su estado de entrada, sin desarrollar anticipadamente los slices posteriores.

## Roles

**Explícitos:** cliente; profesional/abogado responsable; socio responsable; paralegal; equipo de Altas; departamento PBC; IT. La gestión de campañas/comunicaciones y el equipo de Marketing aparecen en P, páginas 9 y 16.

**Supuesto de mockup:** selector de rol, sin login ni permisos reales:

- Gestor de campañas: listas, segmentos, comunicaciones y seguimiento anterior a la aceptación.
- Profesional responsable: expediente, envío de PH revisada, revisión documental y preparación/presentación.
- Socio: validación, modificación y renegociación de PH.
- Paralegal y Altas: coordinación documental, incidencias PBC y registro de alta.
- PBC: evaluación y resolución simulada de incidencias.
- IT: bandeja de desviaciones del extractor 720, separada del flujo fiscal.
- Cliente: únicamente sus formularios, PH, documentos y borrador de demostración.

La matriz de acciones por rol es una decisión de demostración, no un modelo de autorización aprobado. El portal no muestra observaciones internas PBC, incidencias IT ni otros clientes.

## Flujo

1. Elegir campaña ficticia de Renta o 720 y ejercicio.
2. Consultar contactos y estado de captación; un contacto todavía no interesado no tiene por qué tener expediente.
3. Tras aceptación, consultar el expediente creado y sus datos compartidos, no una copia desconectada de la campaña.
4. Abrir una fase o una tarea pendiente; mostrar qué actor debe actuar y por qué existe un bloqueo.
5. Consultar cronología de comunicaciones, versiones, decisiones y cambios.
6. Abrir la vista del cliente de ese caso sin acceder a las demás vistas internas.

**Explícito:** separación de herramientas de campaña y expediente con un modelo de datos compartido (E-R1).
**Supuesto de mockup:** un solo identificador de expediente por cliente, campaña, servicio y ejercicio; aceptar dos veces no crea dos expedientes.

## Pantallas e interacciones de mockup

- **Panel:** tarjetas de Renta y 720; contadores derivados de los casos cargados; selector de campaña/ejercicio.
- **Contactos de campaña:** tabla con nombre ficticio, contacto, responsable, respuesta, último aviso y próximo hito. Acceso al expediente solo cuando exista.
- **Expedientes:** tabla filtrable por servicio, fase, estado, responsable y bloqueos. Búsqueda y ordenación locales; estado vacío explícito.
- **Detalle:** cabecera, responsable, fase actual, siguiente acción, pestañas de datos, PH, validaciones, documentos, preparación, presentación/factura e historial.
- **Bandeja de tareas y avisos:** distinguir destinatario, motivo, expediente, acción manual o evento simulado y fecha.
- **Controles de demostración:** selector de rol, apertura del portal del caso y «Restablecer demostración» con confirmación.

PrimeVue: `DataTable`, `Select`, `Tag`, `Tabs`, `Timeline`, `Dialog`, `Message` y `Toast`, o equivalentes de la versión instalada. Las rutas y nombres técnicos concretos no están fijados por las fuentes.

## Datos y estados

### Datos compartidos

**Explícitos en R, bloque BD1:** contacto; estado; DNI válido; certificado digital activo; autorización de uso del certificado; responsable; respuestas del formulario; tipo de renta; quién presenta; fee y tipo de PH.

**Explícitos adicionales:** PH previa en 720; firma; resultado PBC; alta NAV; documentación; borrador Renta; Excel 720; presentación, justificante y factura.

**Supuestos de mockup:** identificadores ficticios, ejercicio, fechas de eventos, referencia NAV ficticia, versiones de documentos y autor de cada acción. Un mismo cliente puede tener Renta y 720; sus avances no se contaminan.

### Estados separados, no una única etiqueta para todo

- **Captación:** pendiente de contacto, «Enviado Correo 1», «Enviado Correo 2», respuesta afirmativa, «No interesado», «Pte. Llamada Resp.». Estos últimos literales aparecen en los diagramas; las etiquetas de entrada/aceptación son de UI.
- **Expediente:** PH en revisión, «Pte. Firma PH», «PH firmada», «Pte. DNI», «Pte. Altas», «Incidencia PBC», «Alta ok-Pte doc», revisión documental, preparación, presentación y cierre.
- **Artefactos:** PH por versión, documentos por revisión, borrador por versión, Excel por revisión, justificante y factura por disponibilidad/envío.

Las etiquetas operativas que los diagramas no nombran se definen en cada slice como supuestos. Una PH rechazada para renegociar no equivale a una negativa definitiva a contratar. Una incidencia técnica del extractor no cambia el expediente a «Incidencia PBC».

### Cronología

Cada transición o comunicación simulada registra caso, campaña, rol, instante de demostración, acción, estado anterior/nuevo y motivo cuando corresponda. Un aviso de éxito nunca representa una conexión real. Operaciones canceladas, bloqueadas o fallidas no añaden un evento de éxito.

### Casos mínimos para la demostración

Preparar al menos estos 18 escenarios ficticios, con nombres y contactos inventados:

- Renta: `DEMO-R01` sin respuesta inicial; `R02` sin respuesta al segundo correo; `R03` negativa; `R04` PH firmada y DNI vencido; `R05` certificado sin autorización; `R06` incidencia PBC; `R07` faltantes documentales; `R08` revisión de borrador y presentación RCD; `R09` presentación por cliente.
- 720: `DEMO-72001` sin PH, formulario/DNI incompletos; `72002` PH previa y acceso documental; `72003` revisión de PH por socio; `72004` PH rechazada en renegociación; `72005` pendiente de alta/PBC; `72006` documentos incompletos; `72007` Excel con errores; `72008` Excel validado pendiente de carga manual en Criteria; `72009` presentación registrada y factura pendiente.

Los identificadores abreviados mantienen su prefijo de servicio. Pueden añadirse casos para estados intermedios; no se usan datos de las fuentes como datos de clientes.

## Criterios verificables

1. **P01-CA01:** existen accesos separados a campañas, expedientes y portal; cambiar de superficie conserva el mismo caso y servicio.
2. **P01-CA02:** al filtrar por responsable, servicio o estado, tabla y contadores muestran exactamente los casos que cumplen el filtro; el filtro sin resultados muestra un estado vacío.
3. **P01-CA03:** aceptar dos veces el mismo caso conserva un único expediente; aceptar otro servicio genera un expediente distinto.
4. **P01-CA04:** toda acción habilitada cambia únicamente el caso seleccionado y genera un evento; toda acción bloqueada explica la causa sin alterar el estado.
5. **P01-CA05:** cambiar al rol cliente oculta notas internas, otros expedientes y las bandejas PBC/IT.
6. **P01-CA06:** los 18 escenarios pueden localizarse y abrirse; las fases aún no implementadas muestran información o «pendiente», nunca éxito inventado.
7. **P01-CA07:** cancelar el restablecimiento no modifica nada; confirmarlo recupera exactamente los datos y estados iniciales.
8. **P01-CA08:** los estados, responsables e historial coinciden en listado, detalle, bandeja y portal cuando esa información sea visible al cliente.

## Cobertura de las fuentes y decisiones importantes

- R, página 1: carga/correos/respuestas/esperas y llamadas, PRD 02; formulario/fee/PH/firma, 02-03; DNI/certificado/autorización/PBC/NAV, 04; nube/avisos/faltantes, 05; borrador/revisión/acuerdo/presentador/justificante/factura, 06.
- 720, página 1: listado con o sin PH, captación y llamadas, 02; DNI en formulario y PH/socio/firma, 02-03; confirmación al socio/Altas/PBC/NAV/paralegal, 03-04; rama PH previa al enlace documental y resto de documentos, 02 y 05; agente/Excel/IT/Criteria/Hacienda/justificante/factura, 07.
- P, páginas 9-11: las tres fases funcionales quedan representadas; páginas 6-7 y 13-17 aportan trazabilidad, roles y contexto tecnológico, no obligan a usar Microsoft en el mockup.
- E-R1 y E-R2: revisión y envío manual de PH, envío explícito de documentos, NAV manual, extractor supervisado y Criteria manual se desarrollan en 02-07. E-P2 contiene peticiones no todas aceptadas.
- P, páginas 1-5, 8, 12, 18-19 y 20-32: portada/índice, contexto, planificación, costes y material comercial. No originan pantallas de facturación comercial del proyecto, gestión de licencias ni despliegue Microsoft. La referencia a «Nieves Energía» de página 25 es material comercial incongruente, no requisito de RCD. El índice menciona un benchmark, pero no se extraen requisitos de un anexo no desarrollado en estas 32 páginas.

## Límites

Solo Nuxt + PrimeVue, datos ficticios y estado en memoria del navegador; recargar puede restablecer la demostración y debe indicarse. Sin BD, backend, autenticación real ni integraciones con Dynamics, Customer Insights, Dataverse, Power Apps, Power Pages, SharePoint, Signaturit, Teams, NAV/Navision, WorldCheck, Copilot, Criteria o Hacienda.

Todos los avisos, firmas, altas, resultados fiscales y archivos son simulados. Sin correos reales, llamadas, OCR, cálculos tributarios ni ficheros oficiales. No copiar nombres/contactos de la conversación ni cargar los documentos originales en la aplicación. La identidad visual y la accesibilidad del mockup no implican seguridad o cumplimiento de producción.
> Estado: implementado y validado como mockup. Sin BD ni integraciones reales. Véase [evidencia y concreciones](../README.md).
