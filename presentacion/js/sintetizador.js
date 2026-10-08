// Sintetizador de efectos de sonido y música de la presentación. Lo comparten la web (Web Audio,
// js/sonido.js) y el grabador de vídeo (video/sonido.mjs) para que ambos suenen igual.
// Todo se genera por código, sin muestras externas.
;(function (root) {
  function crear(SR) {
    const TAU = Math.PI * 2

    // Generador pseudoaleatorio con semilla para que el audio sea reproducible.
    function rng(seed) {
      let s = seed >>> 0
      return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }
    let rand = rng(20261001)
    const noise = () => rand() * 2 - 1
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

    class Bus {
      constructor(seconds) {
        this.n = Math.ceil(seconds * SR)
        this.L = new Float32Array(this.n)
        this.R = new Float32Array(this.n)
      }

      // Añade una señal mono generada muestra a muestra: fn(t) con t en segundos desde el inicio del sonido.
      add(at, dur, gain, pan, fn) {
        const start = Math.round(at * SR)
        const len = Math.round(dur * SR)
        const p = Math.max(-1, Math.min(1, pan))
        const gl = Math.cos((p + 1) * Math.PI / 4) * gain
        const gr = Math.sin((p + 1) * Math.PI / 4) * gain
        for (let i = 0; i < len; i++) {
          const k = start + i
          if (k >= this.n) break
          const v = fn(i / SR)
          if (k < 0) continue
          this.L[k] += v * gl
          this.R[k] += v * gr
        }
      }
    }

    // Filtro biquad (RBJ) con frecuencia variable por muestra.
    function biquad(type) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0
      return (x, freq, q = 0.707) => {
        const w = TAU * Math.min(freq, SR * 0.45) / SR
        const cw = Math.cos(w)
        const a = Math.sin(w) / (2 * q)
        let b0, b1, b2
        if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0 }
        else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0 }
        else { b0 = a; b1 = 0; b2 = -a }
        const a0 = 1 + a
        const y = (b0 * x + b1 * x1 + b2 * x2 + 2 * cw * y1 - (1 - a) * y2) / a0
        x2 = x1; x1 = x; y2 = y1; y1 = y
        return y
      }
    }

    const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay))
    const expSweep = (from, to, p) => from * Math.pow(to / from, Math.min(1, Math.max(0, p)))

    // ---- Instrumentos -------------------------------------------------------------------------

    function whoosh(bus, at, { dur = 0.7, from = 300, to = 3200, gain = 0.3, panFrom = -0.7, panTo = 0.7, q = 1.2 } = {}) {
      const bp = biquad('bp')
      const bp2 = biquad('bp')
      const steps = 12
      // Se reparte en tramos para desplazar el panorama durante el barrido.
      for (let s = 0; s < steps; s++) {
        const t0 = (s / steps) * dur
        const seg = dur / steps
        const pan = panFrom + (panTo - panFrom) * (s / (steps - 1))
        bus.add(at + t0, seg, gain, pan, (t) => {
          const p = (t0 + t) / dur
          const f = p < 0.55 ? expSweep(from, to, p / 0.55) : expSweep(to, from * 1.6, (p - 0.55) / 0.45)
          const e = Math.sin(Math.PI * Math.pow(p, 0.8)) ** 1.6
          const n = noise()
          return (bp(n, f, q) * 0.8 + bp2(n, f * 1.9, q * 1.4) * 0.35) * e
        })
      }
    }

    function sub(bus, at, { dur = 0.6, from = 75, to = 42, gain = 0.4 } = {}) {
      let ph = 0
      bus.add(at, dur, gain, 0, (t) => {
        ph += TAU * expSweep(from, to, t / dur) / SR
        return Math.sin(ph) * env(t, 0.004, dur / 3.5)
      })
    }

    function click(bus, at, { gain = 0.32, pan = 0 } = {}) {
      const hp = biquad('hp')
      bus.add(at, 0.03, gain, pan, (t) => hp(noise(), 2500) * Math.exp(-t / 0.0025) + Math.sin(TAU * 1900 * t) * Math.exp(-t / 0.006) * 0.4)
      const hp2 = biquad('hp')
      bus.add(at + 0.075, 0.025, gain * 0.45, pan, (t) => hp2(noise(), 3000) * Math.exp(-t / 0.002) + Math.sin(TAU * 2300 * t) * Math.exp(-t / 0.004) * 0.3)
    }

    function keyTick(bus, at, gain = 0.1) {
      const bp = biquad('bp')
      const f = 2800 + rand() * 1800
      const body = 140 + rand() * 60
      bus.add(at, 0.05, gain * (0.7 + rand() * 0.5), (rand() - 0.5) * 0.4, (t) => bp(noise(), f, 1.5) * Math.exp(-t / 0.004) * 1.4 + Math.sin(TAU * body * t) * Math.exp(-t / 0.012) * 0.6)
    }

    function bell(bus, at, freq, { gain = 0.15, decay = 0.6, pan = 0, bright = 1 } = {}) {
      bus.add(at, decay * 5, gain, pan, (t) => {
        const e = env(t, 0.003, decay)
        return (Math.sin(TAU * freq * t)
          + Math.sin(TAU * freq * 2.01 * t) * 0.25 * bright * Math.exp(-t / (decay * 0.5))
          + Math.sin(TAU * freq * 2.76 * t) * 0.18 * bright * Math.exp(-t / (decay * 0.3))
          + Math.sin(TAU * freq * 5.4 * t) * 0.06 * bright * Math.exp(-t / (decay * 0.15))) * e
      })
    }

    function pluck(bus, at, freq, { gain = 0.1, decay = 0.25, pan = 0 } = {}) {
      const lp = biquad('lp')
      bus.add(at, decay * 5, gain, pan, (t) => {
        const raw = Math.sin(TAU * freq * t) + Math.sin(TAU * freq * 2 * t) * 0.4 + Math.sin(TAU * freq * 3 * t) * 0.15
        return lp(raw, 800 + 5000 * Math.exp(-t / 0.06)) * env(t, 0.002, decay)
      })
    }

    function pop(bus, at, { gain = 0.18, base = 420, pan = 0 } = {}) {
      let ph = 0
      bus.add(at, 0.14, gain, pan, (t) => {
        ph += TAU * base * (1 + 1.3 * Math.min(1, t / 0.035)) / SR
        return Math.sin(ph) * env(t, 0.002, 0.03)
      })
    }

    function tick(bus, at, freq, { gain = 0.08, pan = 0 } = {}) {
      bus.add(at, 0.09, gain, pan, (t) => (Math.sin(TAU * freq * t) * 0.8 + Math.sin(TAU * freq * 2.4 * t) * 0.3) * env(t, 0.001, 0.018))
    }

    function shimmer(bus, at, { gain = 0.06, notes = [84, 88, 91, 96], step = 0.035 } = {}) {
      notes.forEach((n, i) => bell(bus, at + i * step, midi(n), { gain, decay: 0.35, pan: -0.5 + i / notes.length, bright: 0.5 }))
    }

    function sparkle(bus, at, { gain = 0.05, count = 18, spread = 0.7 } = {}) {
      for (let i = 0; i < count; i++) {
        const f = 2200 + rand() * 4200
        bus.add(at + rand() * spread, 0.2, gain * (0.5 + rand() * 0.6), rand() * 2 - 1, (t) => Math.sin(TAU * f * t) * env(t, 0.001, 0.04))
      }
    }

    function sweep(bus, at, dur, from, to, { gain = 0.06, trem = 0, pan = 0 } = {}) {
      let ph = 0
      const lp = biquad('lp')
      bus.add(at, dur, gain, pan, (t) => {
        const p = t / dur
        ph += TAU * (p < 0.5 ? expSweep(from, to, p * 2) : expSweep(to, from, (p - 0.5) * 2)) / SR
        const tr = trem ? 0.65 + 0.35 * Math.sin(TAU * trem * t) : 1
        return lp(2 / Math.PI * Math.asin(Math.sin(ph)), 2500) * tr * Math.sin(Math.PI * p)
      })
    }

    function rise(bus, at, dur, from, to, { gain = 0.05 } = {}) {
      let ph = 0
      bus.add(at, dur, gain, 0, (t) => {
        const p = t / dur
        ph += TAU * expSweep(from, to, p) / SR
        return (Math.sin(ph) + Math.sin(ph * 1.5) * 0.3) * Math.sin(Math.PI * p) ** 2
      })
    }

    function thud(bus, at, gain = 0.5) {
      sub(bus, at, { dur: 0.45, from: 95, to: 45, gain })
      const lp = biquad('lp')
      bus.add(at, 0.12, gain * 0.7, 0, (t) => lp(noise(), 900) * Math.exp(-t / 0.02))
      const hp = biquad('hp')
      bus.add(at, 0.03, gain * 0.35, 0, (t) => hp(noise(), 4000) * Math.exp(-t / 0.004))
    }

    function buzz(bus, at, dur, freq, gain) {
      const lp = biquad('lp')
      bus.add(at, dur, gain, 0, (t) => lp(Math.sign(Math.sin(TAU * freq * t)) * 0.5 + Math.sign(Math.sin(TAU * freq * 1.5 * t)) * 0.3, 900) * env(t, 0.01, dur / 3))
    }

    // ---- Traducción de eventos a sonidos ------------------------------------------------------

    const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93]
    const TOASTS = { team: [76, 83], auto: [79, 86], client: [81, 88], warn: [72, 68] }

    function play(bus, e) {
      const t = e.t
      const i = e.index || 0
      switch (e.name) {
        case 'whoosh':
          whoosh(bus, t, { dur: 0.75, gain: 0.26, panFrom: e.dir > 0 ? -0.8 : 0.8, panTo: e.dir > 0 ? 0.8 : -0.8 })
          sub(bus, t + 0.25, { dur: 0.5, gain: 0.12 })
          break
        case 'swoosh': whoosh(bus, t, { dur: 0.5, from: 700, to: 5200, gain: 0.1, panFrom: 0.9, panTo: 0 }); break
        case 'wipe':
          whoosh(bus, t, { dur: 1.05, from: 250, to: 2600, gain: 0.24 })
          sub(bus, t + 0.4, { dur: 0.5, gain: 0.14 })
          shimmer(bus, t + 0.45, { gain: 0.035, notes: e.view === 'client' ? [81, 85, 88, 93] : [76, 79, 83, 88] })
          break
        case 'screen': whoosh(bus, t, { dur: 0.4, from: 900, to: 3500, gain: 0.05, panFrom: -0.2, panTo: 0.2 }); break
        case 'caption': pluck(bus, t, midi(88), { gain: 0.035, decay: 0.12, pan: -0.4 }); break
        case 'click': click(bus, t); break
        case 'type': {
          const n = Math.max(1, e.chars || 10)
          const step = (e.duration || 1) / n
          for (let k = 0; k < n; k++) keyTick(bus, t + k * step + (rand() - 0.5) * step * 0.3)
          break
        }
        case 'check': tick(bus, t, 2600, { gain: 0.1 }); pluck(bus, t + 0.02, midi(88), { gain: 0.08, decay: 0.15 }); break
        case 'highlight': shimmer(bus, t, { gain: 0.03 }); break
        case 'zoom-in': whoosh(bus, t, { dur: 1, from: 200, to: 1400, gain: 0.08, panFrom: 0, panTo: 0, q: 0.8 }); rise(bus, t, 1, 110, 220, { gain: 0.035 }); break
        case 'zoom-out': whoosh(bus, t, { dur: 0.8, from: 1400, to: 220, gain: 0.06, panFrom: 0, panTo: 0, q: 0.8 }); break
        case 'toast': {
          const [a, b] = TOASTS[e.kind] || TOASTS.team
          bell(bus, t, midi(a), { gain: 0.1, decay: 0.35, pan: 0.45 })
          bell(bus, t + 0.09, midi(b), { gain: 0.11, decay: 0.55, pan: 0.5 })
          whoosh(bus, t - 0.03, { dur: 0.3, from: 1500, to: 6000, gain: 0.04, panFrom: 0.9, panTo: 0.5 })
          break
        }
        case 'stamp':
          thud(bus, t, 0.42)
          if (e.kind === 'warn') { buzz(bus, t + 0.05, 0.35, 98, 0.05); bell(bus, t + 0.05, midi(63), { gain: 0.05, decay: 0.4 }) }
          else bell(bus, t + 0.06, midi(84), { gain: 0.05, decay: 0.5 })
          break
        case 'send':
          whoosh(bus, t, { dur: 1.2, from: 500, to: 5000, gain: 0.14, panFrom: -0.3, panTo: 0.9 })
          for (let k = 0; k < 9; k++) whoosh(bus, t + k * 0.09, { dur: 0.25, from: 2500, to: 7000, gain: 0.025, panFrom: 0, panTo: 0.8 })
          break
        case 'scan': sweep(bus, t, e.duration || 1.8, 380, 1250, { gain: 0.045, trem: 14 }); sparkle(bus, t, { gain: 0.02, count: 14, spread: e.duration || 1.8 }); break
        case 'upload': {
          const d = e.duration || 1.5
          rise(bus, t, d, 260, 780, { gain: 0.035 })
          for (let k = 0; k < 10; k++) tick(bus, t + (k / 10) * d, 1500 + k * 120, { gain: 0.025 })
          break
        }
        case 'done': bell(bus, t, midi(91), { gain: 0.1, decay: 0.7 }); bell(bus, t + 0.07, midi(96), { gain: 0.07, decay: 0.8 }); break
        case 'pop': pop(bus, t, { gain: 0.12, base: 360 + i * 45, pan: ((i % 3) - 1) * 0.4 }); break
        case 'tick': tick(bus, t, midi(PENTA[i % PENTA.length]), { gain: 0.055, pan: ((i % 4) / 3 - 0.5) * 0.8 }); break
        case 'flip': whoosh(bus, t, { dur: 0.22, from: 1200, to: 4200, gain: 0.05, panFrom: -0.4, panTo: 0.4 }); tick(bus, t + 0.12, 900, { gain: 0.05 }); break
        case 'title':
          whoosh(bus, t, { dur: 0.9, from: 300, to: 2400, gain: 0.05, panFrom: -0.3, panTo: 0.3, q: 0.7 })
          shimmer(bus, t + 0.35, { gain: 0.025, notes: [79, 84, 88, 91], step: 0.06 })
          break
        case 'impact': sub(bus, t, { dur: 0.9, from: 70, to: 38, gain: 0.3 }); whoosh(bus, t - 0.15, { dur: 0.4, from: 300, to: 1200, gain: 0.07, panFrom: 0, panTo: 0 }); break
        case 'count': {
          const d = e.duration || 1.4
          for (let k = 0; k < 16; k++) tick(bus, t + d * Math.pow(k / 15, 1.8), 2100, { gain: 0.022 })
          break
        }
        case 'draw':
          rise(bus, t, e.duration || 1.5, 180, 360, { gain: 0.03 })
          whoosh(bus, t, { dur: e.duration || 1.5, from: 400, to: 1800, gain: 0.03, panFrom: -0.6, panTo: 0.6, q: 0.7 })
          break
        case 'chart':
          ;[72, 76, 79, 84, 88].forEach((n, k) => pluck(bus, t + k * 0.22, midi(n), { gain: 0.07, decay: 0.3, pan: -0.5 + k * 0.25 }))
          rise(bus, t, e.duration || 1.6, 150, 300, { gain: 0.025 })
          break
        case 'sparkle': sparkle(bus, t, { gain: 0.045, count: 22, spread: 0.8 }); break
        case 'success':
          ;[72, 76, 79, 84, 88].forEach((n, k) => bell(bus, t + k * 0.1, midi(n), { gain: 0.11, decay: 1, pan: -0.4 + k * 0.2 }))
          rise(bus, t, 1.6, 130, 262, { gain: 0.03 })
          sparkle(bus, t + 0.4, { gain: 0.03, count: 16, spread: 1 })
          break
        case 'success-soft': bell(bus, t, midi(84), { gain: 0.06, decay: 0.7 }); bell(bus, t + 0.12, midi(91), { gain: 0.05, decay: 0.9 }); break
        case 'confetti':
          whoosh(bus, t, { dur: 0.9, from: 400, to: 6000, gain: 0.2, panFrom: 0, panTo: 0 })
          sub(bus, t, { dur: 0.6, gain: 0.25 })
          for (let k = 0; k < 60; k++) pop(bus, t + 0.05 + rand() * 1.8, { gain: 0.03 + rand() * 0.04, base: 500 + rand() * 1400, pan: rand() * 2 - 1 })
          ;[72, 76, 79, 84, 88, 91, 96].forEach((n, k) => bell(bus, t + 0.15 + k * 0.09, midi(n), { gain: 0.1, decay: 1.2, pan: -0.6 + k * 0.2 }))
          break
        default: break
      }
    }

    // ---- Fondo musical ------------------------------------------------------------------------

    // Devuelve el fondo musical como lista de tareas pequeñas (una por voz o acorde de arpegio), para
    // que la web pueda generarlo sin bloquear las animaciones. `fade: 0` sirve para bucles sin fundidos.
    function musicJobs(bus, { start, end, fade = 3 }) {
      // Progresión cálida y abierta: Cmaj9 - Am9 - Fmaj9 - G6/9, 4 s por acorde.
      const chords = [
        { bass: 36, notes: [60, 64, 67, 71, 74] },
        { bass: 33, notes: [57, 60, 64, 67, 71] },
        { bass: 29, notes: [57, 60, 64, 65, 69] },
        { bass: 31, notes: [59, 62, 64, 67, 69] },
      ]
      const len = 4
      const master = fade ? (t) => Math.max(0, Math.min(1, (t - start) / fade, (end - t) / fade)) : () => 1
      const jobs = []
      for (let c = 0, at = start; at < end; c++, at += len) {
        const ch = chords[c % chords.length]
        const dur = len + 2
        const pad = (freq, gain, pan) => jobs.push(() => {
          const lp = biquad('lp')
          bus.add(at, dur, gain, pan, (t) => {
            const a = Math.min(1, t / 1.6) * Math.min(1, (dur - t) / 2)
            const tt = at + t
            let v = 0
            for (const d of [1, 1.0035, 0.9968]) v += Math.sin(TAU * freq * d * tt) + Math.sin(TAU * freq * 2 * d * tt) * 0.18
            const cutoff = 1200 + 500 * Math.sin(TAU * 0.07 * tt)
            return lp(v / 3, cutoff) * a * master(tt) * (0.85 + 0.15 * Math.sin(TAU * 0.25 * tt + freq))
          })
        })
        ch.notes.forEach((n, k) => pad(midi(n), 0.035, -0.6 + k * 0.3))
        pad(midi(ch.bass), 0.08, 0)
        pad(midi(ch.bass + 12), 0.03, 0)
        // Arpegio ligero en corcheas a 90 BPM para dar pulso sin tapar los efectos.
        jobs.push(() => {
          const eighth = 60 / 90 / 2
          const pattern = [0, 2, 4, 3, 1, 4, 2, 3]
          for (let k = 0; k < Math.round(len / eighth); k++) {
            const tt = at + k * eighth
            const m = master(tt)
            if (m > 0) pluck(bus, tt, midi(ch.notes[pattern[k % pattern.length]] + 12), { gain: 0.022 * m * (k % 2 ? 0.7 : 1), decay: 0.22, pan: k % 2 ? 0.35 : -0.35 })
          }
        })
      }
      return jobs
    }

    function music(bus, opts) {
      for (const job of musicJobs(bus, opts)) job()
    }

    // ---- Reverberación y masterización --------------------------------------------------------

    function reverb(input, { wet = 0.2, size = 1 } = {}) {
      const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ b: new Float32Array(Math.round(d * size * SR / 44100)), i: 0, f: 0 }))
      const aps = [225, 556, 441].map((d) => ({ b: new Float32Array(Math.round(d * SR / 44100)), i: 0 }))
      const out = new Float32Array(input.length)
      for (let n = 0; n < input.length; n++) {
        const x = input[n] * 0.015
        let s = 0
        for (const c of combs) {
          const y = c.b[c.i]
          c.f = y * 0.8 + c.f * 0.2
          c.b[c.i] = x + c.f * 0.84
          c.i = (c.i + 1) % c.b.length
          s += y
        }
        for (const a of aps) {
          const y = a.b[a.i]
          a.b[a.i] = s + y * 0.5
          a.i = (a.i + 1) % a.b.length
          s = y - s * 0.5
        }
        out[n] = input[n] + s * wet * 4
      }
      return out
    }

    return { SR, Bus, play, music, musicJobs, reverb, reset: () => { rand = rng(20261001) } }
  }

  root.SintesisRCD = { crear }
})(typeof window !== 'undefined' ? window : globalThis)
