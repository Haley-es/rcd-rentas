# PRD 05. Portal del cliente y revisión documental

## Objetivo

Demostrar un ciclo documental completo: enlace individual, aportación por tipos, entrega explícita al abogado, revisión humana, solicitud de faltantes y nueva aportación. No confundir «hay archivos» o «el cliente ha terminado» con «toda la documentación está validada».

**Estado:** implementado y validado como mockup.

**Dependencias:** [PRD 01](01-panel-campanas-y-expedientes.md), [PRD 04](04-validaciones-pbc-y-alta-nav.md) para altas nuevas y [PRD 02](02-captacion-y-formularios.md) para 720 con PH previa.
**Salidas:** [Renta, PRD 06](06-renta-borrador-presentacion-y-cierre.md) y [720, PRD 07](07-modelo-720-extraccion-criteria-y-cierre.md).

## Fuentes y trazabilidad

- **R:** [Flujo Rentas v7.pdf](<../../Flujo Rentas v7.pdf>), página 1, enlace a nube/documentos obligatorios, selección de tipo, subida, aviso al responsable, «¿Faltan docs?» y recordatorio.
- **720:** [Flujo 720 v5_Global.drawio.pdf](<../../Flujo 720 v5_Global.drawio.pdf>), página 1, enlace emitido por paralegal, «Alta ok-Pte doc», subida/aviso/faltantes y rama desde PH previa al envío de enlace.
- **P:** [propuesta](<../../Propuesta de Digitalización de las Campañas de la Renta y 720.pdf>), páginas 7, 10-11 y 13-14: portal sin autenticación, enlace único, revisión de imágenes/PDF/Word/Excel y carpeta SharePoint asociada al expediente.
- **E:** [correo](<../../Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml>), preguntas del 30 de enero, «Fase 2», recopilación documental: aviso al abogado con enlace; respuesta del 3 de febrero, mismo apartado: botón para que el cliente envíe documentos al abogado, porque la completitud no se determina automáticamente.

## Roles

- Paralegal: emitir enlace/documentos obligatorios en 720 y registrar el estado documental.
- Profesional responsable: definir/revisar requisitos, aceptar documentos o solicitar faltantes.
- Cliente: añadir muestras, revisar lo aportado y enviarlo expresamente.
- Sistema simulado: registrar subida, entrega y recordatorios; no analizar contenidos.

## Flujo

### 1. Preparar y enviar enlace

Alta nueva confirmada: profesional/paralegal previsualiza correo con enlace local individual y lista de requisitos. 720 con PH previa entra aquí sin rehacer captación/firma. En 720 registrar «Alta ok-Pte doc» cuando corresponda a alta nueva; no inventar una alta nueva en la rama PH previa.

**Supuesto de mockup:** ruta/token ficticio por expediente y controles de «enlace válido», «inválido» y «expirado» para demostrar pantallas. No se ha especificado caducidad real ni sistema de tokens. El portal carece de login, pero eso no autoriza mostrar casos ajenos o la bandeja interna.

### 2. Aportar por tipo

Cliente ve servicio, ejercicio, instrucciones, lista de documentos esperados y estado de cada uno. Puede añadir archivos ficticios de imagen, PDF, Word o Excel, indicar tipo y abrir una previsualización de demostración.

**Explícito:** tipos de archivo y clasificación por tipo de documento.
**Pendiente:** inventario documental exacto de cada tipo de renta/720, límites de tamaño, número de archivos y reglas de obligatoriedad.

**Supuestos iniciales:**

- Catálogos visibles como ilustrativos: «Datos fiscales» y «Documentación adicional» para Renta; «Certificado de entidad extranjera» y «Documentación adicional» para 720. No son un checklist fiscal aprobado.
- Profesional puede marcar requisitos ficticios como obligatorios y añadir una solicitud manual.
- Para demostrar validación de selección, permitir `.png`, `.jpg`, `.jpeg`, `.pdf`, `.doc`, `.docx`, `.xls` y `.xlsx`, con máximo **10 MB por archivo**, etiqueta de límite de demostración.
- Elegir primero muestras precargadas. Si se representa selector local, conservar solo metadatos de archivos expresamente ficticios; no transmitir ni leer contenido de documentos reales.
- Subida repetida del mismo archivo/tipo muestra aviso y ofrece nueva versión; no duplica silenciosamente.

### 3. Entrega explícita y avisos

Cada aportación actualiza historial interno de nueva subida, como en los diagramas. El botón «Enviar documentación al abogado» crea además un evento de entrega y una notificación destacada con enlace al expediente.

**Supuesto:** no se permite una entrega vacía; sí se puede enviar un conjunto parcial si el cliente aún no dispone de todos los documentos. Avisar «La revisión puede solicitar más documentación». Enviar no valida la completitud.

Cliente puede añadir nuevas muestras tras una entrega. El estado muestra que hay cambios todavía no reenviados; otra entrega avisa solo de la nueva tanda y no borra revisiones anteriores.

### 4. Revisión y faltantes

Profesional revisa archivos y requisitos. Por documento: aceptar para el mockup o solicitar sustitución con motivo. Por expediente:

- Si faltan documentos o existen rechazos, marcar incompleto y emitir solicitud/recordatorio que identifique los elementos pendientes.
- Cliente consulta faltantes, aporta nueva versión y vuelve a enviar.
- Si todo lo requerido para el escenario está revisado, profesional marca «Documentación validada» de forma manual.
- Solo esa decisión humana habilita elaboración de borrador Renta o activación del agente 720.

Una nueva versión de un documento ya validado lo devuelve a revisión. **Supuesto de mockup:** si cambia después de validar el conjunto, el conjunto vuelve a revisión y se advierte que una preparación ya iniciada puede requerir actualización; no se elimina una presentación histórica.

### 5. Recordatorios documentales

Los diagramas exigen recordatorio cuando faltan documentos, sin especificar intervalo ni número. P incluye recordatorios automáticos; E aclara que después de aceptación pertenecen al expediente.

Ofrecer envío manual simulado y evaluación por reloj de demostración con plazo configurable, inicialmente **3 días por supuesto**, no como plazo documentado. Cada aviso incluye lista actual de faltantes. Evitar duplicados del mismo vencimiento; suspender seguimiento cuando el profesional valida documentación.

## Pantallas e interacciones de mockup

- **Portal:** resumen del caso, lista de requisitos, selector de muestra/tipo, previsualización, etiquetas de revisión y botón de entrega.
- **Confirmación de entrega:** fecha local y mensaje «Enviado para revisión», no «Documentación completa» automático.
- **Enlace no válido/expirado:** información neutra, sin nombre ni documentos del cliente, con indicación de solicitar enlace de demostración.
- **Bandeja profesional:** aviso de nueva subida y aviso de entrega con acceso al caso.
- **Revisión interna:** tabla de requisitos/archivos/versiones, aceptar, solicitar sustitución, añadir faltante y validación manual del conjunto.
- **Solicitud de faltantes:** previsualizar mensaje ficticio, destinatario, lista concreta y siguiente revisión.

PrimeVue: `DataTable`, `Select`, `Dialog`, `Tag`, `Message`, `Button`, `Timeline` y, si corresponde, `FileUpload` sin transporte ni lectura de contenido real.

## Estados

Expediente documental: pendiente de aportación, aportación parcial, enviado para revisión, incompleto/faltantes, validado y nuevos cambios pendientes de revisión.

Documento: no aportado, aportado, en revisión, aceptado, sustitución solicitada o versión sustituida. Un documento obligatorio puede tener varias versiones, pero solo una vigente.

Las subdivisiones son **supuestos de UI**. «Alta ok-Pte doc» conserva su literal en 720. «Enviado para revisión» no implica completo; archivo presente no implica aceptado.

## Criterios verificables

1. **P05-CA01:** alta nueva y 720 con PH previa pueden previsualizar enlace/requisitos; este último no genera PH ni alta nuevas.
2. **P05-CA02:** cada enlace válido abre solo su caso; inválido/expirado no muestra datos personales ni permite aportar.
3. **P05-CA03:** muestra sin tipo, extensión no admitida o tamaño superior a 10 MB produce error visible y no se añade como aceptada.
4. **P05-CA04:** añadir una muestra crea evento de subida, pero no marca documentación completa ni inicia preparación.
5. **P05-CA05:** entregar una tanda crea una notificación con enlace al responsable y «Enviado para revisión». Una tanda parcial sigue siendo revisable; una vacía queda bloqueada.
6. **P05-CA06:** rechazar un documento exige motivo; cliente ve la solicitud y puede aportar sustitución sin borrar el historial.
7. **P05-CA07:** si queda un requisito obligatorio no aceptado, no se habilita validación del conjunto y se explica cuál falta.
8. **P05-CA08:** aceptar todos los requisitos del escenario y validar manualmente habilita el slice fiscal correspondiente, nunca el otro servicio.
9. **P05-CA09:** sustituir un documento validado devuelve documento/conjunto a revisión y muestra advertencia sobre preparación existente; no borra registros de presentación.
10. **P05-CA10:** recordatorio incluye faltantes actuales; reevaluar el mismo vencimiento no duplica; la validación manual detiene nuevos recordatorios.
11. **P05-CA11:** vista cliente no expone notas PBC, referencia de otro cliente ni incidencias IT; todas las cargas y notificaciones son locales.

## Límites

Nuxt + PrimeVue, muestras y metadatos ficticios en memoria; sin BD/backend, almacenamiento real, SharePoint, Power Pages, correo o enlaces productivos. No subir los PDF/EML fuente ni documentos personales. No OCR, clasificación inteligente, antivirus, cifrado certificado ni determinación fiscal automática de completitud. El portal simulado no demuestra seguridad de acceso anónimo de producción.
> Estado: implementado y validado como mockup. Sin BD ni integraciones reales. Véase [evidencia y concreciones](../README.md).
