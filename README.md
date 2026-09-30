# RCD · Campañas fiscales

Mockup interactivo de la digitalización de campañas de Renta y Modelo 720, construido a partir de la documentación original de [docs](docs). Incluye gestión interna, comunicación y un portal individual de cliente.

**No es una aplicación de producción.** Todos los nombres, correos, archivos, honorarios y plazos de la aplicación son ficticios. No hay base de datos, autenticación real, correo, Teams, firma electrónica, presentación fiscal ni conexiones con NAV o Criteria.

## Puesta en marcha

Requiere Node.js `^22.19.0`, `^24.11.0` o `>=26` y pnpm `11.2.0`.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Abrir `http://127.0.0.1:3010`. Desarrollo, preview y tests E2E usan el puerto **3010** para evitar conflictos con otros proyectos en el puerto 3000. El servidor de desarrollo solo escucha en la interfaz local.

```powershell
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm preview
```

Los tests E2E arrancan el servidor si no está disponible. Si ya existe una instancia de Nuxt para este proyecto en otro puerto, debe detenerse antes: Nuxt no permite dos servidores de desarrollo sobre la misma carpeta.

## Qué se puede explorar

- **Vista general:** indicadores calculados sobre los datos de la campaña seleccionada, distribución por fase y casos con bloqueos.
- **Expedientes:** 18 escenarios, filtros por campaña, fase y responsable, búsqueda y exportación de la vista a CSV ficticio.
- **Comunicación:** listas y segmentos, invitación a los contactos seleccionados, formularios, negativas, agradecimientos y aceptación que abre un expediente único.
- **Tareas:** bandejas de negocio, PBC e IT; evaluación manual de seguimientos con reloj de demostración. Captación: 7 días hasta recordatorio y 3 adicionales hasta llamada. Firma: llamada a los 3 días. El correo de firma opcional y la cadencia documental son supuestos configurables del mockup.
- **Propuesta de honorarios:** revisión del socio, versiones, envío manual del profesional, firma ficticia del cliente, rechazo negociable y retirada definitiva diferenciados.
- **Validaciones:** DNI vigente y dos caras, certificado y autorización independientes; incidencias PBC y resolución humana; registro manual de referencia NAV.
- **Documentos:** incorporación de metadatos, versiones y solicitudes de sustitución; entrega explícita al profesional y validación manual del conjunto.
- **Renta:** borradores iterativos, aceptación de la versión vigente, presentación por RCD o por cliente, justificante según rama, factura y cierre sin dar por confirmado el cobro.
- **720:** extractor activado manualmente, fallo técnico e incidencia IT separados de PBC, revisión de filas, representación CSV y registro de carga manual de la versión vigente en Criteria.
- **Portal:** solo datos y acciones del caso enlazado. Los enlaces incorrectos o expirados de demostración no muestran datos.

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

El estado vive exclusivamente en memoria de la aplicación. La navegación interna conserva los cambios; recargar la página o confirmar «Reiniciar demo» restaura los escenarios. No se usa almacenamiento persistente del navegador.

Los archivos aportados se validan localmente por tipo/extensión y tamaño: PDF, PNG, JPEG, DOC/DOCX o XLS/XLSX, máximo **10 MB decimales**. Solo se conservan nombre, tipo, tamaño y versión; **no se leen, guardan ni suben los bytes**. Las descargas son TXT o CSV ficticios, nunca documentos fiscales reales ni formatos de importación de NAV o Criteria.

Fechas, checklists, tarifas y estructura del Excel son ilustrativos. Las plantillas y tarifas comerciales, campos NAV, prompt del extractor, formatos Criteria y calendario fiscal definitivo siguen pendientes de definición en las fuentes.

## Tecnología y estructura

- Nuxt 4, Vue 3 y TypeScript.
- pnpm con lockfile y autorización explícita del script de esbuild.
- PrimeVue 4, tema Aura personalizado y PrimeIcons.
- [Motor de flujo](app/utils/workflow.ts): transiciones, roles, validaciones, versionado e historial.
- [Escenarios](app/data/seed.ts): datos ficticios reproducibles.
- [PRDs](docs/prds): requisitos derivados de las fuentes, con trazabilidad y criterios de aceptación.
- [Tests unitarios](tests/unit/workflow.test.ts) y [E2E](tests/e2e/app.spec.ts): umbrales exactos, aislamiento, bloqueos, versionado, carga documental, ramas fiscales y responsive móvil.

Los módulos implementados se trasladan de [todo](docs/prds/todo) a [done](docs/prds/done) después de validar sus recorridos de mockup. «Done» describe el prototipo, no una integración o servicio real.
