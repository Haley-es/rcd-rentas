// Regenera las capturas de la presentación a partir del prototipo en ejecución.
// Uso: `pnpm dev` en otra terminal y después `node presentacion/capturar.mjs`.
// Solo navega y cambia de pestaña; no modifica expedientes.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = process.env.PRESENTACION_BASE_URL ?? 'http://127.0.0.1:3010'
const out = fileURLToPath(new URL('./capturas/', import.meta.url))
const portal = (id) => `/portal/${id}?token=demo-${id}`

const shots = [
  { name: 'dashboard', path: '/', targets: { kpis: 'Expedientes activos', cta: 'Ver expedientes' } },
  { name: 'campanas', path: '/campanas', targets: { enviar: 'Enviar invitación simulada', respuestas: 'Aceptaciones' } },
  { name: 'portal-respuesta', path: portal('DEMO-R01'), targets: { hola: 'Hola, Clara Martínez', progreso: 'Tu expediente, de un vistazo' } },
  { name: 'portal-formulario', path: portal('DEMO-R01'), heading: '¿Te acompañamos en esta campaña?', targets: { honorarios: '150 €', acepto: 'Acepto recibir una propuesta de honorarios simulada, sin efectos reales.', enviar: 'Revisar mi respuesta' } },
  { name: 'expedientes', path: '/expedientes', targets: { primero: 'Clara Martínez' } },
  { name: 'ph-socio', path: '/expedientes/DEMO-72003', tab: 'Propuesta y firma', targets: { aprobar: 'Aprobar PH', estado: 'En revisión' } },
  { name: 'portal-firma', path: portal('DEMO-R04'), heading: 'Propuesta de honorarios', targets: { ph: 'Propuesta de honorarios' } },
  { name: 'validaciones-dni', path: '/expedientes/DEMO-R04', tab: 'Validaciones y alta', targets: { validar: 'Validar DNI', fecha: 'Caducidad del DNI' } },
  { name: 'validaciones-pbc', path: '/expedientes/DEMO-R06', tab: 'Validaciones y alta', targets: { continuar: 'Continuar tras revisión', nota: 'Coincidencia ficticia; pendiente de valoración humana.' } },
  { name: 'portal-documentos', path: portal('DEMO-R07'), heading: 'Documentación', targets: { subir: 'Revisar archivo real', sustituir: 'Sustituir' } },
  { name: 'documentos-revision', path: '/expedientes/DEMO-R07', tab: 'Documentación', targets: { pendiente: 'Pendientes de validar: Datos fiscales.', validar: 'Validar' } },
  { name: 'renta-borrador', path: '/expedientes/DEMO-R08', tab: 'Borrador y presentación', targets: { borrador: 'Declaración ficticia · Individual', enviar: 'Enviar borrador al cliente' } },
  { name: 'portal-borrador', path: portal('DEMO-R08'), heading: 'Tu borrador de Renta', targets: { resultado: 'A devolver 125 €', acuerdo: 'Estoy de acuerdo · simulación' } },
  { name: 'extractor-720', path: '/expedientes/DEMO-72007', tab: 'Extracción y Criteria', targets: { activar: 'Activar extractor simulado', ajuste: 'Registrar ajuste IT' } },
  { name: 'criteria-720', path: '/expedientes/DEMO-72008', tab: 'Extracción y Criteria', targets: { filas: 'Cuenta bancaria', estado: 'Revisado' } },
  { name: 'cierre', path: '/expedientes/DEMO-72009', tab: 'Presentación y cierre', targets: { factura: 'Emitir factura ficticia', cerrar: 'Cerrar expediente', justificante: 'Enviar justificante (simulado)' } },
  { name: 'tareas', path: '/tareas', targets: { evaluar: 'Evaluar seguimientos', tarjeta: 'Resolver validación PBC' } },
]

// Oculta los paneles técnicos de archivos locales del prototipo, irrelevantes para negocio.
const hideTechnicalPanels = `
  section[aria-label="Archivos locales y versiones"],
  section[aria-label="Subida real interna"] { display: none !important; }
`

const viewport = { width: 1440, height: 900 }
const points = {}

// Guarda la caja visible de cada objetivo en porcentaje, para animar el cursor de la demo.
async function measure(page, name, targets = {}) {
  points[name] = {}
  for (const [key, target] of Object.entries(targets)) {
    const locator = typeof target === 'string' ? page.getByText(target, { exact: true }) : target
    let box = null
    for (const candidate of await locator.all()) {
      const b = await candidate.boundingBox()
      if (b && b.width > 0 && b.y >= 0 && b.y + b.height <= viewport.height) { box = b; break }
    }
    if (!box) { console.warn('sin objetivo', name, key); continue }
    const pct = (value, total) => Math.round((value / total) * 10000) / 100
    points[name][key] = { x: pct(box.x, viewport.width), y: pct(box.y, viewport.height), w: pct(box.width, viewport.width), h: pct(box.height, viewport.height) }
  }
}

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'es-ES' })
const page = await context.newPage()

await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(800)
await page.screenshot({ path: `${out}login.png` })
await measure(page, 'login', { usuario: page.locator('#username'), clave: page.locator('#password'), entrar: page.locator('button[type=submit]') })
await page.fill('#username', 'demo')
await page.fill('#password', 'demo')
await page.click('button[type=submit]')
await page.waitForURL(/\/mfa/)
await page.waitForLoadState('networkidle')
await page.fill('#mfa-code', '123456')
await page.click('button[type=submit]')
await page.waitForURL((url) => !/\/(login|mfa)/.test(url.pathname))

for (const shot of shots) {
  await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle' })
  await page.locator('[data-app-ready="true"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: hideTechnicalPanels })
  await page.waitForTimeout(500)
  if (shot.tab) {
    await page.getByRole('tab', { name: shot.tab }).click()
    await page.waitForTimeout(400)
  }
  if (shot.heading) {
    const heading = page.getByRole('heading', { name: shot.heading, exact: true }).first()
    await heading.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140))
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${out}${shot.name}.png` })
  await measure(page, shot.name, shot.targets)
  console.log('ok', shot.name)
}

await writeFile(`${out}puntos.js`, `// Generado por capturar.mjs\nwindow.PUNTOS = ${JSON.stringify(points, null, 2)}\n`)
await browser.close()
