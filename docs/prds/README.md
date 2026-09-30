# PRDs del mockup

La documentación original se analizó antes de implementar las pantallas. Los siete PRDs separan requisitos explícitos de supuestos de diseño y conservan referencias a los PDF y a las aclaraciones del correo.

## Implementados y validados

1. [Panel de campañas y expedientes](done/01-panel-campanas-y-expedientes.md)
2. [Captación y formularios](done/02-captacion-y-formularios.md)
3. [Propuesta de honorarios y firma](done/03-propuesta-honorarios-y-firma.md)
4. [Validaciones, PBC y alta NAV](done/04-validaciones-pbc-y-alta-nav.md)
5. [Portal y revisión documental](done/05-portal-y-revision-documental.md)
6. [Renta: borrador, presentación y cierre](done/06-renta-borrador-presentacion-y-cierre.md)
7. [Modelo 720: extracción, Criteria y cierre](done/07-modelo-720-extraccion-criteria-y-cierre.md)

Cada PRD pasó primero por `todo` y se movió a `done` tras implementación y validación. La carpeta `todo` queda preparada para requisitos futuros; no contiene trabajo de mockup pendiente.

## Evidencia de implementación

- El panel, las tablas y los contadores se calculan a partir del mismo estado en memoria.
- Hay 18 escenarios: nueve de Renta y nueve de 720, con el mismo cliente en ambos servicios para comprobar aislamiento.
- El motor valida cada transición y devuelve errores explícitos sin modificar el caso cuando la acción está bloqueada.
- Se prueban exactamente las cadencias de 7/3 días y los límites de archivo de 10 MB.
- La PH, los documentos, los borradores y las ejecuciones del extractor mantienen versiones e historial.
- Los tests de navegador recorren captación, aprobación/firma, sustitución/entrega/revisión documental, Renta por RCD y por cliente, IT/Excel/Criteria, cierre, enlaces inválidos, reinicio y responsive móvil.
- La comprobación de tipos y el build de producción forman parte de la entrega.

## Concreciones de diseño

- Tipo de Renta: Individual/Conjunta; tarifa ilustrativa 150/250 EUR. No es una tarifa comercial aprobada.
- Checklist inicial: DNI anverso/reverso más Datos fiscales en Renta o Bienes en el extranjero en 720. El catálogo incluye documentos opcionales; no constituye un checklist fiscal completo.
- Las acciones de alta y presentación usan referencias y fechas ficticias. El justificante de demostración se representa mediante TXT, no mediante un PDF oficial.
- El Excel del extractor es una tabla editable y una descarga CSV, no XLSX ni un archivo importable en Criteria.
- Los enlaces incluyen un token determinista de demostración. Su caducidad se simula mediante un token inválido; no existe autenticación ni expiración de producción.
- Los antecedentes de 720 con PH previa no se marcan aprobados al abrir el caso: requieren confirmación humana explícita. Esta confirmación no genera una nueva PH ni un alta NAV.
- Los seguimientos se evalúan con un botón y un reloj controlable; no hay trabajos en segundo plano ni comunicaciones reales.

Los aspectos de producción no definidos en las fuentes siguen pendientes: autenticación, permisos reales, persistencia, calendarios definitivos, plantillas/fees, campos NAV, extractor e integraciones. Esto no es trabajo implementado ni prometido por el mockup.
