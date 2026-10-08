// Banda sonora del vídeo: efectos sincronizados con los eventos `sfx` de la presentación y fondo
// musical opcional. Usa el mismo sintetizador que la web (js/sintetizador.js), cargado en un contexto aislado.
import { readFile, writeFile } from 'node:fs/promises'
import vm from 'node:vm'

const SR = 48000
const context = vm.createContext({})
vm.runInContext(await readFile(new URL('../js/sintetizador.js', import.meta.url), 'utf8'), context)
const { Bus, play, music, reverb, reset } = context.SintesisRCD.crear(SR)

function wav(L, R) {
  const n = L.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4)
  }
  return buf
}

/**
 * Genera la pista de audio en WAV estéreo 48 kHz.
 * @param {{ name: string, t: number }[]} events eventos con tiempo en segundos del vídeo
 * @param {number} duration duración total en segundos
 */
export async function renderAudio(events, duration, file, { music: withMusic = true, musicStart = 0.3, musicEnd = duration - 0.2 } = {}) {
  reset()
  const fx = new Bus(duration)
  for (const e of events) play(fx, e)
  const bed = new Bus(duration)
  if (withMusic) music(bed, { start: musicStart, end: musicEnd })

  const fxL = reverb(fx.L, { wet: 0.16 })
  const fxR = reverb(fx.R, { wet: 0.16, size: 1.03 })
  const bedL = reverb(bed.L, { wet: 0.3 })
  const bedR = reverb(bed.R, { wet: 0.3, size: 1.04 })

  // La música baja ligeramente cuando suenan efectos (sidechain suave).
  const L = new Float32Array(fx.n)
  const R = new Float32Array(fx.n)
  let level = 0
  for (let i = 0; i < fx.n; i++) {
    const lvl = Math.abs(fx.L[i]) + Math.abs(fx.R[i])
    level = lvl > level ? level + (lvl - level) * 0.01 : level * 0.99995
    const duck = 1 - Math.min(0.35, level * 1.2)
    L[i] = fxL[i] + bedL[i] * duck
    R[i] = fxR[i] + bedR[i] * duck
  }

  // Normaliza con un percentil alto para que un pico aislado no hunda el volumen general.
  const sample = []
  for (let i = 0; i < L.length; i += 7) sample.push(Math.abs(L[i]), Math.abs(R[i]))
  sample.sort((a, b) => a - b)
  const ref = sample[Math.floor(sample.length * 0.9995)] || 1
  const norm = 0.8 / ref
  const fadeOut = Math.round(1.2 * SR)
  for (let i = 0; i < L.length; i++) {
    const f = Math.min(1, i / (0.05 * SR), (L.length - i) / fadeOut)
    L[i] = Math.tanh(L[i] * norm) * f * 0.9
    R[i] = Math.tanh(R[i] * norm) * f * 0.9
  }
  await writeFile(file, wav(L, R))
  return { ref, samples: L.length }
}
