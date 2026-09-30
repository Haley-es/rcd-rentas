# PRDs: mockup histórico y prototipo local

La documentación original se analizó antes de implementar las pantallas. Los siete PRDs históricos separan requisitos explícitos de supuestos de diseño y conservan referencias a los PDF y a las aclaraciones del correo. Los PRDs 08–10 incorporan una petición posterior: convertir el mockup en un prototipo local con acceso de dos pasos simulado, persistencia SQL Server y archivos locales reales.

## Mockup histórico: implementado y validado (01–07)

1. [Panel de campañas y expedientes](done/01-panel-campanas-y-expedientes.md)
2. [Captación y formularios](done/02-captacion-y-formularios.md)
3. [Propuesta de honorarios y firma](done/03-propuesta-honorarios-y-firma.md)
4. [Validaciones, PBC y alta NAV](done/04-validaciones-pbc-y-alta-nav.md)
5. [Portal y revisión documental](done/05-portal-y-revision-documental.md)
6. [Renta: borrador, presentación y cierre](done/06-renta-borrador-presentacion-y-cierre.md)
7. [Modelo 720: extracción, Criteria y cierre](done/07-modelo-720-extraccion-criteria-y-cierre.md)

Cada PRD histórico pasó primero por `todo` y se movió a `done` tras implementación y validación del mockup. Sus textos y evidencias describen ese alcance; «done» no acredita autenticación real, una BD o integraciones de producción.

## Prototipo local: acceso, persistencia y archivos implementados

8. [Login, MFA simulado y sesión local](done/08-login-mfa-y-sesion-local.md): **implementado y validado**. `usePrototypeAuth`, cookies HttpOnly, protección independiente SSR/cliente/API, origen obligatorio y logout con revocación. Cualquier valor no vacío es válido; no verifica identidades. Evidencia: 21 E2E, 52 unitarios y typecheck correctos.
9. [Persistencia integral con Prisma y SQL Server](done/09-persistencia-prisma-sql-server.md): **implementado y validado**. Prisma 6.19.3, base `RCDRenta` en localhost, 40 comandos del motor y seis comandos adicionales ejecutados en servidor, bootstrap de instalación nueva, reset explícito y concurrencia CAS. Evidencia: 11 E2E propios con SQL Server real, 21 E2E de regresión auth/app, 67 unitarios, typecheck, build y smoke de producción correctos.
10. [Archivos locales reales y arranque](done/10-archivos-locales-y-arranque.md): **implementado y validado**. Bytes privados con metadatos/versiones SQL, carga y descarga autenticadas por caso, rollback y concurrencia CAS, reset/reconciliación acotados, artefactos TXT/CSV inmutables y guía de instalación/reinicio/backup. Evidencia: 13 E2E propios con SQL/disco/Chromium reales, 11 de persistencia, 21 de auth/regresión, 70 unitarios, typecheck, build y smoke de producción correctos.

08, 09 y 10 se han movido a `done` después de implementar y validar sus respectivos alcances locales. Se guardan bytes reales aportados expresamente; el seed sigue siendo solo metadatos y los artefactos son TXT/CSV ficticios. NAV, Criteria, correo/Teams, firma, extractor y presentación continúan simulados; no se añaden integraciones externas.

### Dependencias y contratos de implementación

El orden acordado es **08, después 09, después 10**. 08 puede ejecutarse sobre el mockup en memoria; 09 necesita sus helpers de sesión/origen y 10 necesita ambos. No se requiere invertir 08 y 09 porque la sesión de 08 es efímera y no depende de tablas SQL.

- 08 es propietario de `shared/types/prototype-auth.ts`, `usePrototypeAuth` y `server/utils/prototype-auth.ts`. Proporciona sesión servidor y guardas reutilizables; no usa el selector de rol como autenticación.
  - `requirePrototypeSession(event)` devuelve `PrototypeSessionContext` (`username`, `sessionId`, `expiresAt` Unix ms); `requirePrototypeOrigin(event)` y el middleware protegen mutaciones. Un contexto SSR interno explícito nunca omite la sesión.
  - 09/10 usan `usePrototypeAuth().request<T>()` para recibir errores y limpiar estados/abortar operaciones ante 401. El antiguo puente `app/utils/prototype-mock-scope.ts` conserva únicamente el contrato de limpieza; ya no contiene un dataset privado ni ejecuta el motor.
- 09 conserva `useMockApp`, es propietario de `shared/types/prototype.ts`, singleton Prisma y store/comandos servidor. Define snapshot versionado, `datasetId`, `expectedRevision`, respuesta confirmada y proyección portal sin datos internos.
- 10 crea `shared/types/prototype-files.ts`, servicio de archivos y modelo `PrototypeFile`. Se enlaza a los IDs/versiones existentes dentro de la transacción de 09, sin duplicar el motor.
- Los archivos compartidos se editan por etapas, nunca simultáneamente: layout, portal, composable, manifiestos, esquema Prisma y configuración E2E. Los mapas completos de ownership están en cada PRD.

Cada PRD tiene su fichero Playwright exclusivo: `prototype-08-auth.spec.ts`, `prototype-09-persistence.spec.ts` y `prototype-10-files.spec.ts` dentro de `tests/e2e`. Las suites nuevas deben conservar los recorridos históricos, con login y reset autenticado explícito cuando corresponda. Las pruebas de persistencia/archivos usan SQL Server real y una BD/carpeta de pruebas aisladas, no fallback.

El test documental `tests/unit/prds.test.ts` distingue los siete PRDs históricos y sus 73 criterios de los PRDs 08–10. Exige cada documento exactamente una vez, estado pendiente en `todo`, evidencia/estado validado en `done` y enlaces locales válidos, incluidos los pendientes. No confunde requisitos nuevos con entregas.

## Evidencia de implementación del mockup histórico

- El panel, las tablas y los contadores se calculan a partir del mismo estado en memoria.
- Hay 18 escenarios: nueve de Renta y nueve de 720, con el mismo cliente en ambos servicios para comprobar aislamiento.
- El motor valida cada transición y devuelve errores explícitos sin modificar el caso cuando la acción está bloqueada.
- Se prueban exactamente las cadencias de 7/3 días y los límites de archivo de 10 MB.
- La PH, los documentos, los borradores y las ejecuciones del extractor mantienen versiones e historial.
- Los tests de navegador recorren captación, aprobación/firma, sustitución/entrega/revisión documental, Renta por RCD y por cliente, IT/Excel/Criteria, cierre, enlaces inválidos, reinicio y responsive móvil.
- La comprobación de tipos y el build de producción forman parte de la entrega.

## Concreciones de diseño del mockup histórico

- Tipo de Renta: Individual/Conjunta; tarifa ilustrativa 150/250 EUR. No es una tarifa comercial aprobada.
- Checklist inicial: DNI anverso/reverso más Datos fiscales en Renta o Bienes en el extranjero en 720. El catálogo incluye documentos opcionales; no constituye un checklist fiscal completo.
- Las acciones de alta y presentación usan referencias y fechas ficticias. El justificante de demostración se representa mediante TXT, no mediante un PDF oficial.
- El Excel del extractor es una tabla editable y una descarga CSV, no XLSX ni un archivo importable en Criteria.
- Los enlaces incluyen un token determinista de demostración. Su caducidad se simula mediante un token inválido; desde 08 también requieren sesión local de dos pasos. No existe identidad, MFA ni autorización de producción.
- Los antecedentes de 720 con PH previa no se marcan aprobados al abrir el caso: requieren confirmación humana explícita. Esta confirmación no genera una nueva PH ni un alta NAV.
- Los seguimientos se evalúan con un botón y un reloj controlable; no hay trabajos en segundo plano ni comunicaciones reales.

Los aspectos de producción no definidos en las fuentes siguen pendientes: identidad y MFA reales, permisos de producción, calendarios definitivos, plantillas/fees, campos NAV, extractor e integraciones. La persistencia local de 09 y los archivos reales de 10 están implementados y validados. El acceso implementado en 08 sigue siendo una simulación. Nada de ello debe anunciarse como producción.
