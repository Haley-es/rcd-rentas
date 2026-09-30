// Motor de la presentación: escalado del escenario, navegación y animaciones de entrada.
(function () {
  const stage = document.getElementById('stage')
  const slides = [...document.querySelectorAll('.slide')]
  const nav = document.querySelector('.chrome-nav')
  const W = 1600
  const H = 900
  let index = -1
  let busy = false
  let ambient = []
  let enterTl = null

  function fit() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H)
    window.STAGE_SCALE = scale
    const x = (window.innerWidth - W * scale) / 2
    const y = (window.innerHeight - H * scale) / 2
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }
  window.addEventListener('resize', fit)
  fit()

  // El foco en botones puede desplazar contenedores con overflow oculto; se mantiene todo en su sitio.
  for (const el of [document.getElementById('viewport'), document.getElementById('slides'), stage]) {
    el.addEventListener('scroll', () => { el.scrollLeft = 0; el.scrollTop = 0 })
  }
  window.addEventListener('scroll', () => window.scrollTo(0, 0))
  for (const s of document.querySelectorAll('.slide, .screen')) {
    s.addEventListener('scroll', () => { s.scrollLeft = 0; s.scrollTop = 0 })
  }

  document.getElementById('slideTotal').textContent = String(slides.length).padStart(2, '0')
  nav.innerHTML = slides.map((s, i) => `<button type="button" data-slide="${i}">${s.dataset.title}</button>`).join('')
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (b) go(Number(b.dataset.slide))
  })

  // Divide los títulos en palabras para animarlas una a una, conservando los <em>.
  function splitWords(el) {
    if (el.dataset.split) return
    el.dataset.split = '1'
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment()
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return }
            const wrap = document.createElement('span')
            wrap.className = 'word-wrap'
            const word = document.createElement('span')
            word.className = 'word'
            word.textContent = part
            wrap.appendChild(word)
            frag.appendChild(wrap)
          })
          node.replaceChild(frag, child)
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child)
        }
      }
    }
    walk(el)
  }

  function counters(slide, tl, at) {
    slide.querySelectorAll('[data-count]').forEach((el) => {
      const target = Number(el.dataset.count)
      const proxy = { v: 0 }
      el.textContent = '0'
      tl.to(proxy, { v: target, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(proxy.v) } }, at)
    })
  }

  function genericEnter(slide) {
    const tl = gsap.timeline()
    let t = 0.1
    slide.querySelectorAll('[data-a]').forEach((el) => {
      const type = el.dataset.a
      if (type === 'words') {
        splitWords(el)
        tl.fromTo(el.querySelectorAll('.word'), { yPercent: 115, rotation: 6, autoAlpha: 0 }, { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 0.9, ease: 'power4.out', stagger: 0.045 }, t)
        t += 0.35
      } else if (type === 'up') {
        tl.fromTo(el, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, t)
        t += 0.12
      } else if (type === 'fade') {
        tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, t + 0.6)
      } else if (type === 'scale') {
        tl.fromTo(el, { autoAlpha: 0, scale: 0.7, rotation: -4 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.8)' }, t + 0.2)
      } else if (type === 'stagger') {
        tl.fromTo(el.children, { autoAlpha: 0, y: 34, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out', stagger: 0.1 }, t)
        t += 0.2
      } else if (type === 'flip') {
        tl.fromTo(el.children, { autoAlpha: 0, rotationY: -75, rotationX: 10, transformOrigin: '0% 50%', z: -120 }, { autoAlpha: 1, rotationY: 0, rotationX: 0, z: 0, duration: 1.1, ease: 'power3.out', stagger: 0.14 }, t + 0.1)
      }
    })
    counters(slide, tl, 0.6)
    return tl
  }

  const hooks = {
    portada(slide, tl) {
      const shots = slide.querySelectorAll('.shot')
      tl.fromTo(shots, { autoAlpha: 0, x: 260, rotationY: -50, z: -400 }, { autoAlpha: 1, x: 0, rotationY: (i) => [-18, -14, -16][i], rotationX: (i) => [6, 4, 5][i], z: (i) => [-160, -40, 60][i], duration: 1.5, ease: 'expo.out', stagger: 0.18 }, 0.2)
      tl.fromTo(slide.querySelectorAll('.orbit'), { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.6, ease: 'expo.out', stagger: 0.15 }, 0.1)
      tl.fromTo(slide.querySelectorAll('.float-chip'), { autoAlpha: 0, scale: 0.6, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(2)', stagger: 0.25 }, 1.1)
      tl.fromTo(slide.querySelector('.sparkle'), { autoAlpha: 0, scale: 0, rotation: -180 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 1.2, ease: 'back.out(2)' }, 1.3)
      ambient.push(
        gsap.to(slide.querySelector('.orbit-2'), { rotation: 360, duration: 40, ease: 'none', repeat: -1 }),
        gsap.to(slide.querySelector('.sparkle'), { rotation: '+=90', scale: 1.15, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.5 }),
        gsap.to(slide.querySelector('.stack'), { y: -14, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        ...[...slide.querySelectorAll('.float-chip')].map((chip, i) => gsap.to(chip, { y: i % 2 ? 12 : -12, duration: 2.6 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2 })),
      )
    },

    solucion(slide, tl) {
      const paths = [...slide.querySelectorAll('.hub-lines path')]
      paths.forEach((p) => {
        const len = p.getTotalLength()
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
      })
      tl.fromTo(slide.querySelector('.hub-core'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1, ease: 'back.out(1.7)' }, 0.4)
      tl.to(paths, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.08 }, 0.9)
      tl.fromTo(slide.querySelectorAll('.hub-node'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.8, ease: 'back.out(2)', stagger: 0.15 }, 1.5)
      gsap.set(slide.querySelectorAll('.hub-sat'), { xPercent: -50, yPercent: -50 })
      tl.fromTo(slide.querySelectorAll('.hub-sat'), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)', stagger: 0.1 }, 1.9)
      ambient.push(gsap.fromTo(slide.querySelector('.hub-ring'), { scale: 1, autoAlpha: 0.9 }, { scale: 1.35, autoAlpha: 0, duration: 2.2, ease: 'power1.out', repeat: -1, delay: 1.4 }))

      const hub = slide.querySelector('.hub')
      paths.forEach((p, i) => {
        const dot = document.createElement('span')
        dot.className = 'pulse-dot'
        hub.appendChild(dot)
        const len = p.getTotalLength()
        const proxy = { d: 0 }
        const reverse = i % 2 === 1
        gsap.set(dot, { autoAlpha: 0 })
        ambient.push(gsap.to(proxy, {
          d: 1, duration: 2.2, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.6 + (i % 3) * 0.5, delay: 2.4 + i * 0.35,
          onStart: () => gsap.set(dot, { autoAlpha: 1 }),
          onUpdate: () => {
            const pt = p.getPointAtLength((reverse ? 1 - proxy.d : proxy.d) * len)
            dot.style.left = `${pt.x}px`
            dot.style.top = `${pt.y}px`
          },
        }))
        ambient.push({ kill: () => dot.remove() })
      })
    },

    demo() {
      window.Demo.enter()
    },

    reglas(slide, tl) {
      const path = slide.querySelector('.flow-line path')
      const len = path.getTotalLength()
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
      tl.to(path, { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut' }, 0.7)
      const nodes = slide.querySelectorAll('.fnode')
      tl.fromTo(nodes, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.22 }, 0.7)
      tl.fromTo(slide.querySelectorAll('.fdot'), { scale: 0, rotation: -60 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.4)', stagger: 0.22 }, 0.7)
      const dots = [...slide.querySelectorAll('.fnode .fdot')]
      ambient.push(gsap.to(dots, { keyframes: { scale: [1, 1.1, 1] }, duration: 0.6, ease: 'sine.inOut', stagger: { each: 0.35, repeat: -1, repeatDelay: dots.length * 0.35 }, delay: 3 }))
    },

    impacto(slide, tl) {
      tl.call(() => window.Graficos.impacto(), null, 0.5)
    },

    plan(slide, tl) {
      tl.call(() => window.Graficos.plan(), null, 0.6)
    },

    siguiente(slide, tl) {
      tl.fromTo(slide.querySelectorAll('.nstep span'), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.5)', stagger: 0.12 }, 1.1)
      ambient.push(gsap.to('#btnAccept', { boxShadow: '0 0 0 12px rgba(198, 226, 127, 0.45), 0 14px 30px -14px rgba(38, 76, 60, .9)', duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2 }))
    },
  }

  const leaveHooks = {
    demo: () => window.Demo.leave(),
    impacto: () => window.Graficos.destroy(['chartSteps', 'chartSplit', 'chartGoals']),
    plan: () => window.Graficos.destroy(['chartGantt']),
  }

  function go(to, instant = false) {
    to = Math.max(0, Math.min(slides.length - 1, to))
    if (to === index || busy) return
    const from = slides[index]
    const next = slides[to]
    const dir = to > index ? 1 : -1
    busy = true

    ambient.forEach((a) => a.kill())
    ambient = []
    if (enterTl) enterTl.kill()
    if (from) {
      const hook = leaveHooks[from.dataset.id]
      if (hook) hook()
    }

    const out = gsap.timeline()
    if (from) {
      out.to(from, { autoAlpha: 0, y: -40 * dir, filter: 'blur(8px)', duration: instant ? 0 : 0.5, ease: 'power2.in' })
      out.add(() => from.classList.remove('is-active'))
    }
    out.add(() => {
      index = to
      next.classList.add('is-active')
      gsap.set(next, { autoAlpha: 1, y: 0, filter: 'blur(0px)' })
      enterTl = genericEnter(next)
      const hook = hooks[next.dataset.id]
      if (hook) hook(next, enterTl)
      updateChrome()
      history.replaceState(null, '', `#${next.dataset.id}`)
      busy = false
    })
  }

  function updateChrome() {
    document.getElementById('slideNum').textContent = String(index + 1).padStart(2, '0')
    nav.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === index))
    gsap.to('#deckProgress', { width: `${((index + 1) / slides.length) * 100}%`, duration: 0.8, ease: 'power3.out' })
  }

  const isDemo = () => slides[index] && slides[index].dataset.id === 'demo'
  const nextSlide = () => go(index + 1)
  const prevSlide = () => go(index - 1)

  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const k = e.key
    if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); if (!(isDemo() && window.Demo.next())) nextSlide() }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); if (!(isDemo() && window.Demo.prev())) prevSlide() }
    else if (k === 'PageDown') { e.preventDefault(); nextSlide() }
    else if (k === 'PageUp') { e.preventDefault(); prevSlide() }
    else if (k === ' ') { e.preventDefault(); if (isDemo()) window.Demo.toggle(); else nextSlide() }
    else if (k === 'r' || k === 'R') { if (isDemo()) window.Demo.restart() }
    else if (k === 'f' || k === 'F') toggleFullscreen()
    else if (k === 'Home') go(0)
    else if (k === 'End') go(slides.length - 1)
  })

  let wheelLock = 0
  window.addEventListener('wheel', (e) => {
    if (isDemo() || Math.abs(e.deltaY) < 30) return
    const now = Date.now()
    if (now - wheelLock < 1100) return
    wheelLock = now
    if (e.deltaY > 0) nextSlide(); else prevSlide()
  }, { passive: true })

  let touchX = null
  window.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX }, { passive: true })
  window.addEventListener('touchend', (e) => {
    if (touchX === null) return
    const dx = e.changedTouches[0].clientX - touchX
    touchX = null
    if (Math.abs(dx) > 60) (dx < 0 ? nextSlide : prevSlide)()
  })

  document.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]')
    if (goto) { const i = slides.findIndex((s) => s.dataset.id === goto.dataset.goto); go(i); return }
    if (e.target.closest('[data-next]')) nextSlide()
  })

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
    else document.exitFullscreen?.()
  }
  document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen)

  // Celebración al aceptar la propuesta.
  function confetti() {
    const canvas = document.getElementById('confetti')
    const ctx = canvas.getContext('2d')
    const ratio = window.Graficos.ratio()
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * ratio
    canvas.height = h * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const colors = ['#c6e27f', '#264c3c', '#a9cf5a', '#9c8fd0', '#f6c96b', '#ffffff']
    const parts = Array.from({ length: 220 }, (_, i) => ({
      x: w / 2 + (Math.random() - 0.5) * 200,
      y: h * 0.72,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 8,
      r: Math.random() * 6 + 4,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.3,
      c: colors[i % colors.length],
    }))
    const t0 = performance.now()
    const tick = (now) => {
      ctx.clearRect(0, 0, w, h)
      const life = (now - t0) / 1000
      for (const p of parts) {
        p.vy += 0.42
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.a += p.va
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - life / 4.5)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.a)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2)
        ctx.restore()
      }
      if (life < 4.5) requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w, h)
    }
    requestAnimationFrame(tick)
  }

  document.getElementById('btnAccept').addEventListener('click', (e) => {
    const btn = e.currentTarget
    confetti()
    btn.innerHTML = '<svg><use href="#i-check-circle"/></svg> Propuesta aceptada'
    gsap.fromTo(btn, { scale: 0.92 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
    const thanks = document.getElementById('thanks')
    thanks.textContent = '¡Gracias por vuestra confianza! Preparamos el kick-off con vuestros equipos.'
    gsap.fromTo(thanks, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' })
  })

  const start = slides.findIndex((s) => `#${s.dataset.id}` === location.hash)
  go(start >= 0 ? start : 0, true)
})()
