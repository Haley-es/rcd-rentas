# PRD 07. Modelo 720: extracción, Excel, Criteria y cierre

## Objetivo

Demostrar la elaboración asistida del 720 después de revisión documental: activación por profesional, salida Excel ficticia, revisión humana y corrección de desviaciones mediante IT. Continuar mediante registro de carga manual en Criteria, presentación, justificante y factura; no simular una integración automática que el correo excluye.

**Estado:** implementado y validado como mockup.
**Dependencias:** [PRD 01](01-panel-campanas-y-expedientes.md) y [PRD 05](05-portal-y-revision-documental.md). [PRD 04](04-validaciones-pbc-y-alta-nav.md) aporta antecedentes de altas nuevas; la ruta PH previa conserva su entrada específica.

## Fuentes y trazabilidad

- **720:** [Flujo 720 v5_Global.drawio.pdf](<../../Flujo 720 v5_Global.drawio.pdf>), página 1, «Profesional Activa Automatismo Calculo 720», «Agente Crea Excel "Genera"», revisión/«¿Excel OK?», aviso IT/ajuste, subida Criteria, presentación en Hacienda, justificante y factura.
- **P:** [propuesta](<../../Propuesta de Digitalización de las Campañas de la Renta y 720.pdf>), páginas 7 y 10: soluciones de IA, elaboración del Excel Criteria y presentación/cierre.
- **E:** [correo](<../../Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml>), preguntas del 30 de enero, «Fase 2», integración Criteria: Copilot, Excel, validación y desviaciones IT. Respuesta del 3 de febrero, «Fase 2», apartados Criteria/agente: generación de fichero revisable, errores del extractor fuera del ciclo del expediente y carga manual por abogado, no automática.

**Resolución explícita:** «Subir Excel en Criteria (Automático)» del diagrama y la petición del correo no se implementan como automatismo. La respuesta confirma carga **manual**. El agente se representa como extractor simulado, no como cálculo fiscal ni llamada a Copilot.

## Roles

- Profesional responsable: activar extracción, revisar/validar el Excel, informar desviaciones, cargar manualmente en Criteria y registrar presentación.
- IT: recibir y gestionar incidencias técnicas en una bandeja separada.
- Cliente: consultar progreso y documentos/avisos finales ficticios, sin validar el Excel en nombre del profesional.
- Rol administrativo de demostración: registrar factura/minuta y envío. El actor exacto de facturación no está especificado.
- Sistema simulado: generar resultados precargados y registrar tareas/avisos.

## Flujo

### 1. Comprobar entrada y activar

Requiere documentación validada por profesional. En alta nueva, antecedentes PH/PBC/NAV deben estar completados según los slices previos; PH previa utiliza los antecedentes importados del escenario, sin repetir firma o alta.

Mostrar documentos vigentes que forman la entrada. Profesional pulsa «Simular extracción 720». No se activa solo por subir archivos.

**Supuesto:** estados de ejecución local «Pendiente», «En curso», «Resultado disponible» o «Error técnico», seleccionables por escenario y sin espera prolongada real. Evitar doble ejecución mientras una está en curso. Registrar versión de documentos de entrada para demostrar trazabilidad.

### 2. Resultado Excel ficticio

Mostrar un artefacto llamado, por ejemplo, `Genera-DEMO-72008-v1.xlsx`, claramente marcado «Representación ficticia; no fichero fiscal». La entrega mínima es metadatos y una tabla de previsualización; no generar un XLSX real ni fingir una descarga de un archivo inválido.

**Explícito:** agente genera fichero, abogado revisa y valida.
**Pendiente:** schema, columnas, reglas de extracción, cálculo, formato importable, umbrales y system prompt. El correo menciona un prompt facilitado, pero su contenido no está en las cuatro fuentes.

**Supuesto de mockup:** columnas ilustrativas «Documento origen», «Entidad», «País», «Tipo de bien», «Valor ficticio» y «Observación», con dos o tres filas inventadas. Identificar cada fila con una muestra documental, sin extracción real.

### 3. Revisión del profesional

- Abrir vista de filas y origen; marcar observaciones.
- «Validar Excel»: confirmar revisión de la versión vigente. No valida el impuesto ni la conformidad con Criteria real.
- «Detectar desviación»: descripción y documento/fila afectados; marcar resultado «Con observaciones/no validado», crear incidencia IT y bloquear carga Criteria.
- El profesional no puede presentar un resultado pendiente de revisión o con observaciones como validado.

**Supuesto:** revisión y estado se mantienen por versión. Tras regenerar, la versión nueva queda pendiente de nueva revisión, no hereda la validación anterior.

### 4. Errores fuera del ciclo del expediente

Hay dos escenarios distinguibles:

1. **Error de ejecución del extractor:** no existe resultado utilizable; mensaje técnico de demostración y opción de informar IT.
2. **Resultado generado con desviaciones:** sí existe tabla, pero el profesional señala errores y abre incidencia.

La incidencia vive en bandeja IT con referencia al expediente, ejecución, versión y observación. El expediente permanece en fase «Preparación 720», con bloqueo visible del artefacto; no añadir una etapa fiscal «Resolver IT» ni cambiar a «Incidencia PBC».

IT registra «Ajuste de demostración disponible» con comentario; profesional puede reintentar explícitamente. El reintento crea nueva ejecución/versión usando otro resultado precargado. No se ajusta un prompt ni se llama a IA.

**Supuesto:** estados de incidencia abierta, en revisión y ajuste disponible; el resultado anterior conserva sus errores para auditoría. Resolver incidencia no valida Excel automáticamente.

### 5. Carga manual en Criteria

Con versión de Excel validada, mostrar instrucciones de intervención manual y botón «Registrar carga manual en Criteria (simulada)».

Diálogo con versión usada, fecha, referencia ficticia y confirmación del profesional. Cancelar no registra carga. No usar botón «Enviar automáticamente» ni una petición de red.

**Supuesto:** si cambia la versión/documentación antes de presentar, la carga anterior sigue en historial, pero deja de representar la versión vigente; exigir nueva revisión y registro manual para continuar. No borrar una presentación ya registrada.

### 6. Presentación y cierre

1. Tras registrar carga manual de la versión vigente, habilitar «Registrar presentación 720 (simulada)».
2. Registrar fecha, referencia ficticia y muestra de justificante. La fuente describe presentar desde Criteria en Hacienda; aquí solo se refleja el trabajo manual y su constancia, no se ejecuta.
3. Previsualizar/enviar justificante ficticio al cliente y registrar evento.
4. Registrar factura/minuta y envío ficticios; no emitir factura real ni marcar cobro.
5. Cerrar operativamente con presentación registrada, justificante enviado y factura enviada.

**Supuestos de mockup:** campos obligatorios de evidencias, confirmación de cierre y bloqueo hasta completar las tres acciones. El recorrido fuente sí exige presentación, justificante y factura.

No añadir la rama «cliente presenta» de Renta al 720: no está en el diagrama.

## Pantallas e interacciones de mockup

- **Preparación 720:** documentos vigentes, botón de activación, estado/resultado de ejecución y mensaje de error local.
- **Excel:** tabla ficticia, origen de filas, observaciones, historial de versiones y validación manual.
- **Incidencia IT:** diálogo de creación y bandeja aparte; descripción, versión, estado, respuesta y enlace al expediente.
- **Criteria:** instrucciones de operación externa manual y diálogo de registro ficticio, sin abrir un servicio real.
- **Presentación/factura:** muestras, referencias inventadas, eventos de envío y condiciones de cierre.
- **Portal cliente:** estado comprensible y justificante/factura ficticios, sin detalles técnicos IT o filas internas.

PrimeVue: `DataTable`, `Tabs`, `Dialog`, `Textarea`, `DatePicker`, `Tag`, `Message`, `Timeline` y `Button`.

## Estados

- Expediente: preparación 720, listo para registro Criteria, carga manual registrada, presentación registrada, pendiente de justificante/factura y cerrado.
- Ejecución: pendiente, en curso, resultado disponible o error técnico.
- Excel: no generado, pendiente de revisión, con observaciones, validado o sustituido.
- Incidencia IT: abierta, en revisión o ajuste disponible.
- Carga Criteria: no registrada, registrada para una versión o desactualizada por nueva versión.

Las etiquetas no literales son **supuestos de UI**. Un error de extracción queda fuera del estado de negocio del expediente, pero su bloqueo no se oculta. «Excel validado» no significa «Criteria cargado» ni «Impuesto presentado».

## Criterios verificables

1. **P07-CA01:** documentos pendientes de revisión impiden extracción con causa visible; documentos validados habilitan activación manual y no la disparan automáticamente.
2. **P07-CA02:** activar genera una ejecución local asociada a los documentos/versiones del escenario; doble clic en curso no duplica ejecución.
3. **P07-CA03:** resultado disponible muestra artefacto y filas ficticias con origen; ningún botón afirma haber generado o descargado un XLSX real.
4. **P07-CA04:** desviación requiere descripción, crea incidencia IT y bloquea Criteria; el expediente sigue en preparación 720 y no cambia a incidencia PBC.
5. **P07-CA05:** error técnico muestra ausencia de resultado válido y permite informar IT, sin resultado vacío presentado como éxito.
6. **P07-CA06:** ajuste IT no valida datos; reintentar crea nueva versión pendiente de revisión y conserva historial anterior.
7. **P07-CA07:** validar la versión vigente habilita registro manual Criteria, pero no lo ejecuta; cancelar diálogo no genera registro.
8. **P07-CA08:** carga manual exige fecha, versión y referencia ficticia; se registra como actividad del profesional, sin llamada externa.
9. **P07-CA09:** nueva versión antes de presentación invalida continuidad de la carga anterior para la versión vigente; exige revisión/carga nuevas sin borrar historial.
10. **P07-CA10:** presentación solo se habilita tras carga manual vigente; exige fecha/referencia/justificante ficticios y queda registrada una vez.
11. **P07-CA11:** cierre está bloqueado hasta presentación, envío de justificante y envío de factura; cumplirlos cierra, sin marcar factura pagada.
12. **P07-CA12:** cliente no ve bandeja IT ni puede validar Excel; no aparece una rama de autopresentación como la de Renta.
13. **P07-CA13:** completar el recorrido PH previa/documentación/Excel/carga manual/presentación es posible sin crear nueva PH ni nueva alta.

## Pendientes y límites

No se dispone del prompt, formato Excel «Genera», mapping Criteria, reglas de cálculo 720, procedimiento técnico de corrección ni reglas de revisión fiscal definitiva. La UI debe señalar su carácter pendiente y no proponerlos como requisitos aprobados.

Solo Nuxt + PrimeVue, datos y artefactos ficticios en memoria; sin BD/backend, Copilot, IA, lectura/extracción de documentos, Criteria, Hacienda, NAV, correo, Excel operativo, facturación ni cobro real. No enviar documentos a terceros ni usar los originales como muestras. Las tablas y confirmaciones no tienen validez fiscal.
> Estado: implementado y validado como mockup. Sin BD ni integraciones reales. Véase [evidencia y concreciones](../README.md).
