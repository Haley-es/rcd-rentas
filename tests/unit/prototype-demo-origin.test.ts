import { describe, expect, it } from 'vitest'
import { parsePrototypeDemoOrigin, prototypeMfaUrlAllowed, prototypeRequestUrl } from '../../server/utils/prototype-demo-origin'

describe('Origen HTTPS de la demo', () => {
  it('conserva el comportamiento local cuando no se configura dominio', () => {
    expect(parsePrototypeDemoOrigin('  ')).toBeUndefined()
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      const incoming = new URL(`http://${hostname}:3010/mfa`)
      expect(prototypeRequestUrl(incoming)).toBe(incoming)
      expect(prototypeMfaUrlAllowed(incoming)).toBe(true)
    }
    expect(prototypeMfaUrlAllowed(new URL('https://rentas.haley.es/mfa'))).toBe(false)
  })

  it('reconoce HTTPS detrás de Caddy y conserva ruta, query y origen del navegador', () => {
    const origin = parsePrototypeDemoOrigin('https://rentas.haley.es')!
    const incoming = new URL('http://rentas.haley.es/portal/DEMO-R01?token=demo-DEMO-R01')
    const resolved = prototypeRequestUrl(incoming, origin)
    expect(resolved.href).toBe('https://rentas.haley.es/portal/DEMO-R01?token=demo-DEMO-R01')
    expect(resolved.origin).toBe(origin.origin)
    expect(resolved.protocol).toBe('https:')
    expect(prototypeMfaUrlAllowed(resolved, origin)).toBe(true)
    expect(incoming.protocol).toBe('http:')
    expect(prototypeMfaUrlAllowed(incoming, origin)).toBe(false)
    expect(prototypeRequestUrl(new URL('https://rentas.haley.es/mfa'), origin).protocol).toBe('https:')
  })

  it('conserva localhost y no acepta otros hosts, puertos ni nombres parecidos', () => {
    const origin = parsePrototypeDemoOrigin('https://rentas.haley.es')!
    const local = new URL('http://127.0.0.1:3010/mfa')
    expect(prototypeRequestUrl(local, origin)).toBe(local)
    expect(prototypeMfaUrlAllowed(local, origin)).toBe(true)
    for (const address of ['http://evil.example', 'http://rentas.haley.es.evil.example',
      'http://rentas.haley.es:3010', 'http://haley.es', 'http://192.168.1.10']) {
      const incoming = new URL(address)
      expect(prototypeRequestUrl(incoming, origin)).toBe(incoming)
      expect(prototypeMfaUrlAllowed(incoming, origin)).toBe(false)
    }
  })

  it('no interpreta una ruta con dos barras como un cambio de servidor', () => {
    const origin = parsePrototypeDemoOrigin('https://rentas.haley.es')!
    const resolved = prototypeRequestUrl(new URL('http://rentas.haley.es//evil.example/mfa'), origin)
    expect(resolved.origin).toBe(origin.origin)
    expect(resolved.pathname).toBe('//evil.example/mfa')
  })

  it('respeta puertos HTTPS explícitos', () => {
    const origin = parsePrototypeDemoOrigin('https://rentas.haley.es:8443')!
    const resolved = prototypeRequestUrl(new URL('http://rentas.haley.es:8443/mfa'), origin)
    expect(resolved.origin).toBe('https://rentas.haley.es:8443')
    expect(prototypeMfaUrlAllowed(resolved, origin)).toBe(true)
    expect(prototypeMfaUrlAllowed(new URL('https://rentas.haley.es/mfa'), origin)).toBe(false)
  })

  it.each(['no-es-url', 'http://rentas.haley.es', 'https://user:secret@rentas.haley.es',
    'https://rentas.haley.es/demo', 'https://rentas.haley.es/?demo=1', 'https://rentas.haley.es/#demo'])
  ('rechaza configuración incorrecta: %s', (value) => {
    expect(() => parsePrototypeDemoOrigin(value)).toThrow()
  })
})
