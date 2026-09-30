# PRD 04. DNI, certificados, PBC y alta manual en NAV

## Objetivo

Mostrar las validaciones y responsabilidades anteriores a la aportación documental, preservando las diferencias entre Renta y 720. Demostrar bloqueos, evaluación PBC y alta manual, sin declarar resultados reales de identidad, cumplimiento o ERP.

**Estado:** implementado y validado como mockup.

**Dependencias:** [PRD 01](01-panel-campanas-y-expedientes.md) y [PRD 03](03-propuesta-honorarios-y-firma.md).
**Salida:** [portal documental, PRD 05](05-portal-y-revision-documental.md).

## Fuentes y trazabilidad

- **R:** [Flujo Rentas v7.pdf](<../../Flujo Rentas v7.pdf>), página 1, BD1 y rama posterior a firma: «¿Se dispone de DNI válido?», solicitud/recepción, «Solicitar Alta (Navision)», «¿Filtros PBC ok?», «Alta Creada (NAV)» e «Incidencia PBC».
- **720:** [Flujo 720 v5_Global.drawio.pdf](<../../Flujo 720 v5_Global.drawio.pdf>), página 1, confirmación de firma/solicitud de alta, «Pte. Altas», filtro PBC «worldcheck», incidencia anotada por paralegal y alta creada por Altas con aviso al paralegal.
- **P:** [propuesta](<../../Propuesta de Digitalización de las Campañas de la Renta y 720.pdf>), páginas 7 y 10: DNI/certificados, control PBC y NAV como ERP oficial.
- **E:** [correo](<../../Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml>), respuesta del 3 de febrero, «Fase 2», apartado NAV: alta manual por abogado. Preguntas del 30 de enero, «Fase 2», NAV: solicitud de fichero con campos pendientes de confirmar.

## Roles

- Profesional responsable: comprobar antecedentes, solicitar DNI/alta y registrar el trámite manual en NAV.
- Cliente: aportar documento ficticio solicitado.
- Altas: intervención y confirmación del alta, explícitas en 720.
- Paralegal: registrar incidencia PBC con información del departamento y coordinar enlace documental en 720.
- Departamento PBC: evaluar incidencia y registrar resultado de demostración.
- Socio: destinatario de confirmación/solicitud de alta del 720.

El reparto de botones entre estos roles es un **supuesto de mockup**. Se conserva la intervención de Altas/paralegal del diagrama y la ejecución manual por el abogado aclarada en el correo; no se sustituye por una sincronización automática.

## Flujo

### A. Renta: DNI después de PH firmada

1. Consultar si hay DNI válido. Si sí, continuar; si no, previsualizar solicitud por correo, registrarla como simulada y marcar «Pte. DNI».
2. Cliente aporta archivo de demostración. Profesional registra recepción y revisa vigencia.
3. **Supuesto:** una fecha vencida o una revisión negativa mantiene el bloqueo y permite nueva solicitud. La mera recepción no convierte automáticamente el DNI en válido.
4. Con DNI marcado válido, solicitar alta manual en NAV/Navision.

No imponer dos caras a esta solicitud de Renta por analogía con 720: ese detalle no está escrito en la rama de Renta.

### B. Certificado y autorización

Mostrar por separado certificado digital activo/disponible y autorización de uso disponible (R, BD1; P, página 10). Exponer pendientes y fechas de demostración; no generar ni renovar certificados.

**Supuesto de mockup:** si RCD presenta Renta, certificado no disponible/vencido o autorización ausente bloquean la acción de presentación del PRD 06. No se afirma que esos faltantes bloqueen también alta NAV o revisión documental: las fuentes no definen ese bloqueo. Si presenta el cliente, no exigir a RCD usar el certificado.

La PH puede incluir una autorización; solo al simular firma de la cláusula incluida y registrar esa circunstancia se permite actualizar la autorización disponible, con evento explícito. La fuente no define cómo guardar o verificar la evidencia; es un supuesto de demostración.

### C. 720 nuevo

1. El DNI activo y sus dos caras se comprobaron al aceptar formulario en PRD 02.
2. Tras firmar PH, mostrar confirmación al socio y solicitud de alta PDF ficticia; «Pte. Altas».
3. Equipo de Altas tramita filtro PBC; el diagrama menciona WorldCheck.
4. Con resultado favorable, Altas crea el expediente NAV manualmente y confirma al paralegal. Profesional puede registrar la referencia ficticia y la confirmación del trámite.
5. Paralegal emite enlace/documentos obligatorios y marca «Alta ok-Pte doc», acciones documentales desarrolladas en PRD 05.

Si el DNI del escenario nuevo pasa a vencido antes de esta fase, mostrar necesidad de revisión, no resultado favorable automático. La vigencia como bloqueo adicional en ese momento es un **supuesto de mockup**, no una regla regulatoria extraída.

### D. PBC en ambos servicios

- **Resultado favorable:** permite confirmar alta creada.
- **Resultado desfavorable:** «Incidencia PBC» y tarea «Evaluar acciones con departamento PBC»; en 720 el paralegal registra la información de PBC.
- **Pendiente:** no mostrar alta creada ni permitir avanzar por una supuesta aprobación.
- Con incidencia, mostrar motivo, responsable y evaluación pendiente; no cerrarla ni rechazar al cliente automáticamente.
- **Supuesto de mockup:** PBC puede registrar «Continuar tras revisión» con nota, o «No continuar» con motivo. El primer resultado permite retomar alta; el segundo mantiene el caso bloqueado para decisión profesional. No es un dictamen jurídico ni determina cierre automático.

**Orden explícito distinto:** Renta solicita alta y después comprueba PBC antes de darla por creada; 720 solicita alta y Altas pasa filtros antes de crear NAV. El indicador de fases no debe sugerir que se ha creado NAV antes de un filtro favorable.

### E. Confirmación manual de alta y excepción PH previa

Registrar «Alta NAV creada (simulada)», actor, fecha y referencia ficticia. El formulario no llama al ERP; mostrar comprobación previa y confirmación deliberada.

720 con PH previa conserva la rama directa al enlace documental del PRD 02. No repetir firma/alta/PBC automáticamente. Mostrar antecedentes precargados y su origen ficticio; un dato desconocido no aparece como validado. Las fuentes no explican la comprobación del alcance de la PH previa ni cuándo rehacer controles.

### F. Exportación solicitada para NAV

La petición de un fichero aparece en E-P2; los campos se indican pendientes y E-R2 confirma alta manual sin especificar un exportador. Mostrar una nota «Exportación para NAV: campos por confirmar», sin exportación funcional ni promesa de integración. No inventar layout, obligatoriedad de campos o formato importable.

## Pantallas e interacciones de mockup

- **Validaciones:** tarjetas separadas de DNI, certificado, autorización y PBC; etiqueta de origen «Precargado», «Revisado» o «Desconocido», siempre de demostración.
- **Solicitud de DNI:** vista de correo ficticio, añadir documento de muestra y diálogo de revisión/fecha.
- **PBC:** selección de resultado simulado, motivo, historial, tarea de evaluación y resolución manual.
- **Alta:** resumen de campos disponibles, solicitud ficticia, equipo asignado, confirmación manual, referencia inventada y aviso a paralegal.
- **Bloqueos:** mensajes precisos y enlaces al requisito faltante; no un único semáforo que esconda la causa.

PrimeVue: `Card`, `Tag`, `DatePicker`, `Select`, `Textarea`, `Dialog`, `Timeline`, `Message` y `Button`.

## Estados

- DNI: desconocido, solicitado, recibido pendiente de revisión, válido o vencido/no válido. «Pte. DNI» es estado explícito del expediente Renta.
- Certificado y autorización: desconocido, disponible/activo o pendiente/no disponible; el vencimiento es dato de mockup.
- PBC: pendiente, favorable, incidencia, en evaluación, continuar tras revisión o no continuar.
- Alta: no solicitada, «Pte. Altas», registrada manualmente, «Alta ok-Pte doc».

Las subdivisiones no nombradas en las fuentes son supuestos de UI. Resolver PBC no implica que NAV esté creado; la confirmación manual sigue siendo una acción distinta.

## Criterios verificables

1. **P04-CA01:** tras firma de Renta con DNI ausente, solicitarlo crea evento y «Pte. DNI»; no se permite solicitar alta hasta revisión favorable.
2. **P04-CA02:** registrar recepción no valida el DNI automáticamente; marcar vencido mantiene bloqueo, y nueva revisión válida permite continuar.
3. **P04-CA03:** certificado y autorización muestran estados independientes; firmar PH sin cláusula de autorización no cambia su disponibilidad.
4. **P04-CA04:** resultado PBC desfavorable genera «Incidencia PBC» y tarea con motivo; no crea NAV ni da paso a un alta nueva como aprobada.
5. **P04-CA05:** resultado PBC pendiente no se trata como favorable. «Continuar tras revisión» exige nota y conserva historial anterior.
6. **P04-CA06:** confirmar NAV exige filtro favorable o resolución explícita para continuar y referencia ficticia; cancelar confirmación no cambia estado.
7. **P04-CA07:** el 720 nuevo muestra solicitud al socio/Altas, intervención manual y aviso al paralegal; el enlace documental queda como siguiente acción después de confirmación.
8. **P04-CA08:** 720 con PH previa mantiene antecedentes precargados y no ejecuta una nueva alta por entrar en el detalle.
9. **P04-CA09:** marcar certificado/autorización pendientes deja visible el bloqueo de presentación RCD, sin impedir por inferencia todo el flujo de documentos.
10. **P04-CA10:** exportación NAV informa que sus campos están pendientes; no descarga un fichero que se presente como importable.

## Límites

Datos/documentos ficticios, solo Nuxt + PrimeVue y memoria del navegador; sin BD ni backend. Sin NAV, WorldCheck, validación de identidad, consultas de cumplimiento, certificados, firma electrónica, correo ni PDF oficial. Los resultados PBC son escenarios precargados o cambios manuales de demostración, nunca controles reales.
> Estado: implementado y validado como mockup. Sin BD ni integraciones reales. Véase [evidencia y concreciones](../README.md).
