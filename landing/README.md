# Landing para clientes · Renta y Modelo 720

Página estática e independiente para que los clientes de RCD contraten el servicio de preparación y presentación de la declaración de la Renta y del Modelo 720. No necesita servidor, build ni conexión: abre [index.html](index.html) en el navegador.

## Contenido

1. Portada con la propuesta de valor y una vista del portal del cliente.
2. «¿Te suena?»: dudas habituales del contribuyente.
3. Servicios: Renta (IRPF) y Modelo 720, y perfiles a los que se dirige.
4. Cómo funciona: cinco pasos, del cuestionario al justificante.
5. Portal privado: acceso verificado, documentos, recordatorios, justificante y factura.
6. Modelo 720 con test orientativo interactivo por bloques (cuentas; valores, seguros y rentas; inmuebles).
7. Por qué RCD y comparativa frente a hacerlo por cuenta propia o con una app genérica.
8. Fechas clave de la campaña.
9. Preguntas frecuentes.
10. Formulario de solicitud de propuesta de honorarios.

## Estructura

- [index.html](index.html): contenido y marcado accesible.
- [estilos.css](estilos.css): diseño adaptable (escritorio, tableta y móvil) con la paleta de la presentación.
- [js/landing.js](js/landing.js): menú, animaciones de entrada, test del 720 y validación del formulario.

## Pendiente antes de publicar

- **El formulario no envía datos.** Valida los campos y muestra la confirmación en el navegador. Hay que conectarlo al canal que decida RCD (CRM, correo o el módulo de comunicación de la plataforma) en el `submit` de `js/landing.js`.
- Enlazar la política de privacidad real y el aviso legal.
- Validar con RCD los textos, el logotipo, el tiempo de respuesta comprometido y los datos de contacto.
- Revisar cada campaña los umbrales y plazos del Modelo 720 y de la Renta. El test es orientativo y no sustituye la revisión del asesor.
