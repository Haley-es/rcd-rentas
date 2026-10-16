# Identidad visual de RCD

Referencia revisada el 16 de octubre de 2026: [web de RCD](https://www.rcd.legal/), con sus estilos [all.css](https://www.rcd.legal/css/all.css?v=9) y [styles.css](https://www.rcd.legal/css/styles.css?v=7).

## Alcance acordado

La aplicación, incluido el acceso y el portal del cliente, la landing y la presentación comparten colores y tipografías. Se conservan distribución, contenido y funciones. El logotipo oficial de RCD sustituye al símbolo anterior en las cabeceras, el pie de la landing, la vista del portal ilustrada y los favicons. Las capturas del Mockup se regeneran con la misma identidad. Los indicadores de éxito, aviso y error mantienen su significado y sus colores funcionales.

## Colores y tipografía

| Uso | Valor |
| --- | --- |
| Marca y acciones principales | Azul #243588 |
| Variante de marca y hover | Azul #22328A |
| Acentos y decoración | Celeste #79BDE1 |
| Texto principal | Carbón #1D1D1B |
| Texto secundario | Gris #626365 |
| Superficies | Blanco y gris #FAFAFA |
| Títulos | Quicksand |
| Interfaz y texto | Open Sans |
| Destacados editoriales | Arvo |

El celeste se utiliza como acento o con texto oscuro; los botones principales usan azul con texto blanco. Los colores funcionales no se deducen de la paleta de marca.

## Logotipo

Se utiliza sin modificar el [PNG publicado por RCD](https://www.rcd.legal/images/rcd.png), guardado como `public/brand/rcd-logo.png`. Se conserva su proporción cuadrada, su color y su dibujo original; se muestra sobre blanco y se incluye localmente en las tres superficies.

## Archivos y mantenimiento

La fuente común es [public/brand/rcd.css](../public/brand/rcd.css). Las seis variantes WOFF2 de [fonts.css](../public/brand/fonts.css) cubren los caracteres latinos del contenido, con pesos variables para Quicksand y Open Sans. Cada familia incluye su licencia SIL Open Font License 1.1 en la carpeta fonts.

Tras cambiar estos recursos, ejecutar:

```powershell
node scripts/sync-brand.mjs
```

El script copia los recursos a landing/brand y presentacion/brand, para poder distribuir y abrir cada web estática sin conexión ni acceso a Google Fonts. La aplicación sirve la fuente común desde /brand/rcd.css. El tema PrimeVue se define en nuxt.config.ts; los gráficos utilizan los tokens de marca.

Para actualizar las capturas, con el Mockup disponible en el puerto 3010:

```powershell
node presentacion/capturar.mjs
```
