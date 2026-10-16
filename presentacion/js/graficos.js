// Gráficos de la presentación (Chart.js). Se recrean al entrar en cada diapositiva para repetir la animación.
(function () {
  const style = getComputedStyle(document.documentElement)
  const token = name => style.getPropertyValue(name).trim()
  const C = {
    forest: token('--rcd-blue'),
    forest2: token('--rcd-deep'),
    lime: token('--rcd-sky'),
    lime2: token('--rcd-sky-strong'),
    mint: token('--rcd-accent-soft'),
    sand: token('--rcd-chart-1'),
    lav: token('--rcd-chart-3'),
    muted: token('--rcd-muted'),
    grid: 'rgba(29, 29, 27, 0.07)',
  }

  Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font')
  Chart.defaults.font.size = 12
  Chart.defaults.color = C.muted
  Chart.defaults.plugins.legend.labels.usePointStyle = true
  Chart.defaults.plugins.legend.labels.boxWidth = 8
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 24, 63, 0.95)'
  Chart.defaults.plugins.tooltip.padding = 10
  Chart.defaults.plugins.tooltip.cornerRadius = 10

  const charts = {}
  const ratio = () => Math.max(1, (window.devicePixelRatio || 1) * (window.STAGE_SCALE || 1))

  // El escenario se escala con transform: Chart.js mediría el tamaño transformado, así que se fija el
  // tamaño de maquetación y se desactivan los eventos de puntero (sus coordenadas no contemplan la escala).
  function make(id, config) {
    destroy([id])
    const canvas = document.getElementById(id)
    const box = canvas.parentElement
    canvas.style.width = `${box.clientWidth}px`
    canvas.style.height = `${box.clientHeight}px`
    config.options = Object.assign({ responsive: false, maintainAspectRatio: false, devicePixelRatio: ratio(), events: [] }, config.options)
    charts[id] = new Chart(canvas, config)
    return charts[id]
  }

  function destroy(ids) {
    for (const id of ids) {
      if (charts[id]) {
        gsap.killTweensOf(charts[id])
        charts[id].destroy()
        delete charts[id]
      }
    }
  }

  const phases = ['Captación', 'Honorarios', 'Validaciones', 'Documentación', 'Elaboración', 'Cierre']

  function impacto() {
    make('chartSteps', {
      type: 'bar',
      data: {
        labels: phases,
        datasets: [
          { label: 'Hoy', data: [9, 5, 6, 5, 4, 4], backgroundColor: C.sand, borderRadius: 8, borderSkipped: false, barPercentage: 0.75, categoryPercentage: 0.7 },
          { label: 'Escenario propuesto', data: [1, 2, 3, 1, 2, 2], backgroundColor: C.forest, borderRadius: 8, borderSkipped: false, barPercentage: 0.75, categoryPercentage: 0.7 },
        ],
      },
      options: {
        animation: { duration: 1400, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 120 + ctx.datasetIndex * 500 : 0) },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { stepSize: 2 } },
        },
      },
    })

    make('chartSplit', {
      type: 'doughnut',
      data: {
        labels: ['Automático', 'Asistido', 'Decisión humana'],
        datasets: [{ data: [16, 6, 11], backgroundColor: [C.lime2, C.mint, C.forest], borderWidth: 4, borderColor: '#fff', hoverOffset: 10 }],
      },
      options: {
        cutout: '68%',
        layout: { padding: 6 },
        animation: { animateRotate: true, animateScale: true, duration: 1600, easing: 'easeOutQuart' },
        plugins: { legend: { position: 'bottom' } },
      },
    })

    make('chartGoals', {
      type: 'radar',
      data: {
        labels: ['Eficiencia', 'Trazabilidad', 'Experiencia cliente', 'Escalabilidad', 'Seguimiento', 'Visibilidad'],
        datasets: [
          { label: 'Hoy', data: [2, 1, 2, 1.5, 2, 1], borderColor: C.sand, backgroundColor: 'rgba(191, 217, 237, 0.35)', pointBackgroundColor: C.sand, borderWidth: 2 },
          { label: 'Escenario propuesto', data: [4.5, 5, 4.5, 4, 5, 5], borderColor: C.forest, backgroundColor: 'rgba(121, 189, 225, 0.35)', pointBackgroundColor: C.forest, borderWidth: 2 },
        ],
      },
      options: {
        animation: { duration: 1600, easing: 'easeOutQuart' },
        plugins: { legend: { position: 'bottom' } },
        scales: { r: { min: 0, max: 5, ticks: { display: false, stepSize: 1 }, grid: { color: C.grid }, angleLines: { color: C.grid }, pointLabels: { font: { size: 11 }, color: '#45474b' } } },
      },
    })
  }

  // Líneas verticales de hitos sobre el diagrama de Gantt.
  const milestones = {
    id: 'milestones',
    afterDatasetsDraw(chart, _args, opts) {
      const { ctx, chartArea, scales } = chart
      const progress = chart.$milestoneProgress ?? 1
      for (const m of opts.items || []) {
        const x = scales.x.getPixelForValue(m.at)
        ctx.save()
        ctx.globalAlpha = progress
        ctx.strokeStyle = m.color
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, chartArea.top - 4)
        ctx.lineTo(x, chartArea.bottom)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = m.color
        ctx.font = `600 11px ${Chart.defaults.font.family}`
        ctx.textAlign = m.align || 'center'
        ctx.fillText(m.label, x + (m.dx || 0), chartArea.top - 10)
        ctx.restore()
      }
    },
  }

  function plan() {
    const blocks = [
      ['Arranque y diseño detallado', 0, 2, C.lav],
      ['Identidad, accesos y entornos', 1, 4, C.forest2],
      ['Comunicación y captación', 2, 6, C.forest],
      ['Gestión de expedientes', 4, 11, C.forest],
      ['Portal del cliente', 6, 12, C.forest],
      ['Integraciones: firma, NAV, extractor 720', 8, 13, C.lime2],
      ['Pruebas y ajustes con RCD', 11, 14, C.sand],
      ['Formación y puesta en marcha', 13, 15, C.lav],
    ]
    const chart = make('chartGantt', {
      type: 'bar',
      data: {
        labels: blocks.map((b) => b[0]),
        datasets: [{ data: blocks.map((b) => [b[1], b[2]]), backgroundColor: blocks.map((b) => b[3]), borderRadius: 8, borderSkipped: false, barPercentage: 0.62 }],
      },
      options: {
        indexAxis: 'y',
        layout: { padding: { top: 22, right: 10 } },
        animation: { duration: 900, easing: 'easeOutCubic', delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 160 : 0) },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `Semanas ${ctx.raw[0] + 1}–${ctx.raw[1]}` } },
          milestones: { items: [
            { at: 0, label: 'Arranque aprobado', color: C.lime2, align: 'left', dx: -2 },
            { at: 15, label: 'Objetivo orientativo', color: C.forest, align: 'right', dx: 2 },
          ] },
        },
        scales: {
          x: { min: 0, max: 15, grid: { color: C.grid }, border: { display: false }, ticks: { stepSize: 1, callback: (v) => (v === 0 ? '' : `S${v}`) } },
          y: { grid: { display: false }, border: { display: false }, ticks: { color: '#45474b', font: { size: 12.5 } } },
        },
      },
      plugins: [milestones],
    })
    chart.$milestoneProgress = 0
    gsap.to(chart, { $milestoneProgress: 1, delay: 1.4, duration: 0.8, onUpdate: () => chart.draw() })
  }

  window.Graficos = { make, destroy, impacto, plan, colors: C, ratio }
})()
