import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const directory = resolve('docs', 'prds')
const done = join(directory, 'done')
const files = readdirSync(done).filter(name => name.endsWith('.md'))

describe('Documentación y entrega de PRDs', () => {
  it('siete PRDs implementados en done y ninguno pendiente en todo', () => {
    expect(files).toHaveLength(7)
    expect(readdirSync(join(directory, 'todo')).filter(name => name.endsWith('.md'))).toEqual([])
    const criteria = new Set(files.flatMap(name => readFileSync(join(done, name), 'utf8').match(/P\d{2}-CA\d{2}/g) ?? []))
    expect(criteria.size).toBe(73)
    for (const name of files) {
      const content = readFileSync(join(done, name), 'utf8')
      expect(content).toContain('**Estado:** implementado y validado como mockup.')
      expect(content).not.toContain('**Estado:** pendiente de implementación.')
    }
  })

  it('enlaces locales de PRDs y guía siguen válidos tras moverlos', () => {
    const documents = [resolve('README.md'), join(directory, 'README.md'), ...files.map(name => join(done, name))]
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
