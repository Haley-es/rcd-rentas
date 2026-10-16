import {
  createError, deleteCookie, getCookie, getHeader, getRequestURL,
  readBody, setCookie, setHeader, type H3Event,
} from 'h3'
import type { PrototypeAuthErrorCode, PrototypeSession } from '../../shared/types/prototype-auth'
import { useRuntimeConfig } from '#imports'
import type { AccessRole } from '../../shared/types/access-role'
import { resolvePrototypeAccessRole } from './prototype-access-role'
import { parsePrototypeDemoOrigin, prototypeMfaUrlAllowed, prototypeRequestUrl } from './prototype-demo-origin'
import {
  createPrototypeAuthStore, PROTOTYPE_CHALLENGE_TTL_MS, PROTOTYPE_SESSION_TTL_MS,
} from './prototype-auth-store'

export interface PrototypeSessionContext {
  username: string
  accessRole: AccessRole
  sessionId: string
  expiresAt: number
}

export const PROTOTYPE_SESSION_COOKIE = 'rcd-prototype-session'
export const PROTOTYPE_CHALLENGE_COOKIE = 'rcd-prototype-challenge'
const trustedServerContexts = new WeakMap<H3Event, number>()

const config = useRuntimeConfig().prototypeAuth
const demoOrigin = parsePrototypeDemoOrigin(config.demoOrigin)
function testTtl(value: number, normal: number) {
  if (!import.meta.dev || config.e2e !== true) return normal
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('TTL E2E debe ser un entero positivo.')
  return value
}

const store = createPrototypeAuthStore({
  challengeTtlMs: testTtl(Number(config.challengeTtlMs), PROTOTYPE_CHALLENGE_TTL_MS),
  sessionTtlMs: testTtl(Number(config.sessionTtlMs), PROTOTYPE_SESSION_TTL_MS),
})

function failure(statusCode: number, code: PrototypeAuthErrorCode, message: string): never {
  throw createError({ statusCode, statusMessage: code, data: { code, message } })
}

function requestUrl(event: H3Event) {
  return prototypeRequestUrl(getRequestURL(event, { xForwardedHost: false, xForwardedProto: false }), demoOrigin)
}

function cookieOptions(event: H3Event) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: requestUrl(event).protocol === 'https:' }
}

function writeCookie(event: H3Event, name: string, id: string, expiresAt: number) {
  setCookie(event, name, id, {
    ...cookieOptions(event), expires: new Date(expiresAt),
    maxAge: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
  })
}

function clearCookies(event: H3Event) {
  deleteCookie(event, PROTOTYPE_SESSION_COOKIE, cookieOptions(event))
  deleteCookie(event, PROTOTYPE_CHALLENGE_COOKIE, cookieOptions(event))
}

export function requirePrototypeSession(event: H3Event): PrototypeSessionContext {
  setHeader(event, 'Cache-Control', 'no-store')
  const session = store.session(getCookie(event, PROTOTYPE_SESSION_COOKIE))
  if (!session) failure(401, 'AUTH_REQUIRED', 'Sesión ausente o caducada. Inicia sesión de nuevo.')
  return session
}

export function requirePrototypeOrigin(event: H3Event): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  // Solo código servidor puede registrar este evento; ninguna cabecera lo activa.
  if (trustedServerContexts.has(event)) return
  const origin = getHeader(event, 'origin')
  if (!origin || origin !== requestUrl(event).origin) {
    failure(403, 'ORIGIN_FORBIDDEN', 'Solicitud rechazada: se requiere el mismo origen de la aplicación.')
  }
}

export function requirePrototypeMutationContentType(event: H3Event): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  const mediaType = getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json' && mediaType !== 'multipart/form-data') {
    failure(400, 'AUTH_INPUT_INVALID', 'Se requiere JSON o una carga multipart con validación específica.')
  }
}

export async function withPrototypeServerContext<T>(event: H3Event, operation: () => Promise<T>): Promise<T> {
  trustedServerContexts.set(event, (trustedServerContexts.get(event) ?? 0) + 1)
  try {
    return await operation()
  } finally {
    const remaining = (trustedServerContexts.get(event) ?? 1) - 1
    if (remaining) trustedServerContexts.set(event, remaining)
    else trustedServerContexts.delete(event)
  }
}

export async function readPrototypeAuthInput(event: H3Event): Promise<Record<string, unknown>> {
  requirePrototypeOrigin(event)
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    failure(400, 'AUTH_INPUT_INVALID', 'Se requiere Content-Type: application/json.')
  }
  const body: unknown = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    failure(400, 'AUTH_INPUT_INVALID', 'Introduce los campos de acceso.')
  }
  return body as Record<string, unknown>
}

export function prototypeAuthText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    failure(400, 'AUTH_INPUT_INVALID', `${label}: introduce cualquier valor no vacío.`)
  }
  return value.trim()
}

function sessionDto(record: PrototypeSessionContext): PrototypeSession {
  return { authenticated: true, user: { username: record.username, accessRole: record.accessRole }, expiresAt: new Date(record.expiresAt).toISOString() }
}

export function getPrototypeSession(event: H3Event): PrototypeSession {
  setHeader(event, 'Cache-Control', 'no-store')
  const session = store.session(getCookie(event, PROTOTYPE_SESSION_COOKIE))
  if (session) return sessionDto(session)
  return { authenticated: false, pendingMfa: Boolean(store.challenge(getCookie(event, PROTOTYPE_CHALLENGE_COOKIE))) }
}

export async function beginPrototypeLogin(event: H3Event, username: string, password: string): Promise<{ next: '/mfa' }> {
  store.revoke(getCookie(event, PROTOTYPE_SESSION_COOKIE), getCookie(event, PROTOTYPE_CHALLENGE_COOKIE))
  clearCookies(event)
  const accessRole = await resolvePrototypeAccessRole(username, password, config)
  if (!accessRole) failure(401, 'AUTH_CREDENTIALS_INVALID', 'Credenciales incorrectas.')
  const challenge = store.begin(username, accessRole)
  writeCookie(event, PROTOTYPE_CHALLENGE_COOKIE, challenge.id, challenge.expiresAt)
  return { next: '/mfa' }
}

export function completePrototypeMfa(event: H3Event): PrototypeSession {
  if (!prototypeMfaUrlAllowed(requestUrl(event), demoOrigin)) {
    failure(403, 'MFA_LOCAL_ONLY', 'El MFA simulado solo está disponible en localhost o en el dominio configurado para la demo.')
  }
  const session = store.consume(getCookie(event, PROTOTYPE_CHALLENGE_COOKIE))
  if (!session) {
    deleteCookie(event, PROTOTYPE_CHALLENGE_COOKIE, cookieOptions(event))
    failure(401, 'MFA_CHALLENGE_INVALID', 'Desafío MFA ausente, consumido o caducado. Inicia sesión de nuevo.')
  }
  deleteCookie(event, PROTOTYPE_CHALLENGE_COOKIE, cookieOptions(event))
  writeCookie(event, PROTOTYPE_SESSION_COOKIE, session.sessionId, session.expiresAt)
  return sessionDto(session)
}

export function revokePrototypeSession(event: H3Event): { ok: true } {
  store.revoke(getCookie(event, PROTOTYPE_SESSION_COOKIE), getCookie(event, PROTOTYPE_CHALLENGE_COOKIE))
  clearCookies(event)
  return { ok: true }
}
