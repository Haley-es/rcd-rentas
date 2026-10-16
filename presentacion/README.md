# Propuesta de proyecto a medida · Renta y Modelo 720

Web estática e independiente para proponer a RCD la preparación de una petición de proyecto a medida. El Mockup sirve como base para concretar necesidades, alcance y reglas de negocio; la evaluación de la petición deberá determinar la viabilidad, el presupuesto, los recursos y el calendario.

No necesita servidor, build ni conexión: abre [index.html](index.html) en el navegador y pulsa `F` para pantalla completa.

## Identidad visual

Paleta azul y celeste de RCD; títulos Quicksand, textos Open Sans y destacados Arvo. Fuentes, licencias y estilos comunes incluidos en `brand/`, sin peticiones externas. Para actualizarlos desde el repositorio, ejecutar `node scripts/sync-brand.mjs`. [Criterios de identidad](../docs/identidad-visual.md).

## Contenido

1. Portada con capturas del Mockup y la propuesta de preparar una petición de proyecto.
2. Punto de partida: retos detectados en las campañas actuales.
3. Alcance propuesto: comunicación, gestión de expedientes y portal del cliente.
4. Reglas de negocio que deben validarse con los equipos de RCD.
5. Beneficios a evaluar mediante un escenario ilustrativo y gráficos.
6. Plan orientativo de desarrollo, sujeto a la evaluación y aprobación de la petición.
7. Siguiente paso: revisar el Mockup, definir la petición y presentarla para evaluación.

El botón «Preparar la petición de proyecto» muestra qué información deberá incluirse. No registra ni envía ninguna petición.

## Controles

| Acción | Teclado / ratón |
| --- | --- |
| Diapositiva siguiente / anterior | `→` / `←`, rueda, deslizar o menú superior |
| Diapositiva siguiente | `Espacio` / `PageDown` |
| Diapositiva anterior | `PageUp` |
| Primera / última diapositiva | `Home` / `End` |
| Pantalla completa | `F` |
| Efectos de sonido (activados por defecto) | `S` o botón del altavoz |
| Música de fondo (desactivada por defecto) | `M` o botón de la nota musical |

Se puede abrir directamente una sección con el ancla, por ejemplo `index.html#solucion`.

## Sonido

Los efectos de las animaciones y la música opcional se sintetizan en el navegador. No se reproduce ningún archivo de vídeo.

- El audio empieza tras la primera interacción, según las restricciones del navegador.
- Las preferencias de efectos y música se guardan en `localStorage`.
- Los sonidos se generan en un Web Worker para no frenar las animaciones.

## Estructura

- [index.html](index.html) y [estilos.css](estilos.css): siete diapositivas y diseño a 1600×900, escalado a la pantalla.
- [js/presentacion.js](js/presentacion.js): navegación, animaciones y contenido de la petición.
- [js/graficos.js](js/graficos.js): escenarios ilustrativos y plan orientativo.
- [js/fondo.js](js/fondo.js): fondo animado.
- [js/sintetizador.js](js/sintetizador.js) y [js/sonido.js](js/sonido.js): síntesis y reproducción de audio.
- [capturas](capturas): pantallas del Mockup.
- [vendor](vendor): GSAP y Chart.js locales para funcionar sin conexión.

## Regenerar las capturas

Con el Mockup arrancado en `http://127.0.0.1:3010` (`pnpm dev`) y los datos de demostración sin modificar:

```powershell
node presentacion\capturar.mjs
```

El script recorre las pantallas, guarda las imágenes y regenera `capturas/puntos.js`. Para otra URL usa `PRESENTACION_BASE_URL`.

Los datos, importes y cifras de impacto son ilustrativos y deben validarse con RCD. La referencia de 13–15 semanas describe un posible desarrollo desde un arranque aprobado; la petición debe concretar alcance, recursos e integraciones antes de fijar plazos.

## Regenerar el vídeo

El grabador utiliza las siete diapositivas actuales, el logotipo oficial y las capturas del Mockup. El cierre muestra el contenido de la petición de proyecto; no envía ni registra ninguna solicitud.

Requiere FFmpeg con libx264 en el PATH o la variable FFMPEG_PATH apuntando a su ejecutable:

```powershell
node presentacion/video/grabar.mjs
```

Genera dos MP4 a 1920×1080 y 30 fps, con una duración aproximada de 90 segundos:

- `video/propuesta-rcd.mp4`: música y efectos sincronizados.
- `video/propuesta-rcd-onlyfx.mp4`: los mismos fotogramas, solo con efectos.

Para revisar el recorrido sin codificar el vídeo, establecer `VIDEO_VALIDATE_ONLY=1`. Guarda un fotograma por diapositiva y los eventos de sonido en una carpeta de `video/.tmp/`. `VIDEO_FPS` permite cambiar la frecuencia y `VIDEO_OUT` la ruta de salida. El grabador comprueba las diapositivas, el logo, las capturas, los gráficos y el cierre antes del montaje final.

Los vídeos se mantienen como archivos independientes y no se cargan en la presentación web. Los MP4 y los temporales siguen excluidos de Git en [video/.gitignore](video/.gitignore). El antiguo guion [js/demo.js](js/demo.js) se conserva como material histórico y no forma parte de esta grabación.
