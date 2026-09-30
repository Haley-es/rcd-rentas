# PRD 03. Propuesta de honorarios, revisión y firma

## Objetivo

Demostrar una PH derivada del formulario, revisada antes de enviarse, firmada o renegociada y trazable por versiones. Cubrir falta de firma, llamadas y negativa definitiva sin confundirlas con un rechazo negociable.

**Estado:** implementado y validado como mockup.

**Dependencias:** [PRD 01](01-panel-campanas-y-expedientes.md) y [PRD 02](02-captacion-y-formularios.md).
**Salida:** [validaciones y altas, PRD 04](04-validaciones-pbc-y-alta-nav.md).

## Fuentes y trazabilidad

- **R:** [Flujo Rentas v7.pdf](<../../Flujo Rentas v7.pdf>), página 1, formulario/fees, «Enviar PH vía Signaturit», «Pte. Firma PH», espera de 3 días, llamada y «PH firmada». Nota: el modelo varía según alcance, fee y necesidad de autorización de uso del certificado.
- **720:** [Flujo 720 v5_Global.drawio.pdf](<../../Flujo 720 v5_Global.drawio.pdf>), página 1, creación de PH según formulario, envío al socio, «¿PH OK?», edición por socio, firma y confirmación al socio con solicitud de alta en PDF.
- **P:** [propuesta](<../../Propuesta de Digitalización de las Campañas de la Renta y 720.pdf>), páginas 7 y 10: PH, Signaturit y recordatorios configurables.
- **E:** [correo](<../../Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml>), preguntas del 30 de enero, «Fase 2», apartado PH: validación previa del socio con modificación y renegociación. Respuesta del 3 de febrero, «Fase 2», punto PH: revisión y envío manual por abogado responsable, y notificación ante no aceptación.

**Resolución de conflicto:** los diagramas/propuesta muestran envío automático o directo. Para el mockup se adopta revisión previa y envío manual de la aclaración del correo, conservando generación simulada y seguimiento de firma. No se envía automáticamente una PH al aceptar el formulario.

## Roles

- Socio: revisar, modificar y validar PH; gestionar renegociación.
- Profesional responsable: comprobar la versión revisada y ejecutar envío manual; registrar llamada.
- Cliente: visualizar la PH, firmar en simulación, pedir cambios o rechazar definitivamente.
- Sistema simulado: generar borrador, registrar firma/avisos y preparar información de alta.

**Supuesto:** socio y abogado pueden coincidir en un caso, pero la UI distingue validación y envío; no requiere dos identidades reales.

## Flujo

1. Entrada con aceptación del cliente y respuestas del formulario. Generar PH ficticia con cliente, servicio, alcance, fee y modelo.
2. En Renta, mostrar presentador y si la PH incluye autorización de uso del certificado; conservar como dato separado el estado de la autorización, no asumir que ver un párrafo equivale a autorización firmada.
3. Socio revisa. Si encuentra cambios, editar alcance/importe/texto de demostración y guardar nueva versión.
4. Validar la versión actual. **Supuesto de mockup:** editar después de validar invalida esa validación; impide enviar un contenido modificado sin revisar.
5. Profesional envía manualmente la PH validada; crear evento «Envío Signaturit simulado» y estado «Pte. Firma PH». El documento no sale del navegador.
6. Cliente firma la versión enviada mediante un control de simulación explícito. Estado «PH firmada», con versión/fecha y evento local.
7. Si no firma, **a los 3 días** los diagramas prevén llamada; 720 incluye aviso automático al responsable. Registrar llamada: sigue interesado, no interesado o sin contacto.
8. Si continúa interesado, mantener firma pendiente y permitir retomar la misma versión o renegociar. Si no acepta el contenido, avisar al socio/responsable, abrir renegociación, modificar, volver a validar y reenviar. Rechazo negociable no archiva expediente.
9. Si declara que no quiere el servicio, marcar «No interesado» con motivo y detener seguimiento; no borrar versiones.
10. Al firmar 720, registrar confirmación simulada al socio y preparar solicitud de alta en formato de vista PDF ficticia. Estado operativo «Pte. Altas» al emitir la solicitud. En Renta, continuar a comprobación DNI y validaciones.

### Recordatorios completos

- La llamada tras 3 días sin firma es explícita en R y 720.
- P, página 10, menciona recordatorios de firma tras X días. La UI ofrece una previsualización/envío simulado de recordatorio con plazo configurable; el número total y la cadencia definitiva no están acordados.
- **Supuesto de mockup:** configurar inicialmente un recordatorio de firma al tercer día junto con la tarea de llamada, identificado como cadencia de demostración. Permitir desactivarlo; la llamada explícita no desaparece por desactivar el correo.
- Evaluar un mismo vencimiento dos veces no produce dos avisos ni llamadas. Firmar, rechazar definitivamente o sustituir una versión cancela los recordatorios pendientes de esa versión.

## Pantallas e interacciones de mockup

- **Pestaña PH:** respuestas origen, tarifa/alcance, modelo, contenido ficticio, validación y estado.
- **Editor del socio:** diálogo con campos editables, motivo de cambio, guardar/cancelar y validación.
- **Historial de versiones:** tabla de versión, autor, revisión, envío, respuesta y vigencia. Solo una versión es actual.
- **Confirmación de envío:** destinatario ficticio, vista previa y botón manual; bloqueo explícito si no existe validación actual.
- **Vista cliente:** documento ficticio y controles «Simular firma», «Solicitar cambios» y «No deseo continuar», estos dos últimos con motivo.
- **Seguimiento:** aviso, diálogo de llamada y previsualización de recordatorio.
- **Solicitud de alta 720:** previsualización de datos y estado de envío simulado al socio/Altas; no un PDF operativo.

PrimeVue: `Tabs`, `DataTable`, `InputNumber`, `Textarea`, `Dialog`, `Tag`, `Message`, `Button` y `Timeline`.

## Estados

Artefacto PH: borrador, pendiente de revisión, cambios solicitados, validada, enviada/pendiente de firma, firmada, rechazada para renegociación, sustituida.

Expediente: PH en preparación/revisión, «Pte. Firma PH», «PH firmada» o no interesado por retirada definitiva; en 720, «Pte. Altas» al solicitar alta. La tarea «Pte. Llamada Resp.» no reemplaza el estado de firma del artefacto.

Las etiquetas de revisión/versionado son **supuestos de UI**. La firma solo corresponde a una versión; una anterior sustituida no puede quedar vigente simultáneamente. El caso 720 con PH previa no entra en generación ni firma nueva.

## Criterios verificables

1. **P03-CA01:** aceptar formulario crea una PH ficticia basada en las respuestas, pero cero eventos de envío antes de la acción manual.
2. **P03-CA02:** intentar enviar una PH sin validación actual está bloqueado con motivo; validar y enviar crea exactamente un evento y «Pte. Firma PH».
3. **P03-CA03:** cambiar alcance o fee crea nueva versión e invalida aprobación anterior; cancelar edición conserva versión y aprobación.
4. **P03-CA04:** las variantes Renta distinguen alcance/fee/autorización; incluir cláusula sin firma no cambia por sí solo la autorización a disponible.
5. **P03-CA05:** al simular firma se registra la versión enviada, aparece «PH firmada» y se cancelan seguimientos pendientes.
6. **P03-CA06:** con plazo de llamada de 3 días, a los 2 días no se crea tarea y al tercero sí; volver a evaluar no duplica. El correo opcional se genera solo si está activado.
7. **P03-CA07:** «Solicitar cambios» notifica al responsable/socio y permite editar, validar y reenviar, sin marcar «No interesado». «No deseo continuar» requiere confirmación y detiene seguimiento.
8. **P03-CA08:** llamada «Sigue interesado» o «Sin contacto» no firma, no cierra expediente y conserva la acción pendiente correspondiente.
9. **P03-CA09:** firmar 720 prepara confirmación al socio y solicitud de alta ficticia; firmar Renta conduce a validación de DNI. Ambos efectos quedan visibles en cronología.
10. **P03-CA10:** un caso 720 con PH previa no crea una segunda PH ni solicitud nueva de firma.

## Supuestos, pendientes y límites

No se aportan plantillas jurídicas completas, tarifas aprobadas, matriz de modelos ni contenido definitivo de autorización o PDF de alta. La UI debe usar texto y valores ficticios con aviso visible; no derivar reglas tributarias o contractuales por inferencia.

Solo Nuxt + PrimeVue, datos ficticios y memoria local, sin BD/backend. Sin Signaturit, correo, Teams, firma electrónica legal, PDF contractual ni efectos reales en NAV. No usar documentos originales ni datos personales reales. La firma es un cambio de estado de demostración, nunca evidencia legal.
> Estado: implementado y validado como mockup. Sin BD ni integraciones reales. Véase [evidencia y concreciones](../README.md).
