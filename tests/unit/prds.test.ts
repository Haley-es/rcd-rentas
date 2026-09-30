import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const directory = resolve('docs', 'prds')
const done = join(directory, 'done')
const files = readdirSync(done).filter(name => name.endsWith('.md'))
const todo = join(directory, 'todo')
const pending = readdirSync(todo).filter(name => name.endsWith('.md'))
const historical = files.filter(name => /^0[1-7]-/.test(name))

describe('Documentación y entrega de PRDs', () => {
  it('conserva siete PRDs históricos y sus 73 criterios sin pendientes históricos', () => {
    expect(historical).toHaveLength(7)
    for (const id of ['01', '02', '03', '04', '05', '06', '07']) {
      expect(historical.filter(name => name.startsWith(`${id}-`))).toHaveLength(1)
    }
    expect(pending.filter(name => /^0[1-7]-/.test(name))).toEqual([])
    const criteria = new Set(historical.flatMap(name => readFileSync(join(done, name), 'utf8').match(/P\d{2}-CA\d{2}/g) ?? []))
    expect(criteria.size).toBe(73)
    for (const name of historical) {
      const content = readFileSync(join(done, name), 'utf8')
      expect(content).toContain('**Estado:** implementado y validado como mockup.')
      expect(content).not.toContain('**Estado:** pendiente de implementación.')
    }
  })

  it('inventaría 08–10 exactamente una vez y no anuncia pendientes como terminados', () => {
    for (const id of ['08', '09', '10']) {
      const completed = files.filter(name => name.startsWith(`${id}-`))
      const waiting = pending.filter(name => name.startsWith(`${id}-`))
      expect([...completed, ...waiting]).toHaveLength(1)
      for (const name of waiting) {
        expect(readFileSync(join(todo, name), 'utf8')).toContain('**Estado:** pendiente de implementación.')
      }
      for (const name of completed) {
        const text = readFileSync(join(done, name), 'utf8')
        expect(text).toContain('**Estado:** implementado y validado como prototipo local.')
        expect(text).not.toContain('**Estado:** pendiente de implementación.')
        expect(text).toContain('## Evidencia de implementación')
      }
    }
    expect(files.length + pending.length).toBe(11)
  })

  it('mantiene el marco de aplicación final pendiente y sus 24 criterios', () => {
    expect(files.filter(name => name.startsWith('11-'))).toEqual([])
    const roadmap = pending.filter(name => name.startsWith('11-'))
    expect(roadmap).toHaveLength(1)
    const content = readFileSync(join(todo, roadmap[0]!), 'utf8')
    expect(content).toContain('**Estado:** pendiente de implementación.')
    expect(content).not.toContain('**Estado:** implementado y validado')
    const criteria = content.match(/P11-CA\d{2}/g) ?? []
    expect(criteria).toEqual(Array.from({ length: 24 }, (_, index) =>
      `P11-CA${String(index + 1).padStart(2, '0')}`))
  })

  it('enlaces locales de PRDs y guía siguen válidos tras moverlos', () => {
    const documents = [resolve('README.md'), join(directory, 'README.md'), ...files.map(name => join(done, name)), ...pending.map(name => join(todo, name))]
    const missing: string[] = []
    for (const file of documents) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        const raw = match[1]!.replace(/^<|>$/g, '').split('#')[0]!
        if (!raw || /^[a-z]+:/i.test(raw)) continue
        const target = resolve(dirname(file), decodeURIComponent(raw))
        if (!existsSync(target)) missing.push(`${file}: ${raw}`)
      }
    }
    expect(missing).toEqual([])
  })
})
