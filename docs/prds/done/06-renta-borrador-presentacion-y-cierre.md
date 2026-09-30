# PRD 06. Renta: borrador, presentación y cierre

## Objetivo

Completar los dos recorridos de Renta después de validar documentos: preparación y revisión iterativa del borrador, acuerdo del cliente y presentación por RCD o por el propio cliente. Mantener diferencias de justificante, factura/minuta y cierre.

**Estado:** implementado y validado como mockup.
**Dependencias:** [PRD 01](01-panel-campanas-y-expedientes.md), [PRD 04](04-validaciones-pbc-y-alta-nav.md) y [PRD 05](05-portal-y-revision-documental.md).

## Fuentes y trazabilidad

- **R:** [Flujo Rentas v7.pdf](<../../Flujo Rentas v7.pdf>), página 1, desde «Realizar renta y enviar Borrador a Cliente para su validación», decisión «¿Cliente está de acuerdo?», revisión y reenvío, «¿Quién presenta Renta?», ramas RCD/cliente, aviso «antes del X/X/X», justificante y factura.
- **P:** [propuesta](<../../Propuesta de Digitalización de las Campañas de la Renta y 720.pdf>), página 10: preparación/validación, registro de presentación, archivo de justificantes, minuta y cierre operativo. Página 7: trazabilidad.
- **E:** [correo](<../../Re_ Propuesta de Digitalización de las Campañas de la Renta y 720.eml>), respuesta del 3 de febrero, «Fase 1»: los pasos posteriores a aceptación/firma pertenecen al flujo de expediente.

## Roles

- Profesional responsable: preparar borrador ficticio, revisar observaciones, enviarlo, registrar presentación RCD y cierre.
- Cliente: revisar, aceptar o solicitar revisión; si es presentador, confirmar su propia presentación.
- Rol administrativo de demostración: registrar envío de factura/minuta. **Supuesto:** las fuentes no asignan un actor concreto a esta última acción.
- Sistema simulado: comunicaciones, recordatorios y actualización del historial.

## Flujo

### 1. Preparar borrador

Entrada con documentación validada y PH firmada. Alta/validaciones según el escenario. Mostrar datos documentales disponibles y el presentador elegido en formulario.

Profesional crea borrador ficticio: versión, fecha, resumen y resultado ilustrativo. No se calcula una declaración ni se transforma documentación real. Enviar manualmente al cliente crea evento de comunicación y estado «Pendiente de validación del cliente».

**Supuesto:** resultado precargado, por ejemplo «Resultado de demostración: a devolver 125,00 EUR». Siempre acompañado de «Sin validez fiscal»; no deducirlo de tarifas, archivos ni reglas reales.

### 2. Validación iterativa

- Cliente acepta la versión enviada: guardar versión, fecha y acuerdo.
- Cliente pide revisión: comentario obligatorio; volver a «En revisión».
- Profesional revisa, crea nueva versión y vuelve a enviar.
- Repetir hasta acuerdo; conservar observaciones y borradores anteriores.

**Supuesto de mockup:** una edición posterior invalida el acuerdo anterior para la versión nueva. No habilitar presentación por haber aceptado una versión sustituida. Las fuentes no fijan plazo ni cadencia de recordatorio de borrador; no reutilizar 7/3 días de captación.

### 3. Presentador y condiciones

El presentador procede del formulario Renta. La fuente separa RCD y cliente; no existe esta bifurcación en el recorrido 720.

**Supuesto:** antes de presentar, el profesional puede corregir el presentador con motivo y nueva confirmación; conservar historial y no alterar una presentación ya registrada.

Condiciones comunes de demostración: PH firmada, documentación validada y acuerdo sobre borrador vigente. Para una alta nueva, no debe quedar una incidencia PBC sin resolución para continuar ni alta pendiente. Las comprobaciones no son validaciones tributarias reales.

### 4. Presentación por RCD

1. Comprobar certificado activo y autorización de uso disponible según PRD 04. Si falta alguno, explicar bloqueo y enlazar su revisión.
2. «Registrar presentación RCD (simulada)»: diálogo con fecha, referencia ficticia y muestra de justificante.
3. Solo confirmar manualmente marca «Presentada por RCD». No lanzar trámite a Hacienda ni Criteria.
4. Previsualizar/enviar justificante ficticio al cliente; registrar destinatario/evento.
5. Registrar factura/minuta y su envío simulado.
6. Cerrar operativamente cuando presentación, justificante enviado y factura enviada estén registrados.

Referencia, obligatoriedad de justificante para confirmar y comprobaciones de cierre son **supuestos de mockup** para demostrar evidencia y evitar éxitos sin artefactos; el envío de justificante/factura sí es explícito.

### 5. Presentación por cliente

1. Con acuerdo vigente, enviar aviso indicando que debe presentar antes de una fecha configurable.
2. La fecha es un valor de campaña **ficticio**: el diagrama solo dice X/X/X. No introducir una fecha legal real.
3. Mostrar «Pendiente de presentación por cliente». El aviso no prueba que haya presentado.
4. Cliente confirma presentación mediante diálogo de demostración, con fecha y comentario; profesional ve y registra la confirmación.
5. Permitir una muestra de justificante aportada por cliente como evidencia **opcional**. La rama específica del diagrama pasa de «Cliente Presenta Renta» a factura, sin envío de justificante por RCD.
6. Registrar envío ficticio de factura y cerrar operativamente después de confirmar presentación y envío de factura.

**No** exigir envío de justificante de RCD en esta rama ni certificado/autorización de RCD para una presentación del cliente. Mostrar justificante «Aportado por cliente» o «No aportado», y envío por RCD «No aplica», no un éxito inventado.

### 6. Factura/minuta y cierre

Campos ficticios: referencia, importe de demostración, fecha y estado de envío. Mostrar honorarios acordados como contexto, sin emisión contable, cálculo tributario ni cobro.

El botón de cierre exige las condiciones de su rama, muestra resumen y solicita confirmación. Si falta un paso, ofrece el motivo; cancelar mantiene expediente abierto. Cerrar no borra el historial ni equivale a factura pagada.

**Supuesto:** el expediente cerrado queda consultable y sin acciones de edición fiscal; no se define reapertura, rectificación o declaración complementaria porque las fuentes no las describen.

## Pantallas e interacciones de mockup

- **Preparación Renta:** resumen ficticio, versionado, editor breve, botón de envío y advertencias.
- **Borrador cliente:** vista de versión vigente, «Estoy de acuerdo» o «Solicitar revisión», con confirmación/comentario.
- **Presentación:** presentador visible; diálogo RCD o aviso/confirmación cliente, según rama.
- **Justificante/factura:** muestras precargadas, previsualización local y eventos de envío ficticio.
- **Cierre:** lista de condiciones de la rama, bloqueos, confirmación y resumen final.

PrimeVue: `Tabs`, `DataTable`, `Textarea`, `Dialog`, `DatePicker`, `Tag`, `Message`, `Timeline` y `Button`.

## Estados

Borrador: no preparado, borrador interno, enviado, cambios solicitados, revisado, aceptado y sustituido.

Expediente: preparación Renta, pendiente de validación, en revisión, listo para presentar, pendiente de presentación por cliente, presentada por RCD/cliente, pendiente de justificante cuando aplique, pendiente de factura y cerrado.

Factura: pendiente, preparada ficticiamente y envío registrado. No añadir «pagada» como resultado del cierre.

Las etiquetas de estado son **supuestos de UI**; el diagrama especifica acciones y decisiones, no sus nombres completos.

## Criterios verificables

1. **P06-CA01:** no se puede iniciar preparación sin documentación validada; mensaje identifica requisito faltante.
2. **P06-CA02:** enviar borrador lo muestra en el portal con la misma versión y genera un evento; no lo acepta automáticamente.
3. **P06-CA03:** pedir revisión requiere comentario y devuelve el caso al profesional; revisar y reenviar conserva todas las versiones.
4. **P06-CA04:** presentar está bloqueado sin acuerdo vigente; modificar una versión aceptada invalida ese acuerdo para la nueva.
5. **P06-CA05:** presentación RCD queda bloqueada si certificado o autorización no están disponibles, y se habilita tras registrar ambos en el escenario.
6. **P06-CA06:** confirmar presentación RCD exige fecha/referencia/muestra; cancelar no marca presentado. Confirmar crea un único registro, sin conexión externa.
7. **P06-CA07:** en rama cliente, enviar aviso muestra fecha ficticia pero no marca presentada; la confirmación posterior sí permite pasar a factura.
8. **P06-CA08:** cliente presentador puede cerrar tras presentación confirmada y factura enviada sin envío de justificante RCD ni certificado de RCD; esos campos muestran «No aplica», no «Enviado».
9. **P06-CA09:** en rama RCD, faltar justificante enviado o factura enviada bloquea cierre con causa concreta; registrar ambos permite cerrar.
10. **P06-CA10:** cerrar no marca factura pagada, no elimina versiones y conserva detalle consultable; no aparece opción de rectificación no definida.
11. **P06-CA11:** ninguna acción de Renta altera Excel/Criteria de un expediente 720 del mismo cliente.

## Pendientes y límites

No se aportan contenido oficial del borrador, cálculos, calendario fiscal, formatos de justificante/factura, reglas de cobro ni tratamiento de presentación fallida, complementaria o rectificativa. No inventarlos como requisitos explícitos.

Solo Nuxt + PrimeVue, datos/muestras ficticios y memoria local; sin BD/backend, AEAT/Hacienda, software fiscal, certificados, correo, facturación o cobro real. Sin generación de declaraciones oficiales. No copiar contenido documental de clientes reales ni presentar un resultado de demostración como cálculo válido.
> Estado: implementado y validado como mockup. Sin BD ni integraciones reales. Véase [evidencia y concreciones](../README.md).
