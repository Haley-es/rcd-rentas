// Graba la presentación como vídeo MP4 (1920×1080, 30 fps) con efectos de sonido sincronizados.
//
// Usa el reloj simulado de Playwright: el tiempo de la página solo avanza 1/30 s entre capturas,
// así que las animaciones salen fluidas y cada evento `sfx` tiene la marca de tiempo exacta del vídeo.
//
// Uso: node presentacion/video/grabar.mjs
// Requiere ffmpeg con libx264 en el PATH o en la variable FFMPEG_PATH.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, writeFile, rm, rename } from 'node:fs/promises'
import { resolve, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderAudio } from './sonido.mjs'

const FPS = Number(process.env.VIDEO_FPS || 30)
if (!Number.isInteger(FPS) || FPS < 1 || FPS > 60) throw new Error('VIDEO_FPS debe ser un entero entre 1 y 60.')
const validateOnly = process.env.VIDEO_VALIDATE_ONLY === '1'
const W = 1920
const H = 1080
const here = fileURLToPath(new URL('.', import.meta.url))
const tmpRoot = resolve(here, '.tmp')
await mkdir(tmpRoot, { recursive: true })
const tmp = (await mkdtemp(`${tmpRoot}${sep}grabar-`)) + sep
async function cleanup() {
  const child = relative(tmpRoot, resolve(tmp))
  if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('Directorio temporal fuera de video/.tmp.')
  await rm(tmp, { recursive: true, force: true })
}
const out = process.env.VIDEO_OUT || `${here}propuesta-rcd.mp4`
const outFx = out.replace(/\.mp4$/i, '-onlyfx.mp4')
// Con VIDEO_REUTILIZAR=1 no se capturan fotogramas: se recalculan los eventos de sonido con el mismo
// reloj simulado y se reutiliza la pista de vídeo del MP4 existente.
const reuse = process.env.VIDEO_REUTILIZAR === '1'
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'
const deck = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000) })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}\n${err}`))))
  })
}


const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'es-ES' })
const page = await context.newPage()
const start = new Date('2026-10-16T10:00:00Z')
await page.clock.install({ time: start })
await page.clock.pauseAt(new Date(start.getTime() + 1000))
await page.addInitScript(() => {
  window.__grabandoVideo = true
  window.__sfxLog = []
  window.addEventListener('sfx', (e) => window.__sfxLog.push({ ...e.detail, t: performance.now() }))
})
const pageErrors = []
page.on('pageerror', (e) => { pageErrors.push(e.message); console.error('Error en la página:', e.message) })
await page.goto(deck)
await new Promise((r) => setTimeout(r, 1500))

// Precarga capturas y fuentes, y prepara la cortina negra y el cursor del final.
await page.evaluate(async () => {
  await document.fonts.ready
  const names = ['login', 'dashboard', 'campanas', 'portal-respuesta', 'portal-formulario', 'expedientes', 'ph-socio', 'portal-firma', 'validaciones-dni', 'validaciones-pbc', 'portal-documentos', 'documentos-revision', 'renta-borrador', 'portal-borrador', 'extractor-720', 'criteria-720', 'cierre', 'tareas']
  await Promise.all(names.map((n) => { const i = new Image(); i.src = `capturas/${n}.png`; return i.decode() }))
  const veil = document.createElement('div')
  veil.id = 'videoVeil'
  veil.style.cssText = 'position:fixed;inset:0;z-index:10000;pointer-events:none'
  veil.style.background = getComputedStyle(document.documentElement).getPropertyValue('--rcd-deep').trim()
  document.body.appendChild(veil)
  const cursor = document.createElement('div')
  cursor.id = 'videoCursor'
  cursor.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2.5 19.5 13l-7 1.4 3.9 7.3-2.7 1.4-3.9-7.3L4.8 20Z" fill="#111" stroke="#fff" stroke-width="1.4"/></svg>'
  cursor.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;pointer-events:none;opacity:0;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35));transform-origin:4px 3px'
  document.body.appendChild(cursor)
})

// Las animaciones CSS no dependen del reloj simulado: se ralentizan para acompañar al vídeo.
const cdp = await context.newCDPSession(page)
await cdp.send('Animation.enable')
async function cssRate(realMsPerFrame) {
  const rate = Math.max(0.05, Math.min(1, (1000 / FPS) / realMsPerFrame))
  await cdp.send('Animation.setPlaybackRate', { playbackRate: rate })
}
await cssRate(110)

const tmpVideo = `${tmp}video.mp4`
let ffmpeg = null
let ffDone = Promise.resolve()
if (!reuse && !validateOnly) {
  ffmpeg = spawn(ffmpegPath, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmpVideo], { stdio: ['pipe', 'ignore', 'pipe'] })
  let ffErr = ''
  ffmpeg.stderr.on('data', (d) => { ffErr = (ffErr + d).slice(-4000) })
  ffDone = new Promise((resolve, reject) => ffmpeg.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}\n${ffErr}`)))))
}

const clock0 = await page.evaluate(() => performance.now())
let frame = 0
let clockMs = 0
let lastReal = Date.now()

async function step() {
  const target = Math.round(((frame + 1) * 1000) / FPS)
  await page.clock.runFor(target - clockMs)
  clockMs = target
  if (!reuse && !validateOnly) {
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 })
    if (!ffmpeg.stdin.write(buf)) await once(ffmpeg.stdin, 'drain')
  }
  frame++
  if (frame % 30 === 0) {
    const now = Date.now()
    await cssRate((now - lastReal) / 30)
    lastReal = now
    if (frame % 300 === 0) console.log(`  ${(frame / FPS).toFixed(0)} s grabados`)
  }
}
const hold = async (seconds) => { for (let i = Math.round(seconds * FPS); i > 0; i--) await step() }
const key = (k) => page.keyboard.press(k)
// Se envuelve para no devolver objetos GSAP: serializarlos bloquea page.evaluate.
const animate = (fn) => page.evaluate(`(${fn})(); undefined`)

console.log(validateOnly ? 'Validando el guion…' : 'Grabando…')
await animate(() => gsap.to('#videoVeil', { opacity: 0, duration: 1.2, ease: 'power2.out' }))
const chapters = [
  ['portada', 10], ['reto', 12], ['solucion', 14], ['reglas', 14],
  ['impacto', 12], ['plan', 12], ['siguiente', 5],
]
for (let i = 0; i < chapters.length; i++) {
  const [id, seconds] = chapters[i]
  if (i) await key('ArrowRight')
  await hold(seconds)
  await page.evaluate((expected) => {
    const active = document.querySelector('.slide.is-active')
    if (active?.dataset.id !== expected) throw new Error('Diapositiva inesperada: ' + active?.dataset.id)
    const logo = document.querySelector('.brand .rcd-logo')
    if (!logo?.complete || logo.naturalWidth !== 190) throw new Error('Logotipo oficial no disponible.')
    if ([...document.images].some(image => !image.complete || !image.naturalWidth)) throw new Error('Hay capturas sin cargar.')
    const charts = Object.values(Chart.instances)
    if (expected === 'impacto' && charts.length !== 3) throw new Error('Faltan gráficos de impacto.')
    if (expected === 'plan' && charts.length !== 1) throw new Error('Falta el gráfico del plan.')
  }, id)
  if (validateOnly) await page.screenshot({ path: tmp + (i + 1) + '-' + id + '.png' })
  console.log('  Capítulo ' + (i + 1) + '/' + chapters.length + ': ' + id)
}
await animate(() => {
  const btn = document.getElementById('btnRequest').getBoundingClientRect()
  const cur = document.getElementById('videoCursor')
  gsap.set(cur, { x: window.innerWidth * 0.72, y: window.innerHeight * 0.9, opacity: 0 })
  gsap.to(cur, { opacity: 1, duration: 0.3 })
  gsap.to(cur, { x: btn.left + btn.width * 0.55, y: btn.top + btn.height * 0.5, duration: 1.1, ease: 'power2.inOut' })
})
await hold(1.25)
await animate(() => {
  gsap.to('#videoCursor', { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1 })
  document.getElementById('btnRequest').click()
})
await hold(1)
await animate(() => gsap.to('#videoCursor', { opacity: 0, duration: 0.4 }))
await hold(7.5)
await animate(() => gsap.to('#videoVeil', { opacity: 1, duration: 1.3, ease: 'power2.in' }))
await hold(1.6)

const expanded = await page.locator('#btnRequest').getAttribute('aria-expanded')
if (expanded !== 'true') throw new Error('El cierre no mostró el contenido de la petición.')
if (pageErrors.length) throw new Error(pageErrors.join('\n'))
ffmpeg?.stdin.end()
await ffDone
const events = (await page.evaluate(() => window.__sfxLog)).map((e) => ({ ...e, t: (e.t - clock0) / 1000 })).filter((e) => e.t >= 0)
await browser.close()

const duration = frame / FPS
console.log(`Vídeo: ${frame} fotogramas (${duration.toFixed(1)} s), ${events.length} efectos de sonido`)
await writeFile(`${tmp}eventos.json`, JSON.stringify(events, null, 1))

if (validateOnly) {
  await writeFile(tmp + 'validacion.json', JSON.stringify({ duration, frames: frame, chapters, events: events.length, errors: pageErrors }, null, 2))
  console.log('Guion correcto; fotogramas de control en ' + tmp)
  process.exit(0)
}

const videoSource = reuse ? `${tmp}video-reutilizado.mp4` : tmpVideo
if (reuse) await run(['-y', '-i', out, '-map', '0:v:0', '-c', 'copy', videoSource])

for (const [file, music, label] of [[out, true, 'con música'], [outFx, false, 'solo efectos']]) {
  console.log(`Sintetizando audio (${label})…`)
  const tmpAudio = `${tmp}audio-${music ? 'musica' : 'fx'}.wav`
  await renderAudio(events, duration, tmpAudio, { music })
  console.log(`Montando ${file}…`)
  await run(['-y', '-i', videoSource, '-i', tmpAudio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', `${file}.part.mp4`])
  await rename(`${file}.part.mp4`, file)
}
if (!process.env.VIDEO_KEEP_TMP) await cleanup()
console.log(`Listo:\n  ${out}\n  ${outFx}`)
