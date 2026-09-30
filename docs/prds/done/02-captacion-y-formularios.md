# PRD 02. Captación, recordatorios y formularios

## Objetivo

Demostrar el paso de una lista de clientes a una aceptación o negativa trazable, con todos los recordatorios y contactos de los diagramas. Abrir el expediente correcto de Renta o 720 al aceptar, sin confundir la gestión de comunicación con el trabajo del abogado.

**Estado:** implementado y validado como mockup.

**Dependencia:** [PRD 01](01-panel-campanas-y-expedientes.md).
**Salidas:** [PH, PRD 03](03-propuesta-honorarios-y-firma.md); para 720 con PH previa, [portal, PRD 05](05-portal-y-revision-documental.md).

## Fuentes y trazabilidad

- **R:** [Flujo Rentas v7.pdf](<../../Flujo Rentas v7.pdf>), página 1, desde «Carga Datos Contacto Clientes» hasta formulario, aceptación de envío de PH y llamadas tras 7/3 días; bloque BD1.
- **720:** [Flujo 720 v5_Global.drawio.pdf](<../../Flujo 720 v5_Global.drawio.pdf>), página 1, «Crear Listado Clientes indicando si PH», decisión «¿Tiene PH?», formulario obligatorio/DNI y captación. La rama «SI» de PH previa termina en el envío del enlace y documentos obligatorios, no en un nuevo envío de PH.
- **P:** [Propuesta de Digitalización de las Campañas de la Renta y 720.pdf](<../../Propuesta de Digitalización de las Campañas de la Renta y 720.pdf>), páginas 7, 9 y 14: campañas segmentadas, enlace al formulario, recordatorios configurables y expediente automático tras respuesta afirmativa.
- **E:** [correo de aclaraciones](<../../Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml>), respuesta de Marc Jordana, 3 de febrero, «Fase 1»: importación de clientes y separación entre comunicación y expediente; «Fase 2», primer punto: aviso opcional por Teams y relación cliente-abogado necesaria. Preguntas del 30 de enero, «Fase 1»: todos los recordatorios deben estar cubiertos.

## Roles

- Gestor de campañas: preparar lista, segmentar y revisar seguimiento.
- Cliente: responder y cumplimentar el formulario.
- Profesional responsable: recibir tarea de llamada y registrar resultado; gestionar el expediente desde la aceptación.
- Sistema simulado: representar envíos, esperas, avisos y creación del expediente.

## Flujo

### 1. Preparación

1. Cargar una lista de demostración o previsualizar una importación ficticia. R y 720 parten de contactos; 720 incorpora además si existe PH.
2. Mostrar nombre/contacto, servicio, ejercicio, responsable, PH previa y estado.
3. Segmentar por servicio/responsable y, en 720, PH previa. El criterio exacto de segmentación es un **supuesto de mockup**, no una regla comercial aprobada.
4. Revisar destinatarios y enviar el correo inicial simulado a quienes deban pasar por captación.

E permite conexión al origen o carga Excel para producción. Aquí ambas se representan con datos precargados, sin lectura del origen ni importación real.

### 2. Respuesta, espera y llamada

- Correo inicial simulado: estado «Enviado Correo 1».
- Negativa en respuesta digital: agradecimiento y contacto para dudas; estado «No interesado». Se cancela el seguimiento automático del servicio/campaña, no otras campañas del cliente.
- Afirmativa: formulario y aceptación del envío de PH; el expediente pasa a gestión interna.
- Sin respuesta durante **7 días**: un recordatorio del correo inicial y estado «Enviado Correo 2».
- Sin respuesta durante **3 días después del segundo correo**: llamada al cliente. En 720 son explícitos el aviso automático al responsable y «Pte. Llamada Resp.»; en Renta la llamada es explícita, pero reutilizar esa etiqueta/aviso es un **supuesto de UI**.
- Llamada con respuesta afirmativa: abrir formulario. Negativa: registrar «No interesado» con actor manual. Sin contacto: conservar tarea pendiente; no inferir negativa.

**Explícito:** 7 y 3 días en ambos diagramas; P permite X días configurables.
**Decisión de mockup:** valores iniciales 7 y 3, editables como configuración de demostración. No hay temporizadores reales; «Avanzar reloj de demostración» evalúa vencimientos y evita duplicar un evento ya generado. Los días se cuentan como naturales por **supuesto**, pues las fuentes no especifican días hábiles.

### 3. Formulario de Renta

**Explícitos:** tipo de renta, quién presenta, respuestas guardadas, fee calculado según respuestas y aceptación del envío de PH. El registro interno incluye estado del DNI, certificado y autorización.

**Supuestos de mockup:**

- Campos mínimos de contacto: nombre, correo ficticio y responsable asociado.
- Catálogo ilustrativo de tipo de renta, por ejemplo «General» y «Con actividad», identificado como no exhaustivo.
- Presentador: RCD o cliente.
- Tarifa ilustrativa visible, por ejemplo 150 y 250 unidades monetarias de demostración, sin impuestos ni validez comercial. El valor se actualiza al cambiar el tipo; el socio podrá revisarlo después.
- Aceptación de envío de PH obligatoria, inicialmente desmarcada.

No exigir aquí el DNI escaneado por defecto: en Renta el diagrama solicita el DNI si falta después de firmar PH. No trasladar a Renta el requisito inicial de las dos caras del 720.

### 4. Formulario 720 sin PH

**Explícitos:** datos obligatorios, DNI escaneado por **dos caras**, validación de DNI activo y aceptación del envío de PH.

**Supuestos de mockup:** nombre, correo ficticio, identificador de documento ficticio y fecha de vigencia como catálogo mínimo; cada cara se añade desde archivos de demostración. La vigencia se verifica contra la fecha del reloj de demostración; no hay OCR ni validación oficial de identidad. Reglas para otros documentos de identidad quedan pendientes.

No se permite enviar mientras falte un campo obligatorio, una cara, la vigencia o la aceptación. Se muestran errores por campo, no un mensaje genérico de éxito.

### 5. Aceptación y traspaso

Guardar respuestas compartidas, crear expediente una sola vez, asociarlo al responsable y abrir la fase PH. Captación deja de emitir recordatorios de no respuesta; seguimiento posterior pertenece al expediente.

Notificación al abogado: evento local con enlace al expediente. El canal «Teams» es **opcional según E**, mostrado como simulación activable; no condición para crear el expediente. Sin relación cliente-responsable, mostrar tarea de asignación pendiente y aviso visible; no inventar un destinatario.

### 6. Excepción 720 con PH previa

La rama explícita evita correo inicial, formulario de nueva PH y nueva firma, y pasa al enlace de documentación. Mostrar «PH previa» y un expediente importado de demostración con su vínculo documental; no generar otra PH.

**Pendiente:** la fuente no explica cómo verificar vigencia, alcance o antecedentes PBC/NAV de esa PH. El escenario ficticio debe declarar sus antecedentes como precargados, no afirmar que una PH prueba por sí sola todas las validaciones. Si faltan datos, advertir «Antecedentes por revisar» sin inventar un filtro nuevo ni convertir automáticamente el caso en una alta nueva. El envío del enlace se demuestra en PRD 05.

## Pantallas e interacciones de mockup

- **Lista y segmento:** `DataTable`, filtros, selección de destinatarios y diálogo de previsualización.
- **Detalle de comunicación:** asunto/cuerpo ficticios, destinatario ficticio, enlace local al formulario, eventos de correo 1/2 y llamada.
- **Formulario cliente:** campos condicionales según servicio, tarifa ilustrativa Renta, caras del DNI 720 y casilla de aceptación.
- **Registro de llamada:** diálogo con «Interesado», «No interesado» o «Sin contacto» y comentario; confirmación antes de cerrar seguimiento.
- **Configuración de demostración:** plazos 7/3, reloj local, aviso al responsable y canal Teams opcional.
- **Confirmación:** aceptación, expediente asociado y siguiente paso; negativa con agradecimiento y datos de contacto ficticios.

PrimeVue: `DataTable`, `Select`, `InputText`, `DatePicker`, `Checkbox`, `Dialog`, `Message`, `Button` y `Toast`, según versión disponible.

## Estados

Entrada: contacto pendiente; en 720, PH previa sí/no.

Captación: correo 1, correo 2, pendiente de llamada, interesado/formulario pendiente, aceptado o no interesado.

Salida normal: expediente creado/PH en preparación.
Salida 720 con PH previa: expediente existente/documentación pendiente.

«Interesado/formulario pendiente» y «aceptado» son etiquetas de mockup. Completar el formulario sin enviarlo no crea expediente. «Sin contacto» no cierra el caso. La negativa no elimina historial.

## Criterios verificables

1. **P02-CA01:** enviar el correo inicial crea exactamente un evento por destinatario seleccionado elegible; no afecta a clientes no seleccionados ni al 720 con PH previa.
2. **P02-CA02:** con configuración 7/3, avanzar 6 días no envía correo 2; completar 7 días lo envía una vez; a los 2 días siguientes no hay llamada, y al tercero aparece la tarea. Repetir evaluación no duplica avisos.
3. **P02-CA03:** una respuesta antes del vencimiento detiene recordatorios de captación, conservando historial.
4. **P02-CA04:** una negativa digital registra agradecimiento y «No interesado»; una negativa telefónica registra actor y resultado manual; «Sin contacto» mantiene la tarea pendiente.
5. **P02-CA05:** el formulario Renta calcula solo la tarifa ilustrativa declarada, guarda tipo/presentador y no exige las dos caras del DNI propias de 720.
6. **P02-CA06:** en 720 sin PH, faltar una cara o usar vigencia vencida bloquea el envío con error específico; ambas caras ficticias y vigencia activa permiten continuar.
7. **P02-CA07:** no marcar aceptación bloquea ambos formularios. Aceptar con datos válidos crea un único expediente con respuestas y responsable; reenviar no crea otro.
8. **P02-CA08:** en 720 con PH previa no aparecen acciones de nueva PH ni correo inicial; el siguiente paso es el enlace documental y se ve el origen importado de los antecedentes.
9. **P02-CA09:** sin responsable, la aceptación queda visible y se solicita asignación; no se muestra una notificación entregada a un abogado inexistente.
10. **P02-CA10:** desactivar el canal Teams no impide aceptar ni abrir expediente; ningún envío o reloj provoca una llamada de red.

## Límites

Datos y archivos ficticios, estado en memoria, sin BD ni backend. Sin Customer Insights, Dynamics, Teams ni campañas reales; no se envían correos, no se hacen llamadas y no se conectan hojas Excel. No cargar el EML ni adjuntos originales en el mockup. Plazos, tarifas, catálogo de renta y controles de identidad no tienen validez comercial, legal o fiscal.
> Estado: implementado y validado como mockup. Sin BD ni integraciones reales. Véase [evidencia y concreciones](../README.md).
