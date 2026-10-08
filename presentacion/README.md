# Presentación comercial · Renta y Modelo 720

Web estática e independiente para presentar la propuesta a RCD. No necesita servidor, build ni conexión: abre [index.html](index.html) en el navegador (Chrome o Edge recomendados) y pulsa `F` para pantalla completa.

## Contenido

1. Portada con capturas del prototipo en 3D.
2. Punto de partida: retos detectados en las campañas actuales.
3. La solución: comunicación, gestión de expedientes y portal del cliente alrededor de un expediente único.
4. **Demo del ciclo completo** (18 pasos, unos 2:30 min): acceso, lanzamiento de campaña, respuesta del cliente, propuesta de honorarios, validaciones y PBC, documentación, borrador de Renta, extractor 720 y Criteria, presentación, factura, cierre y seguimiento.
5. Reglas de negocio: qué se automatiza y qué decide una persona.
6. Impacto esperado con gráficos (Chart.js).
7. Hoja de ruta de 13–15 semanas (diagrama de Gantt).
8. Siguiente paso y aceptación de la propuesta.

## Controles

| Acción | Teclado / ratón |
| --- | --- |
| Diapositiva siguiente / anterior | `→` / `←`, rueda, deslizar o menú superior |
| Pausa / reanudar la demo | `Espacio` o botón central |
| Volver a empezar la demo | `R`, botón de reinicio o «Volver a empezar» al final |
| Paso anterior / siguiente de la demo | `←` / `→` o botones laterales |
| Saltar a un punto o fase | barra de progreso o lista «Recorrido» |
| Velocidad | botón `1×` (1×, 1,5×, 2×, 0,75×) |
| Pantalla completa | `F` |
| Efectos de sonido (activados por defecto) | `S` o botón del altavoz arriba a la derecha |
| Música de fondo (desactivada por defecto) | `M` o botón de la nota musical |

Se puede abrir directamente una sección con el ancla, por ejemplo `index.html#demo`.

## Sonido

La web reproduce los mismos efectos que el vídeo (clics, tecleo, avisos, sellos, cambios de vista, gráficos, celebración…) y, si se activa, el mismo fondo musical en bucle.

- Los navegadores no permiten audio hasta la primera interacción: el sonido empieza tras el primer clic o tecla.
- Las preferencias de efectos y música se guardan en el navegador (`localStorage`).
- Los sonidos se sintetizan en un Web Worker y se pre-generan al iniciar el audio, así que no frenan las animaciones. Los saltos con la barra de la demo no disparan sonidos.

## Estructura

- [index.html](index.html) y [estilos.css](estilos.css): diapositivas y diseño a 1600×900, escalado a cualquier pantalla.
- [js/presentacion.js](js/presentacion.js): navegación y animaciones de entrada.
- [js/demo.js](js/demo.js): guion de la demo sobre una línea de tiempo GSAP (pausa, salto y reinicio).
- [js/graficos.js](js/graficos.js): gráficos de impacto y plan.
- [js/fondo.js](js/fondo.js): fondo animado.
- [js/sintetizador.js](js/sintetizador.js): síntesis de efectos y música, compartida por la web y el vídeo.
- [js/sonido.js](js/sonido.js): reproducción en la web (Web Audio), botones de efectos y música, y eventos `sfx` para el grabador.
- [video](video): grabador del vídeo y sintetizador de audio.
- [capturas](capturas): pantallas reales del prototipo y `puntos.js` con la posición de cada elemento que señala el cursor.
- [vendor](vendor): GSAP 3.13 y Chart.js 4.5 locales, para funcionar sin conexión.

## Regenerar las capturas

Con el prototipo arrancado en `http://127.0.0.1:3010` (`pnpm dev`) y los datos de demostración sin modificar:

```powershell
node presentacion\capturar.mjs
```

El script inicia sesión con valores ficticios, recorre las pantallas sin cambiar datos, guarda las imágenes y regenera `capturas/puntos.js`. Para otra URL usa la variable `PRESENTACION_BASE_URL`.

Los datos, importes y cifras de impacto son ilustrativos y deben validarse con RCD.

## Vídeo con efectos de sonido

[video/grabar.mjs](video/grabar.mjs) graba la presentación completa en dos versiones: `video/propuesta-rcd.mp4` (efectos y música de fondo) y `video/propuesta-rcd-onlyfx.mp4` (solo efectos, sin música). Ambas en 1920×1080, 30 fps, H.264 + AAC, unos 3:40 minutos): portada, contexto, demo entera, reglas, impacto, hoja de ruta y aceptación con confeti.

```powershell
# Requiere ffmpeg con libx264 en el PATH, o su ruta en FFMPEG_PATH.
node presentacion\video\grabar.mjs
```

- La página corre con el reloj simulado de Playwright: el tiempo avanza exactamente 1/30 s por fotograma, así que el vídeo sale fluido aunque la captura sea lenta (unos 35–40 minutos de grabación).
- La presentación emite eventos `sfx` ([js/sonido.js](js/sonido.js)) en cada clic, tecleo, sello, aviso, zoom, cambio de vista o diapositiva, gráfico y celebración. El grabador guarda su instante exacto.
- [video/sonido.mjs](video/sonido.mjs) usa el mismo sintetizador que la web ([js/sintetizador.js](js/sintetizador.js)) para generar todos los efectos y un fondo musical ambiental con reverberación y atenuación automática bajo los efectos. No usa muestras externas, así que no hay derechos de terceros.
- Variables opcionales: `VIDEO_OUT` (ruta de la versión con música; la de solo efectos se nombra igual con `-onlyfx`), `VIDEO_FPS`, `VIDEO_KEEP_TMP=1` para conservar vídeo mudo, WAV y eventos en `video/.tmp`, y `VIDEO_REUTILIZAR=1` para regenerar solo el audio de ambas versiones a partir del `propuesta-rcd.mp4` existente (unos 3 minutos, sin capturar fotogramas).
- Los MP4 están excluidos de Git en [video/.gitignore](video/.gitignore).
- Durante la grabación la web no reproduce audio: el grabador sintetiza la pista completa aparte.
