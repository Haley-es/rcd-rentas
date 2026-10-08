// Sonido de la presentación en el navegador (Web Audio).
// - La presentación llama a window.sfx(nombre, datos) en cada animación. Se emite el evento `sfx`
//   (lo usa el grabador de vídeo) y, si los efectos están activos, se reproduce el efecto.
// - Los efectos y el bucle musical se sintetizan en un Web Worker con el mismo sintetizador que el
//   vídeo (js/sintetizador.js), para no congelar las animaciones. Se pre-generan al iniciar el audio.
// - Preferencias por defecto: efectos activados y música desactivada; se recuerdan en localStorage.
(function () {
  const STORAGE = 'rcd-presentacion-sonido'
  const GAIN = 3.2
  const MUSIC_LOOP = 16
  const PREROLL = 0.2
  const SILENT = new Set(['move'])
  // Datos de cada evento que cambian el sonido; el resto (p. ej. número de palabras) no se usa.
  const KEY_FIELDS = ['kind', 'view', 'dir', 'index', 'chars', 'duration']
  // Efectos habituales de la presentación, generados de antemano en segundo plano.
  const WARMUP = [
    ['click'], ['caption'], ['screen'], ['highlight'], ['whoosh', { dir: 1 }], ['whoosh', { dir: -1 }],
    ['toast', { kind: 'team' }], ['toast', { kind: 'auto' }], ['toast', { kind: 'client' }], ['toast', { kind: 'warn' }],
    ['wipe', { view: 'client' }], ['wipe', { view: 'team' }], ['zoom-in'], ['zoom-out'], ['stamp', { kind: 'ok' }], ['stamp', { kind: 'warn' }],
    ['title'], ['swoosh'], ['sparkle'], ['impact'], ['count', { duration: 1.4 }], ['check'], ['send'], ['scan', { duration: 1.8 }],
    ['upload', { duration: 1.5 }], ['done'], ['draw', { duration: 1.6 }], ['draw', { duration: 2 }], ['chart', { duration: 1.6 }],
    ['success-soft'], ['success'], ['confetti'], ['pop'], ['type', { chars: 22, duration: 1.32 }], ['type', { chars: 10, duration: 0.6 }],
    ...Array.from({ length: 8 }, (_, i) => ['pop', { index: i }]),
    ...Array.from({ length: 10 }, (_, i) => ['tick', { index: i }]),
    ...Array.from({ length: 4 }, (_, i) => ['flip', { index: i }]),
  ]
  // El grabador de vídeo sintetiza el audio por su cuenta; en ese caso la web no reproduce nada.
  const recording = !!window.__grabandoVideo

  const prefs = { efectos: true, musica: false }
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(STORAGE)) || {}) } catch { /* sin preferencias guardadas */ }
  const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(prefs)) } catch { /* almacenamiento no disponible */ } }

  // ---- Síntesis (se ejecuta en el worker o, si no hay workers, en el hilo principal) -------

  // Devuelve { L, R } recortados al final audible, o null si el efecto no suena.
  function renderEffect(synth, name, detail, preroll) {
    const long = ['success', 'confetti', 'success-soft', 'done', 'toast', 'stamp', 'chart', 'highlight', 'wipe', 'title', 'check', 'caption'].includes(name)
    const bus = new synth.Bus((long ? 7 : 3.5) + (detail.duration || 0))
    synth.play(bus, Object.assign({}, detail, { name, t: preroll }))
    let end = bus.n
    while (end > 0 && Math.abs(bus.L[end - 1]) < 1e-4 && Math.abs(bus.R[end - 1]) < 1e-4) end--
    if (end <= preroll * synth.SR) return null
    return { L: bus.L.slice(0, end), R: bus.R.slice(0, end) }
  }

  // Bucle de `loop` segundos: el final (con la cola de reverberación) se suma al principio para enlazar sin corte.
  function renderMusicLoop(synth, loop) {
    const bus = new synth.Bus(loop + 4)
    synth.music(bus, { start: 0, end: loop, fade: 0 })
    const L = synth.reverb(bus.L, { wet: 0.3 })
    const R = synth.reverb(bus.R, { wet: 0.3, size: 1.04 })
    const n = Math.round(loop * synth.SR)
    for (let i = n; i < L.length; i++) { L[i - n] += L[i]; R[i - n] += R[i] }
    return { L: L.slice(0, n), R: R.slice(0, n) }
  }

  function workerSource() {
    return `const crear = ${window.SintesisRCD.crear.toString()}
const renderEffect = ${renderEffect.toString()}
const renderMusicLoop = ${renderMusicLoop.toString()}
let synth = null
self.onmessage = (e) => {
  const m = e.data
  if (!synth || synth.SR !== m.sr) synth = crear(m.sr)
  const r = m.type === 'music' ? renderMusicLoop(synth, m.loop) : renderEffect(synth, m.name, m.detail, m.preroll)
  self.postMessage({ id: m.id, r }, r ? [r.L.buffer, r.R.buffer] : [])
}`
  }

  // ---- Motor de audio ------------------------------------------------------------------------

  let ctx = null
  let fxIn = null
  let duck = null
  let musicOut = null
  let musicSource = null
  let musicPending = null
  let silence = 0
  let worker = null
  let localSynth = null
  let nextId = 1
  const waiting = new Map()
  const cache = new Map()

  function startWorker() {
    try {
      const url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }))
      worker = new Worker(url)
      worker.onmessage = (e) => {
        const done = waiting.get(e.data.id)
        waiting.delete(e.data.id)
        if (done) done(e.data.r)
      }
      worker.onerror = () => {
        worker = null
        for (const [id, done] of waiting) { waiting.delete(id); done(undefined) }
      }
    } catch {
      worker = null
    }
  }

  // Sintetiza en el worker; si no está disponible, en el hilo principal.
  function synthesize(msg) {
    const local = () => {
      localSynth = localSynth || window.SintesisRCD.crear(ctx.sampleRate)
      return msg.type === 'music' ? renderMusicLoop(localSynth, msg.loop) : renderEffect(localSynth, msg.name, msg.detail, msg.preroll)
    }
    if (!worker) return Promise.resolve(local())
    return new Promise((resolve) => {
      const id = nextId++
      waiting.set(id, (r) => resolve(r === undefined ? local() : r))
      worker.postMessage({ ...msg, id, sr: ctx.sampleRate })
    })
  }

  function toBuffer(r) {
    if (!r) return null
    const buffer = ctx.createBuffer(2, r.L.length, ctx.sampleRate)
    buffer.copyToChannel(r.L, 0)
    buffer.copyToChannel(r.R, 1)
    return buffer
  }

  function keyOf(name, detail) {
    return name + KEY_FIELDS.map((k) => (detail[k] === undefined ? '' : `|${k}=${detail[k]}`)).join('')
  }

  function effectBuffer(name, detail = {}) {
    const key = keyOf(name, detail)
    if (!cache.has(key)) {
      const clean = {}
      for (const k of KEY_FIELDS) if (detail[k] !== undefined) clean[k] = detail[k]
      cache.set(key, synthesize({ type: 'effect', name, detail: clean, preroll: PREROLL }).then(toBuffer))
    }
    return cache.get(key)
  }

  function impulse(seconds, decay) {
    const len = Math.round(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  function ensureContext() {
    if (ctx || recording) return ctx
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC || !window.SintesisRCD) return null
    ctx = new AC({ latencyHint: 'interactive' })

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -4
    limiter.knee.value = 4
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.2
    limiter.connect(ctx.destination)

    fxIn = ctx.createGain()
    fxIn.gain.value = GAIN
    const verb = ctx.createConvolver()
    verb.buffer = impulse(1.6, 3)
    const wet = ctx.createGain()
    wet.gain.value = 0.12
    fxIn.connect(limiter)
    fxIn.connect(verb).connect(wet).connect(limiter)

    musicOut = ctx.createGain()
    musicOut.gain.value = 0
    duck = ctx.createGain()
    duck.connect(musicOut).connect(limiter)

    startWorker()
    warmup()
    return ctx
  }

  // Pre-genera los efectos habituales de uno en uno para dejar paso a los que se piden al momento.
  function warmup() {
    const queue = WARMUP.slice()
    const next = () => {
      if (!queue.length) return
      const [name, detail] = queue.shift()
      effectBuffer(name, detail).then(() => setTimeout(next, worker ? 0 : 30))
    }
    next()
  }

  // Primer gesto del usuario: los navegadores solo permiten audio después de una interacción.
  function unlock() {
    if (!ensureContext()) return
    if (ctx.state === 'suspended') ctx.resume()
    if (prefs.musica) startMusic()
  }
  for (const type of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, unlock, { capture: true, passive: true })

  function playEffect(name, detail) {
    if (!ctx || ctx.state !== 'running' || SILENT.has(name)) return
    const requested = ctx.currentTime
    effectBuffer(name, detail).then((buffer) => {
      if (!buffer || !prefs.efectos) return
      // Si llega tarde (efecto nuevo aún sin generar), se salta el retraso para mantener la sincronía.
      const late = Math.max(0, ctx.currentTime - requested)
      const offset = PREROLL + late
      if (offset > buffer.duration - 0.05) return
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(fxIn)
      src.start(ctx.currentTime, offset)
      // La música baja un poco mientras suena el efecto.
      const now = ctx.currentTime
      duck.gain.cancelScheduledValues(now)
      duck.gain.setTargetAtTime(0.7, now, 0.02)
      duck.gain.setTargetAtTime(1, now + 0.35, 0.45)
    })
  }

  function startMusic() {
    if (!ctx || musicSource) return
    updateButtons('cargando')
    musicPending = musicPending || synthesize({ type: 'music', loop: MUSIC_LOOP }).then(toBuffer)
    musicPending.then((buffer) => {
      if (!prefs.musica || musicSource || !buffer) { updateButtons(); return }
      musicSource = ctx.createBufferSource()
      musicSource.buffer = buffer
      musicSource.loop = true
      musicSource.connect(duck)
      musicSource.start()
      const now = ctx.currentTime
      musicOut.gain.cancelScheduledValues(now)
      musicOut.gain.setValueAtTime(musicOut.gain.value, now)
      musicOut.gain.linearRampToValueAtTime(GAIN, now + 1.5)
      updateButtons()
    })
  }

  function stopMusic() {
    if (!ctx || !musicSource) return
    const src = musicSource
    musicSource = null
    const now = ctx.currentTime
    musicOut.gain.cancelScheduledValues(now)
    musicOut.gain.setValueAtTime(musicOut.gain.value, now)
    musicOut.gain.linearRampToValueAtTime(0, now + 0.6)
    src.stop(now + 0.65)
  }

  // ---- Controles -----------------------------------------------------------------------------

  function setEffects(on) {
    prefs.efectos = on
    save()
    updateButtons()
    if (on) { unlock(); window.sfx('click') }
  }

  function setMusic(on) {
    prefs.musica = on
    save()
    if (on) unlock()
    else stopMusic()
    updateButtons()
  }

  function updateButtons(state) {
    const fx = document.getElementById('btnSfx')
    const mu = document.getElementById('btnMusic')
    if (fx) {
      fx.setAttribute('aria-pressed', String(prefs.efectos))
      fx.querySelector('use').setAttribute('href', prefs.efectos ? '#i-sound' : '#i-sound-off')
      fx.title = `Efectos de sonido: ${prefs.efectos ? 'activados' : 'desactivados'} (S)`
    }
    if (mu) {
      mu.setAttribute('aria-pressed', String(prefs.musica))
      mu.classList.toggle('is-off', !prefs.musica)
      mu.classList.toggle('is-loading', state === 'cargando')
      mu.title = `Música de fondo: ${prefs.musica ? 'activada' : 'desactivada'} (M)`
    }
  }

  window.sfx = function (name, detail = {}) {
    if (silence > 0) return
    window.dispatchEvent(new CustomEvent('sfx', { detail: { name, ...detail } }))
    if (prefs.efectos) playEffect(name, detail)
  }

  window.Sonido = {
    // Ejecuta fn sin sonidos: para saltos de la demo, que disparan de golpe los eventos intermedios.
    silenciar(fn) { silence++; try { return fn() } finally { silence-- } },
    alternarEfectos: () => setEffects(!prefs.efectos),
    alternarMusica: () => setMusic(!prefs.musica),
    get estado() { return { ...prefs, contexto: ctx ? ctx.state : 'sin iniciar', musicaSonando: !!musicSource, worker: !!worker } },
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnSfx')?.addEventListener('click', () => window.Sonido.alternarEfectos())
    document.getElementById('btnMusic')?.addEventListener('click', () => window.Sonido.alternarMusica())
    updateButtons()
  })
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return
    if (e.key === 's' || e.key === 'S') window.Sonido.alternarEfectos()
    if (e.key === 'm' || e.key === 'M') window.Sonido.alternarMusica()
  })
})()
