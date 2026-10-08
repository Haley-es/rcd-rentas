import { describe, expect, it } from 'vitest'
import {
  createPrototypeAuthStore, PROTOTYPE_CHALLENGE_TTL_MS, PROTOTYPE_SESSION_TTL_MS,
} from '../../server/utils/prototype-auth-store'
import { prototypeReturnTo } from '../../shared/utils/prototype-return-to'

describe('Registro efímero de autenticación', () => {
  it('desafío válido hasta exactamente 5 minutos, nunca depende del reloj fiscal', () => {
    expect(PROTOTYPE_CHALLENGE_TTL_MS).toBe(300_000)
    let now = Date.parse('2026-09-30T12:00:00Z')
    const store = createPrototypeAuthStore({ now: () => now })
    const challenge = store.begin('x')
    expect(challenge.expiresAt).toBe(now + 300_000)
    now += 299_999
    expect(store.challenge(challenge.id)).toBeDefined()
    now += 1
    expect(store.challenge(challenge.id)).toBeUndefined()
    expect(store.consume(challenge.id)).toBeUndefined()
  })

  it('consume una sola vez, genera 32 bytes y mantiene 8 horas absolutas sin renovación', () => {
    expect(PROTOTYPE_SESSION_TTL_MS).toBe(28_800_000)
    let now = 1_000
    const store = createPrototypeAuthStore({ now: () => now })
    const challenge = store.begin('Usuario')
    expect(challenge.id).toMatch(/^[a-f0-9]{64}$/)
    const session = store.consume(challenge.id)!
    expect(session.sessionId).toMatch(/^[a-f0-9]{64}$/)
    expect(session.sessionId).not.toBe(challenge.id)
    expect(session.username).toBe('Usuario')
    expect(Object.keys(session).sort()).toEqual(['accessRole', 'expiresAt', 'sessionId', 'username'])
    expect(session.accessRole).toBe('Empleado')
    expect(store.consume(challenge.id)).toBeUndefined()
    expect(session.expiresAt).toBe(now + 28_800_000)
    now += 28_799_999
    expect(store.session(session.sessionId)?.expiresAt).toBe(session.expiresAt)
    now += 1
    expect(store.session(session.sessionId)).toBeUndefined()
  })

  it('logout revoca ambos registros, es idempotente y otro proceso comienza vacío', () => {
    const store = createPrototypeAuthStore()
    const challenge = store.begin('x')
    const session = store.consume(challenge.id)!
    const pending = store.begin('y')
    const fresh = createPrototypeAuthStore()
    expect(fresh.session(session.sessionId)).toBeUndefined()
    expect(fresh.challenge(pending.id)).toBeUndefined()
    store.revoke(session.sessionId, pending.id)
    store.revoke(session.sessionId, pending.id)
    store.revoke(undefined, undefined)
    expect(store.session(session.sessionId)).toBeUndefined()
    expect(store.challenge(pending.id)).toBeUndefined()
  })
})

describe('Destino local después del acceso', () => {
  it.each([
    'https://example.test', '//example.test', '/\\example.test', '/%5cexample.test',
    '/%2fexample.test', '/login', '/mfa?returnTo=/', '/foo/../login',
    '/%6cogin', '/login/otra', '/mfa/otra', '/%0a/host', '/%',
  ])('rechaza destino inseguro o bucle %s', (value) => {
    expect(prototypeReturnTo(value)).toBe('/')
  })
  it('conserva portal y query, distingue nombre con mayúsculas y rechaza arrays', () => {
    expect(prototypeReturnTo('/portal/DEMO-R08?token=demo-DEMO-R08')).toBe('/portal/DEMO-R08?token=demo-DEMO-R08')
    expect(prototypeReturnTo(['/expedientes'])).toBe('/')
  })
})
