import type { NuxtApp } from '#app'
import type { PrototypeAuthError, PrototypeSession } from '../../shared/types/prototype-auth'
import { prototypeReturnTo } from '#shared/utils/prototype-return-to'
import { clearPrototypeMockScope } from '../utils/prototype-mock-scope'

interface AuthOperations {
  controllers: Set<AbortController>
  expiryTimer?: ReturnType<typeof setTimeout>
}
const operations = new WeakMap<NuxtApp, AuthOperations>()

function authError(cause: unknown): { status: number; message: string } {
  if (cause && typeof cause === 'object' && 'data' in cause) {
    const data = cause.data as { statusCode?: number; data?: PrototypeAuthError } | undefined
    if (data?.data?.message) return { status: data.statusCode ?? 0, message: data.data.message }
  }
  return { status: 0, message: 'No se pudo consultar el acceso local. Comprueba el servidor e inténtalo de nuevo.' }
}

export function usePrototypeAuth() {
  const app = useNuxtApp()
  const session = useState<PrototypeSession>('prototype-auth-session', () => ({ authenticated: false, pendingMfa: false }))
  const pending = useState<boolean>('prototype-auth-pending', () => false)
  const error = useState<string>('prototype-auth-error', () => '')
  const requestFetch = useRequestFetch()
  let active = operations.get(app)
  if (!active) {
    active = { controllers: new Set() }
    operations.set(app, active)
  }
  const activity = active

  function clear() {
    for (const controller of activity.controllers) controller.abort()
    activity.controllers.clear()
    if (activity.expiryTimer) clearTimeout(activity.expiryTimer)
    activity.expiryTimer = undefined
    session.value = { authenticated: false, pendingMfa: false }
    clearPrototypeMockScope(app)
    // Sustituir primero los valores evita que componentes montados con refs viejas retengan datos.
    for (const key of Object.keys(app.payload.state)) {
      if (key.startsWith('$sprototype-auth-')) continue
      app.payload.state[key] = undefined
    }
    app.runWithContext(() => {
      clearNuxtState(key => !key.startsWith('prototype-auth-'), { reset: false })
      clearNuxtData()
    })
  }

  async function expired(message = 'Sesión ausente o caducada. Inicia sesión de nuevo.') {
    const route = app.$router.currentRoute.value
    const returnTo = prototypeReturnTo(route.fullPath)
    clear()
    error.value = message
    if (import.meta.client && route.path !== '/login') await app.$router.replace({ path: '/login', query: { returnTo } })
  }

  function accept(next: PrototypeSession) {
    session.value = next
    if (activity.expiryTimer) clearTimeout(activity.expiryTimer)
    if (import.meta.client && next.authenticated) {
      activity.expiryTimer = setTimeout(() => { void expired() }, Math.max(0, Date.parse(next.expiresAt) - Date.now()))
    }
  }

  async function request<T extends object>(url: string, options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: object
    headers?: Record<string, string>
    responseType?: 'blob'
  } = {}) {
    const controller = new AbortController()
    activity.controllers.add(controller)
    try {
      return await requestFetch<T>(url, { ...options, signal: controller.signal })
    } catch (cause) {
      if (controller.signal.aborted) throw cause
      let normalized: unknown = cause
      if (cause && typeof cause === 'object' && 'data' in cause &&
        cause.data instanceof Blob && cause.data.type.includes('application/json')) {
        normalized = { data: JSON.parse(await cause.data.text()) }
      }
      const failure = authError(normalized)
      error.value = failure.message
      if (failure.status === 401) await expired(failure.message)
      throw normalized
    } finally {
      activity.controllers.delete(controller)
    }
  }

  async function refresh(): Promise<PrototypeSession> {
    const next = await request<PrototypeSession>('/api/auth/session')
    if (!next.authenticated && session.value.authenticated) await expired()
    accept(next)
    return next
  }

  async function login(username: string, password: string): Promise<boolean> {
    if (pending.value) return false
    error.value = ''
    pending.value = true
    try {
      await request<{ next: '/mfa' }>('/api/auth/login', { method: 'POST', body: { username, password } })
      clear()
      accept({ authenticated: false, pendingMfa: true })
      return true
    } catch {
      return false
    } finally {
      pending.value = false
    }
  }

  async function verifyMfa(code: string): Promise<boolean> {
    if (pending.value) return false
    error.value = ''
    pending.value = true
    try {
      accept(await request<PrototypeSession>('/api/auth/mfa', { method: 'POST', body: { code } }))
      return true
    } catch {
      return false
    } finally {
      pending.value = false
    }
  }

  async function logout(): Promise<void> {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      await request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: {} })
      clear()
      await app.$router.replace('/login')
    } catch {
      // El error ya es visible. Sin confirmación del servidor no se anuncia revocación.
    } finally {
      pending.value = false
    }
  }

  return { session, pending, error, refresh, login, verifyMfa, logout, request, expire: expired }
}
