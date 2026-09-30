// Demo guiada del ciclo completo sobre capturas reales del prototipo.
// Todo se construye en una única línea de tiempo GSAP para poder pausar, saltar y reiniciar.
(function () {
  const PUNTOS = window.PUNTOS || {}
  const $ = (id) => document.getElementById(id)

  const PHASES = [
    'Arranque de campaña',
    'Respuesta del cliente',
    'Propuesta de honorarios',
    'Validaciones, PBC y alta',
    'Documentación',
    'Renta: borrador',
    '720: extracción y Criteria',
    'Presentación y cierre',
  ]

  const TEAM = 'campanas.rcd.legal'
  const PORTAL = 'portal.rcd.legal'

  // Situación de una campaña de ejemplo (240 contactos) al llegar a cada paso.
  // bars = Captación, Honorarios, Validaciones, Documentación, Elaboración, Cerrados.
  const SNAP = [
    [0, [0, 0, 0, 0, 0, 0]],
    [0, [0, 0, 0, 0, 0, 0]],
    [0, [240, 0, 0, 0, 0, 0]],
    [96, [144, 96, 0, 0, 0, 0]],
    [132, [108, 132, 0, 0, 0, 0]],
    [158, [82, 158, 0, 0, 0, 0]],
    [171, [69, 120, 51, 0, 0, 0]],
    [180, [60, 72, 108, 0, 0, 0]],
    [186, [54, 40, 96, 50, 0, 0]],
    [190, [50, 22, 70, 98, 0, 0]],
    [194, [46, 12, 40, 110, 32, 0]],
    [197, [43, 6, 22, 96, 73, 0]],
    [199, [41, 3, 12, 70, 110, 4]],
    [201, [39, 2, 6, 44, 122, 27]],
    [202, [38, 1, 3, 28, 108, 62]],
    [203, [37, 0, 2, 15, 92, 94]],
    [204, [36, 0, 1, 6, 58, 139]],
    [205, [35, 0, 0, 2, 26, 177]],
  ]

  const STEPS = [
    {
      shot: 'login', phase: 0, url: `${TEAM}/login`, view: 'team', actor: ['Equipo RCD', 'team'],
      title: 'Acceso seguro del equipo',
      text: 'Cada persona entra con su cuenta y doble factor, y ve exactamente lo que su perfil necesita: socio, profesional, altas, PBC o IT.',
      run: (b) => {
        b.type('usuario', 'lucia.torres@rcd.legal')
        b.type('clave', '••••••••••')
        b.click('entrar')
        b.toast('i-lock', 'Identidad verificada', 'Doble factor completado', 'team')
      },
    },
    {
      shot: 'dashboard', phase: 0, url: `${TEAM}/`, view: 'team', actor: ['Profesional', 'team'],
      title: 'Toda la campaña, de un vistazo',
      text: 'Indicadores en tiempo real, distribución por fase y los expedientes que necesitan atención. Sin hojas de cálculo paralelas.',
      run: (b) => {
        b.zoom('kpis', 1.35, 0.5, 2)
        b.hl('kpis', { pad: 0.6, w: 4.1 })
        b.wait(1.6)
        b.unzoom()
        b.move('cta')
      },
    },
    {
      shot: 'campanas', phase: 0, url: `${TEAM}/comunicacion`, view: 'team', actor: ['Gestor de campañas', 'team'],
      title: 'Lanzamos la campaña en un clic',
      text: 'Invitaciones segmentadas por tipo de cliente y campaña. Si no hay respuesta: recordatorio automático a los 7 días y aviso para llamar a los 3 días.',
      run: (b) => {
        b.click('enviar')
        b.envelopes('enviar')
        b.toast('i-send', '240 invitaciones enviadas', 'Renta y 720 · listas segmentadas', 'auto')
        b.wait(1.2)
        b.toast('i-clock', 'Recordatorios programados', 'A los 7 días y llamada a los 3 días', 'auto')
        b.hl('respuestas', { pad: 1 })
      },
    },
    {
      shot: 'portal-respuesta', phase: 1, url: `${PORTAL}/DEMO-R01`, view: 'client', actor: ['Cliente', 'client'],
      title: 'El cliente entra en su espacio personal',
      text: 'Un enlace único le lleva a su portal: ve a su profesional responsable, el siguiente paso y el progreso de su expediente.',
      run: (b) => {
        b.zoom('hola', 1.3, 0.8, 1.2)
        b.wait(1.2)
        b.unzoom()
        b.hl('progreso', { pad: 0.8, w: 38, h: 3.5 })
        b.move('progreso', 0.8, 5)
      },
    },
    {
      shot: 'portal-formulario', phase: 1, url: `${PORTAL}/DEMO-R01#respuesta`, view: 'client', actor: ['Cliente', 'client'],
      title: 'Responde en dos minutos',
      text: 'Indica el tipo de declaración y quién la presenta. Los honorarios orientativos se calculan al momento y acepta recibir la propuesta.',
      run: (b) => {
        b.hl('honorarios', { pad: 1.2 })
        b.wait(0.6)
        b.check('acepto')
        b.click('enviar')
        b.toast('i-layers', 'Expediente creado automáticamente', 'DEMO-R01 · Renta 2025 · asignado', 'auto')
        b.wait(1.4)
        b.toast('i-chat', 'Aviso por Teams', 'Lucía Torres: tu cliente ha aceptado', 'team')
      },
    },
    {
      shot: 'expedientes', phase: 1, url: `${TEAM}/expedientes`, view: 'team', actor: ['Profesional', 'team'],
      title: 'Nace un expediente único',
      text: 'Sin duplicados ni reenvíos: el expediente aparece asignado a su responsable, con búsqueda y filtros por campaña, fase y responsable.',
      run: (b) => {
        b.badge('primero', 'Nuevo')
        b.hl('primero', { pad: 0.8, w: 52 })
        b.wait(0.6)
        b.click('primero')
      },
    },
    {
      shot: 'ph-socio', phase: 2, url: `${TEAM}/expedientes/DEMO-72003`, view: 'team', actor: ['Socio', 'team'],
      title: 'El socio revisa la propuesta de honorarios',
      text: 'La PH se genera con los datos del formulario, pero nunca sale sola: el socio la aprueba, pide cambios o la edita.',
      run: (b) => {
        b.hl('estado', { pad: 0.6 })
        b.wait(0.4)
        b.click('aprobar')
        b.stamp('Aprobada', 43, 67, 'i-check')
        b.toast('i-send', 'PH enviada al cliente', 'Envío manual del profesional · versión 1', 'team')
      },
    },
    {
      shot: 'portal-firma', phase: 2, url: `${PORTAL}/DEMO-R04#propuesta`, view: 'client', actor: ['Cliente', 'client'],
      title: 'Firma desde su portal',
      text: 'El cliente revisa y firma la versión vigente. Si la rechaza, el profesional la renegocia creando una nueva versión.',
      run: (b) => {
        b.zoom('ph', 1.25, 1.2, 8)
        b.move('ph', 0.5, 9)
        b.wait(0.8)
        b.unzoom()
        b.stamp('Firmada', 32, 44, 'i-pen')
        b.toast('i-pen', 'Propuesta firmada', 'Firma electrónica · versión 1', 'client')
      },
    },
    {
      shot: 'validaciones-dni', phase: 3, url: `${TEAM}/expedientes/DEMO-R04`, view: 'team', actor: ['Profesional', 'team'],
      title: 'Validaciones previas, sin sorpresas',
      text: 'DNI vigente por las dos caras, certificado y autorización. Si el DNI está caducado, el expediente se bloquea y se pide uno nuevo.',
      run: (b) => {
        b.zoom('fecha', 1.45, 1.2, 3)
        b.hl('fecha', { pad: 0.6, w: 16, h: 6 })
        b.stamp('DNI caducado', 38, 76, 'i-alert', 'warn')
        b.toast('i-alert', 'Avance bloqueado', 'Se solicita un DNI vigente al cliente', 'warn')
        b.wait(0.8)
        b.unzoom()
        b.click('validar')
      },
    },
    {
      shot: 'validaciones-pbc', phase: 3, url: `${TEAM}/expedientes/DEMO-R06`, view: 'team', actor: ['PBC · Altas', 'team'],
      title: 'PBC y alta en NAV con control humano',
      text: 'Los filtros PBC señalan coincidencias y el departamento decide con una nota. Después, Altas registra el cliente en NAV.',
      run: (b) => {
        b.hl('nota', { pad: 1.2, w: 25 })
        b.wait(0.8)
        b.click('continuar')
        b.toast('i-shield', 'PBC resuelto', 'Valoración registrada con nota', 'team')
        b.wait(1.3)
        b.toast('i-db', 'Alta en NAV registrada', 'Referencia manual · aviso a paralegal', 'team')
      },
    },
    {
      shot: 'portal-documentos', phase: 4, url: `${PORTAL}/DEMO-R07#documentacion`, view: 'client', actor: ['Cliente', 'client'],
      title: 'El cliente aporta su documentación',
      text: 'Sube PDF, imágenes, Word o Excel por tipo de documento. Ve qué falta o qué debe sustituir, y entrega cuando ha terminado.',
      run: (b) => {
        b.hl('sustituir', { pad: 0.8 })
        b.wait(0.4)
        b.click('subir')
        b.upload('subir', 'datos-fiscales-2025.pdf')
        b.toast('i-upload', 'Documentación entregada', 'Aviso inmediato a su profesional', 'client')
      },
    },
    {
      shot: 'documentos-revision', phase: 4, url: `${TEAM}/expedientes/DEMO-R07`, view: 'team', actor: ['Profesional', 'team'],
      title: 'Revisión documental con versiones',
      text: 'Cada archivo conserva sus versiones. El profesional valida, pide sustituciones y confirma cuándo el conjunto está completo.',
      run: (b) => {
        b.hl('pendiente', { pad: 0.6 })
        b.wait(0.6)
        b.click('validar')
        b.toast('i-check-circle', 'Documentación completa', 'Lista para preparar la declaración', 'team')
      },
    },
    {
      shot: 'renta-borrador', phase: 5, url: `${TEAM}/expedientes/DEMO-R08`, view: 'team', actor: ['Profesional', 'team'],
      title: 'Preparación del borrador de Renta',
      text: 'El profesional prepara versiones del borrador y lo envía al cliente. Cambiar la versión invalida cualquier aceptación anterior.',
      run: (b) => {
        b.hl('borrador', { pad: 1.4, w: 43 })
        b.wait(0.6)
        b.click('enviar')
        b.toast('i-send', 'Borrador v1 enviado', 'El cliente recibe un aviso para revisarlo', 'team')
      },
    },
    {
      shot: 'portal-borrador', phase: 5, url: `${PORTAL}/DEMO-R08#borrador`, view: 'client', actor: ['Cliente', 'client'],
      title: 'El cliente acepta el resultado',
      text: 'Ve el resumen del borrador y lo acepta o pide revisión desde su portal. Queda registrada la versión exacta que ha aceptado.',
      run: (b) => {
        b.zoom('resultado', 1.4, 0.8, 1.2)
        b.wait(1.1)
        b.unzoom()
        b.click('acuerdo')
        b.stamp('Aceptado', 36, 52, 'i-check')
        b.toast('i-check-circle', 'Borrador aceptado', 'Versión 1 · listo para presentar', 'client')
      },
    },
    {
      shot: 'extractor-720', phase: 6, url: `${TEAM}/expedientes/DEMO-72007`, view: 'team', actor: ['Profesional + IA', 'auto'],
      title: 'Modelo 720: extracción asistida por IA',
      text: 'El extractor lee la documentación de bienes en el extranjero y genera un Excel revisable. Un fallo técnico va a IT, separado de PBC.',
      run: (b) => {
        b.click('activar')
        b.scan()
        b.toast('i-alert', 'Incidencia IT', 'DEMO-IT-007 · formato no reconocido', 'warn')
        b.wait(1)
        b.click('ajuste')
        b.toast('i-cpu', 'Ajuste IT registrado', 'Se reintenta la extracción', 'auto')
      },
    },
    {
      shot: 'criteria-720', phase: 6, url: `${TEAM}/expedientes/DEMO-72008`, view: 'team', actor: ['Profesional', 'team'],
      title: 'Excel revisado y carga en Criteria',
      text: 'El profesional revisa y corrige las filas extraídas y registra la carga manual en Criteria con versión, fecha y referencia.',
      run: (b) => {
        b.zoom('filas', 1.3, 0.5, 6)
        b.hl('filas', { pad: 0.6, dx: -44, w: 75.5, h: 21 })
        b.wait(1.2)
        b.unzoom()
        b.toast('i-check-circle', 'Excel validado', '3 bienes · versión 1', 'team')
        b.wait(1.2)
        b.toast('i-db', 'Carga en Criteria registrada', 'Versión vigente · referencia manual', 'team')
      },
    },
    {
      shot: 'cierre', phase: 7, url: `${TEAM}/expedientes/DEMO-72009`, view: 'team', actor: ['Profesional · Administración', 'team'],
      title: 'Presentación, justificante y factura',
      text: 'Se registra la presentación y se envían justificante y factura. El expediente solo se cierra cuando todo está completo.',
      run: (b) => {
        b.click('justificante')
        b.toast('i-file', 'Justificante enviado', 'Presentación 720-DEMO-009', 'team')
        b.wait(0.4)
        b.click('factura')
        b.toast('i-euro', 'Factura emitida y enviada', 'Minuta del expediente', 'team')
        b.wait(0.4)
        b.click('cerrar')
        b.burst('cerrar')
        b.stamp('Cerrado', 44, 70, 'i-check')
      },
    },
    {
      shot: 'tareas', phase: 7, url: `${TEAM}/tareas`, view: 'team', actor: ['Seguimiento automático', 'auto'],
      title: 'Nada se queda atrás',
      text: 'Bandejas de tareas por perfil y seguimientos automáticos: recordatorios, llamadas pendientes e incidencias, siempre con el siguiente paso claro.',
      run: (b) => {
        b.click('evaluar')
        b.toast('i-bell', '12 recordatorios enviados', '3 llamadas asignadas a sus responsables', 'auto')
        b.hl('tarjeta', { pad: 1.6, dy: -4, w: 23.5, h: 23 })
        b.move('tarjeta', 0.5, 3)
      },
    },
  ]

  const els = {}
  let tl = null
  let chart = null
  let starts = []
  let feedEvents = []
  let current = -1
  let shownFeed = -1
  let speedIdx = 0
  const speeds = [1, 1.5, 2, 0.75]
  const kpiState = { inv: 0, resp: 0, act: 0, close: 0 }

  // Constructor de acciones de un paso. Gestiona su propio reloj para permitir acciones solapadas.
  function Builder(st, step, index) {
    this.st = st
    this.step = step
    this.index = index
    this.pts = PUNTOS[step.shot] || {}
    this.t = 0
    this.fx = []
    this.toasts = []
    this.zoomed = false
    this.feed = []
    this.avoid = []
  }

  // Coloca el rótulo en la esquina que menos tapa los elementos que se señalan en el paso.
  const CAPTION_SPOTS = {
    bl: { x: 1.6, y: 72, w: 45.5, h: 25.5 },
    br: { x: 52.9, y: 72, w: 45.5, h: 25.5 },
    tl: { x: 1.6, y: 2.6, w: 45.5, h: 25.5 },
  }
  // Zona de título de las pantallas internas: mejor no taparla si hay alternativa.
  const TEAM_HEADER = { x: 15, y: 14, w: 40, h: 17 }
  function overlap(a, b) {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    return w > 0 && h > 0 ? w * h : 0
  }
  function captionSpot(shot, extra) {
    const boxes = [...Object.values(PUNTOS[shot] || {}), ...extra]
    let best = 'bl'
    let bestScore = Infinity
    for (const [name, spot] of Object.entries(CAPTION_SPOTS)) {
      const score = boxes.reduce((sum, b) => sum + overlap(spot, b), 0)
      if (score < bestScore - 0.5) { best = name; bestScore = score }
    }
    return best
  }

  Builder.prototype.point = function (key, fx = 0.5, fy = 0.5) {
    const p = this.pts[key]
    if (!p) { console.warn('Demo: falta el punto', this.step.shot, key); return null }
    return { x: p.x + p.w * fx, y: p.y + p.h * fy, box: p }
  }

  Builder.prototype.el = function (cls, html = '') {
    const node = document.createElement('div')
    node.className = cls
    node.innerHTML = html
    els.fx.appendChild(node)
    return node
  }

  Builder.prototype.wait = function (s) { this.t += s }

  // Programa un efecto de sonido en la línea de tiempo del paso (no se dispara al saltar con la barra).
  Builder.prototype.sfx = function (name, at = this.t, detail = {}) {
    this.st.call(() => window.sfx(name, detail), null, at)
  }

  Builder.prototype.move = function (key, fx = 0.5, dy = 0) {
    const p = this.point(key, fx)
    if (!p) return
    this.sfx('move', this.t, { duration: 0.9 })
    this.st.to(els.cursor, { left: `${p.x}%`, top: `${p.y + dy}%`, duration: 0.9, ease: 'power2.inOut' }, this.t)
    this.t += 0.95
  }

  Builder.prototype.click = function (key) {
    const p = this.point(key)
    if (!p) return
    this.move(key)
    const ripple = this.el('ripple')
    gsap.set(ripple, { left: `${p.x}%`, top: `${p.y}%` })
    this.st.to(els.cursor, { scale: 0.8, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, this.t)
    this.sfx('click', this.t + 0.05)
    this.st.fromTo(ripple, { autoAlpha: 0.95, scale: 0.3 }, { autoAlpha: 0, scale: 1.9, duration: 0.7, ease: 'power2.out', immediateRender: false }, this.t + 0.05)
    this.t += 0.45
  }

  Builder.prototype.hl = function (key, o = {}) {
    const p = this.point(key, 0, 0)
    if (!p) return
    const pad = o.pad ?? 0.6
    const b = p.box
    const box = this.el('hl')
    const rect = { x: b.x - pad + (o.dx || 0), y: b.y - pad * 1.6 + (o.dy || 0), w: (o.w ?? b.w) + pad * 2, h: (o.h ?? b.h) + pad * 3.2 }
    this.avoid.push(rect)
    gsap.set(box, { left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` })
    this.st.fromTo(box, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, this.t)
    this.sfx('highlight')
    this.fx.push(box)
    this.t += 0.5
  }

  Builder.prototype.type = function (key, text) {
    const p = this.point(key, 0, 0)
    if (!p) return
    this.move(key, 0.15)
    const b = p.box
    const node = this.el('typed')
    gsap.set(node, { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` })
    const proxy = { n: 0 }
    this.st.set(node, { autoAlpha: 1 }, this.t)
    this.sfx('type', this.t, { chars: text.length, duration: Math.min(1.4, text.length * 0.06) })
    this.st.fromTo(proxy, { n: 0 }, {
      n: text.length, duration: Math.min(1.4, text.length * 0.06), ease: 'none',
      onUpdate: () => { node.firstChild ? (node.firstChild.nodeValue = text.slice(0, Math.round(proxy.n))) : node.appendChild(document.createTextNode(text.slice(0, Math.round(proxy.n)))) },
    }, this.t)
    this.fx.push(node)
    this.t += Math.min(1.4, text.length * 0.06) + 0.2
  }

  Builder.prototype.check = function (key) {
    const p = this.point(key, 0)
    if (!p) return
    const x = p.box.x - 1.45
    const mark = this.el('check-mark', '<svg><use href="#i-check"/></svg>')
    gsap.set(mark, { left: `${x}%`, top: `${p.y}%`, xPercent: -50, yPercent: -50 })
    this.st.to(els.cursor, { left: `${x}%`, top: `${p.y}%`, duration: 0.8, ease: 'power2.inOut' }, this.t)
    this.st.fromTo(mark, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, this.t + 0.85)
    this.sfx('check', this.t + 0.85)
    this.fx.push(mark)
    this.t += 1.3
  }

  Builder.prototype.zoom = function (key, scale, fx = 0.5, dy = 0) {
    const p = this.point(key, fx)
    if (!p) return
    this.st.set(els.zoom, { transformOrigin: `${p.x}% ${p.y + dy}%` }, this.t)
    this.st.to(els.zoom, { scale, duration: 1.1, ease: 'power3.inOut' }, this.t)
    this.sfx('zoom-in')
    this.zoomed = true
    this.t += 0.9
  }

  Builder.prototype.unzoom = function () {
    this.st.to(els.zoom, { scale: 1, duration: 0.9, ease: 'power3.inOut' }, this.t)
    this.sfx('zoom-out')
    this.zoomed = false
    this.t += 0.7
  }

  Builder.prototype.toast = function (icon, title, sub, kind = 'team', hold = 2.6) {
    const node = document.createElement('div')
    node.className = `toast ${kind}`
    node.innerHTML = `<span class="t-icon"><svg><use href="#${icon}"/></svg></span><div><b>${title}</b><small>${sub}</small></div>`
    els.toasts.appendChild(node)
    const start = this.t
    const slot = this.toasts.filter((t) => t.end > start).length
    this.toasts.push({ end: start + hold })
    this.st.fromTo(node, { autoAlpha: 0, x: 40, y: slot * 76, scale: 0.96 }, { autoAlpha: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, start)
    this.sfx('toast', start, { kind })
    this.st.to(node, { autoAlpha: 0, x: 20, duration: 0.4, ease: 'power2.in' }, start + hold)
    this.feed.push({ at: start, icon, title, sub, kind })
    this.t += 0.6
  }

  Builder.prototype.stamp = function (text, x, y, icon, kind = '') {
    const node = this.el(`stamp ${kind}`, `<svg><use href="#${icon}"/></svg>${text}`)
    this.avoid.push({ x: x - 11, y: y - 5, w: 22, h: 10 })
    gsap.set(node, { left: `${x}%`, top: `${y}%`, xPercent: -50, yPercent: -50 })
    this.st.fromTo(node, { autoAlpha: 0, scale: 2.4, rotation: -22 }, { autoAlpha: 1, scale: 1, rotation: -8, duration: 0.55, ease: 'back.out(2.2)' }, this.t)
    this.st.to(els.screen, { keyframes: { x: [0, -6, 6, -4, 4, 0] }, duration: 0.35, ease: 'none' }, this.t + 0.4)
    this.sfx('stamp', this.t + 0.3, { kind: kind || 'ok' })
    this.fx.push(node)
    this.t += 0.9
  }

  Builder.prototype.envelopes = function (key) {
    const p = this.point(key)
    if (!p) return
    this.sfx('send', this.t + 0.2)
    for (let i = 0; i < 9; i++) {
      const env = this.el('envelope', '<svg><use href="#i-mail"/></svg>')
      const r1 = ((i * 37) % 10) / 10
      const r2 = ((i * 53) % 10) / 10
      const at = this.t + i * 0.09
      this.st.fromTo(env, { autoAlpha: 0, left: `${p.x - 2}%`, top: `${p.y - 2}%`, scale: 0.3, rotation: 0 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' }, at)
      this.st.to(env, { left: `${40 + r1 * 55}%`, top: `${-12 - r2 * 8}%`, rotation: r2 * 50 - 25, duration: 1.2, ease: 'power2.in' }, at + 0.2)
      this.st.to(env, { autoAlpha: 0, duration: 0.25 }, at + 1.2)
    }
    this.t += 0.8
  }

  Builder.prototype.scan = function () {
    const scan = this.el('scan')
    this.sfx('scan', this.t, { duration: 1.8 })
    this.st.fromTo(scan, { autoAlpha: 1, top: '55%' }, { top: '88%', duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 1, immediateRender: false }, this.t)
    this.st.to(scan, { autoAlpha: 0, duration: 0.3 }, this.t + 1.8)
    this.t += 2
  }

  Builder.prototype.upload = function (key, name) {
    const p = this.point(key, 0, 0)
    if (!p) return
    const node = this.el('upload-bar', `<b><span>${name}</span><span class="ub-pct">0%</span></b><div class="ub-track"><div class="ub-fill"></div></div>`)
    gsap.set(node, { left: `${p.box.x + 2}%`, top: `${p.box.y - 16}%` })
    const fill = node.querySelector('.ub-fill')
    const pct = node.querySelector('.ub-pct')
    const proxy = { v: 0 }
    this.st.fromTo(node, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35 }, this.t)
    this.st.fromTo(proxy, { v: 0 }, { v: 100, duration: 1.5, ease: 'power1.inOut', onUpdate: () => { fill.style.width = `${proxy.v}%`; pct.textContent = `${Math.round(proxy.v)}%` } }, this.t + 0.3)
    this.sfx('upload', this.t + 0.3, { duration: 1.5 })
    this.sfx('done', this.t + 1.8)
    this.fx.push(node)
    this.t += 1.9
  }

  Builder.prototype.badge = function (key, text) {
    const p = this.point(key, 1, 0)
    if (!p) return
    const node = this.el('badge-new', text)
    gsap.set(node, { left: `${p.x + 1}%`, top: `${p.y - 0.5}%` })
    this.st.fromTo(node, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(3)' }, this.t)
    this.sfx('pop')
    this.st.to(node, { scale: 1.12, duration: 0.4, yoyo: true, repeat: 3, ease: 'sine.inOut' }, this.t + 0.4)
    this.fx.push(node)
    this.t += 0.5
  }

  Builder.prototype.burst = function (key) {
    const p = this.point(key)
    if (!p) return
    const colors = ['#c6e27f', '#264c3c', '#a9cf5a', '#9c8fd0', '#f6c96b']
    this.sfx('sparkle')
    for (let i = 0; i < 26; i++) {
      const dot = this.el('ripple')
      const angle = (i / 26) * Math.PI * 2
      const dist = 6 + (i % 4) * 2.5
      gsap.set(dot, { left: `${p.x}%`, top: `${p.y}%`, width: 9, height: 9, margin: '-4.5px 0 0 -4.5px', border: 0, background: colors[i % colors.length] })
      this.st.fromTo(dot, { autoAlpha: 1, x: 0, y: 0, scale: 1 }, { x: Math.cos(angle) * dist * 10.4, y: Math.sin(angle) * dist * 6.5, autoAlpha: 0, scale: 0.4, duration: 1.1, ease: 'power3.out', immediateRender: false }, this.t)
    }
    this.t += 0.3
  }

  function build() {
    els.shots = $('demoShots')
    els.fx = $('demoFx')
    els.zoom = $('demoZoom')
    els.cursor = $('demoCursor')
    els.toasts = $('demoToasts')
    els.caption = $('demoCaption')
    els.screen = $('demoScreen')
    els.end = $('demoEnd')

    const imgs = STEPS.map((s) => {
      const img = new Image()
      img.src = `capturas/${s.shot}.png`
      img.alt = s.title
      els.shots.appendChild(img)
      return img
    })

    renderPhases()

    tl = gsap.timeline({ paused: true, onUpdate: sync, onComplete: showEnd })
    tl.set(els.cursor, { left: '62%', top: '78%', scale: 1 }, 0)
    tl.set(els.zoom, { scale: 1, transformOrigin: '50% 50%' }, 0)

    starts = []
    feedEvents = []
    STEPS.forEach((step, i) => {
      const st = gsap.timeline()
      const prev = STEPS[i - 1]
      const viewChange = prev && prev.view !== step.view
      let t0 = 0
      if (viewChange) {
        const wipe = document.createElement('div')
        wipe.className = `wipe ${step.view}`
        wipe.innerHTML = step.view === 'client'
          ? '<span><svg><use href="#i-user"/></svg>Vista del cliente · portal privado</span>'
          : '<span><svg><use href="#i-users"/></svg>Vista del equipo RCD</span>'
        els.screen.appendChild(wipe)
        st.fromTo(wipe, { xPercent: -101, autoAlpha: 1 }, { xPercent: 0, duration: 0.45, ease: 'power3.in', immediateRender: false }, 0)
        st.fromTo(wipe.firstChild, { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'power2.out' }, 0.35)
        st.set(imgs[i - 1], { autoAlpha: 0 }, 0.45)
        st.set(imgs[i], { autoAlpha: 1, scale: 1, filter: 'blur(0px)' }, 0.45)
        st.to(wipe, { xPercent: 101, duration: 0.55, ease: 'power3.out' }, 0.95)
        st.call(() => window.sfx('wipe', { view: step.view }), null, 0)
        t0 = 1.2
      } else {
        if (prev) st.to(imgs[i - 1], { autoAlpha: 0, duration: 0.5 }, 0)
        st.fromTo(imgs[i], { autoAlpha: 0, scale: 1.035, filter: 'blur(8px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power2.out' }, 0)
        st.call(() => window.sfx('screen'), null, 0)
        t0 = 0.6
      }
      st.fromTo(els.caption, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out' }, t0 - 0.2)
      st.call(() => window.sfx('caption'), null, t0 - 0.2)

      const b = new Builder(st, step, i)
      b.t = t0 + 0.3
      step.run(b)
      step.spot = captionSpot(step.shot, step.view === 'team' && step.shot !== 'login' ? [...b.avoid, TEAM_HEADER] : b.avoid)
      if (b.zoomed) b.unzoom()
      const minLen = 7.2
      const end = Math.max(b.t + 1.9, minLen, ...b.toasts.map((t) => t.end + 0.5))
      if (b.fx.length) st.to(b.fx, { autoAlpha: 0, duration: 0.35 }, end - 0.45)
      st.to(els.caption, { autoAlpha: 0, y: -8, duration: 0.3 }, end - 0.3)
      st.set({}, {}, end)

      const at = tl.duration()
      tl.addLabel(`s${i}`, at)
      tl.add(st, at)
      starts.push(at)
      for (const f of b.feed) feedEvents.push({ ...f, time: at + f.at, step: i })
    })
    renderTicks()
  }

  function renderPhases() {
    const list = $('demoPhases')
    list.innerHTML = PHASES.map((name, i) => `<li data-phase="${i}"><span class="p-dot"><b>${i + 1}</b><svg><use href="#i-check"/></svg></span><span>${name}</span><span class="p-bar"><i></i></span></li>`).join('')
    list.addEventListener('click', (e) => {
      const li = e.target.closest('li')
      if (!li) return
      const first = STEPS.findIndex((s) => s.phase === Number(li.dataset.phase))
      seekStep(first)
    })
  }

  function renderTicks() {
    const total = tl.duration()
    $('demoTicks').innerHTML = starts.map((s, i) => {
      const phaseStart = i === 0 || STEPS[i - 1].phase !== STEPS[i].phase
      return `<i class="${phaseStart ? 'phase' : ''}" style="left:${(s / total) * 100}%" title="${STEPS[i].title}"></i>`
    }).join('')
  }

  function fmt(s) {
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  function stepAt(time) {
    let idx = 0
    for (let i = 0; i < starts.length; i++) if (time >= starts[i] - 0.0001) idx = i
    return idx
  }

  function sync() {
    const time = tl.time()
    const total = tl.duration()
    const idx = stepAt(time)
    if (idx !== current) applyStep(idx)

    const p = total ? time / total : 0
    $('demoFill').style.width = `${p * 100}%`
    $('demoKnob').style.left = `${p * 100}%`
    $('demoTime').textContent = `${fmt(time)} / ${fmt(total)}`

    const stepEnd = starts[idx + 1] ?? total
    const within = Math.min(1, (time - starts[idx]) / (stepEnd - starts[idx]))
    const finished = p >= 0.999
    document.querySelectorAll('#demoPhases li').forEach((li, ph) => {
      const steps = STEPS.map((s, i) => (s.phase === ph ? i : -1)).filter((i) => i >= 0)
      const done = steps.filter((i) => i < idx).length + (steps.includes(idx) ? within : 0)
      li.querySelector('.p-bar i').style.width = `${(done / steps.length) * 100}%`
      li.classList.toggle('done', finished || ph < STEPS[idx].phase)
      li.classList.toggle('current', !finished && ph === STEPS[idx].phase)
    })

    const visible = feedEvents.filter((f) => f.time <= time + 0.01).length
    if (visible !== shownFeed) renderFeed(visible)
    if (p < 0.999 && els.end.style.visibility === 'visible') hideEnd()
  }

  function applyStep(idx) {
    const step = STEPS[idx]
    current = idx
    els.caption.className = `caption pos-${step.spot || 'bl'}`
    $('demoUrl').textContent = step.url
    const view = $('demoView')
    view.classList.toggle('client', step.view === 'client')
    view.querySelector('span').textContent = step.view === 'client' ? 'Vista cliente' : 'Equipo RCD'
    view.querySelector('use').setAttribute('href', step.view === 'client' ? '#i-user' : '#i-users')
    const actor = $('capActor')
    actor.textContent = step.actor[0]
    actor.className = `actor ${step.actor[1]}`
    $('capStep').textContent = `Paso ${idx + 1} de ${STEPS.length} · ${PHASES[step.phase]}`
    $('capTitle').textContent = step.title
    $('capText').textContent = step.text
    $('phaseCount').textContent = `Fase ${step.phase + 1} de ${PHASES.length}`
    document.querySelectorAll('#demoPhases li').forEach((li, ph) => {
      li.classList.toggle('done', ph < step.phase)
      li.classList.toggle('current', ph === step.phase)
    })
    applySnapshot(idx)
  }

  function applySnapshot(idx) {
    const [resp, bars] = SNAP[idx]
    const target = { inv: idx >= 2 ? 240 : 0, resp, act: resp - bars[5], close: bars[5] }
    gsap.to(kpiState, {
      ...target, duration: 0.9, ease: 'power2.out', overwrite: true,
      onUpdate: () => {
        $('kInv').textContent = Math.round(kpiState.inv)
        $('kResp').textContent = Math.round(kpiState.resp)
        $('kAct').textContent = Math.round(kpiState.act)
        $('kClose').textContent = Math.round(kpiState.close)
      },
    })
    if (chart) {
      chart.data.datasets[0].data = bars
      chart.update()
    }
  }

  function renderFeed(count) {
    const grew = count > shownFeed && shownFeed >= 0
    shownFeed = count
    const items = feedEvents.slice(0, count).slice(-3).reverse()
    $('demoFeed').innerHTML = items.map((f, i) => `<li class="${grew && i === 0 ? 'fresh' : ''}"><span class="f-icon ${f.kind}"><svg><use href="#${f.icon}"/></svg></span><div>${f.title}<small>${f.sub}</small></div></li>`).join('')
      || '<li><span class="f-icon"><svg><use href="#i-clock"/></svg></span><div>Esperando actividad<small>La demo registrará aquí cada evento</small></div></li>'
  }

  function makeChart() {
    const C = window.Graficos.colors
    chart = window.Graficos.make('demoChart', {
      type: 'bar',
      data: {
        labels: ['Captación', 'Honorarios', 'Validaciones', 'Documentos', 'Elaboración', 'Cerrados'],
        datasets: [{ data: SNAP[Math.max(current, 0)][1], backgroundColor: ['#d9cdb3', '#9c8fd0', '#6f9a83', '#a9cf5a', C.forest, '#10261d'], borderRadius: 6, borderSkipped: false, barPercentage: 0.78 }],
      },
      options: {
        indexAxis: 'y',
        animation: { duration: 800, easing: 'easeOutQuart' },
        events: [],
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { min: 0, max: 240, grid: { color: 'rgba(22,36,30,.06)' }, border: { display: false }, ticks: { display: false } },
          y: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, font: { size: 10.5 }, color: '#3c4a44' } },
        },
        layout: { padding: { right: 26 } },
      },
      plugins: [{
        id: 'barValues',
        afterDatasetsDraw(c) {
          const { ctx } = c
          const meta = c.getDatasetMeta(0)
          ctx.save()
          ctx.font = `700 10px ${Chart.defaults.font.family}`
          ctx.fillStyle = '#264c3c'
          ctx.textBaseline = 'middle'
          meta.data.forEach((bar, i) => {
            const v = c.data.datasets[0].data[i]
            if (v > 0) ctx.fillText(String(v), bar.x + 5, bar.y)
          })
          ctx.restore()
        },
      }],
    })
  }

  function showEnd() {
    updatePlayIcon()
    gsap.to(els.end, { autoAlpha: 1, duration: 0.6 })
    gsap.fromTo(els.end.querySelector('.endcard-inner'), { y: 30, scale: 0.96 }, { y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.6)' })
    gsap.fromTo(els.end.querySelector('.end-icon'), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.8, delay: 0.2, ease: 'back.out(2.5)' })
    window.sfx('success')
  }

  function hideEnd() {
    gsap.killTweensOf(els.end)
    gsap.set(els.end, { autoAlpha: 0 })
  }

  function updatePlayIcon() {
    const btn = $('btnPlay')
    const playing = tl && !tl.paused() && tl.progress() < 1
    btn.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play')
    btn.setAttribute('aria-label', playing ? 'Pausa' : 'Reproducir')
    btn.classList.toggle('is-paused', !playing)
  }

  function seekStep(i) {
    const idx = Math.max(0, Math.min(STEPS.length - 1, i))
    hideEnd()
    tl.seek(`s${idx}`, false)
    sync()
    updatePlayIcon()
  }

  function seekProgress(p) {
    hideEnd()
    tl.progress(Math.max(0, Math.min(0.999, p)), false)
    sync()
  }

  function bindTrack() {
    const track = $('demoTrack')
    let dragging = false
    const at = (e) => {
      const r = track.getBoundingClientRect()
      return (e.clientX - r.left) / r.width
    }
    track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); seekProgress(at(e)) })
    track.addEventListener('pointermove', (e) => { if (dragging) seekProgress(at(e)) })
    track.addEventListener('pointerup', () => { dragging = false })
  }

  let built = false
  const Demo = {
    enter() {
      if (!built) {
        build()
        bindTrack()
        built = true
        makeChart()
        sync()
        renderFeed(0)
      } else if (!chart) {
        makeChart()
      }
      if (tl.progress() >= 1) tl.restart()
      else tl.play()
      updatePlayIcon()
    },
    leave() {
      if (tl) tl.pause()
      updatePlayIcon()
    },
    toggle() {
      if (!tl) return
      if (tl.progress() >= 1) { Demo.restart(); return }
      tl.paused(!tl.paused())
      updatePlayIcon()
    },
    restart() {
      if (!tl) return
      hideEnd()
      current = -1
      shownFeed = -1
      tl.restart()
      sync()
      updatePlayIcon()
    },
    next() {
      if (!tl) return false
      const idx = stepAt(tl.time())
      if (tl.progress() >= 1 || idx >= STEPS.length - 1) return false
      seekStep(idx + 1)
      return true
    },
    prev() {
      if (!tl) return false
      const time = tl.time()
      const idx = stepAt(time)
      if (tl.progress() >= 1) { seekStep(STEPS.length - 1); return true }
      if (time - starts[idx] > 1.5) { seekStep(idx); return true }
      if (idx === 0) return false
      seekStep(idx - 1)
      return true
    },
    speed() {
      speedIdx = (speedIdx + 1) % speeds.length
      if (tl) tl.timeScale(speeds[speedIdx])
      $('btnSpeed').textContent = `${String(speeds[speedIdx]).replace('.', ',')}×`
    },
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-demo]')
    if (!btn) return
    const action = btn.dataset.demo
    if (action === 'toggle') Demo.toggle()
    if (action === 'restart') Demo.restart()
    if (action === 'next') Demo.next()
    if (action === 'prev') Demo.prev()
    if (action === 'speed') Demo.speed()
  })

  window.Demo = Demo
})()
