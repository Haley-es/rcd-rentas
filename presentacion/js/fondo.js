// Fondo animado: manchas de color suaves y una red de nodos que deriva lentamente.
(function () {
  const canvas = document.getElementById('fondo')
  const ctx = canvas.getContext('2d')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let w = 0
  let h = 0
  let nodes = []

  const blobs = [
    { x: 0.12, y: 0.18, r: 0.42, c: 'rgba(121, 189, 225, 0.28)', sx: 0.00011, sy: 0.00017 },
    { x: 0.88, y: 0.82, r: 0.5, c: 'rgba(36, 53, 136, 0.12)', sx: 0.00009, sy: 0.00013 },
    { x: 0.78, y: 0.12, r: 0.34, c: 'rgba(226, 236, 247, 0.7)', sx: 0.00015, sy: 0.0001 },
  ]

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const count = Math.round((w * h) / 26000)
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.6 + 0.6,
    }))
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h)
    for (const b of blobs) {
      const x = (b.x + Math.sin(t * b.sx) * 0.06) * w
      const y = (b.y + Math.cos(t * b.sy) * 0.06) * h
      const r = b.r * Math.max(w, h)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, b.c)
      g.addColorStop(1, 'rgba(250, 250, 250, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
    for (const n of nodes) {
      n.x += n.vx
      n.y += n.vy
      if (n.x < -20) n.x = w + 20
      if (n.x > w + 20) n.x = -20
      if (n.y < -20) n.y = h + 20
      if (n.y > h + 20) n.y = -20
    }
    const max = 130
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 < max * max) {
          ctx.strokeStyle = `rgba(36, 53, 136, ${0.08 * (1 - Math.sqrt(d2) / max)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      ctx.fillStyle = 'rgba(36, 53, 136, 0.22)'
      ctx.beginPath()
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
      ctx.fill()
    }
    if (!reduced) requestAnimationFrame(frame)
  }

  window.addEventListener('resize', resize)
  resize()
  requestAnimationFrame(frame)
})()
