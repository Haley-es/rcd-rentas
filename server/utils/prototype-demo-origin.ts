import { isPrototypeLocalHostname } from '../../shared/utils/prototype-local-host'

export function parsePrototypeDemoOrigin(value: string): URL | undefined {
  if (!value.trim()) return undefined
  const origin = new URL(value.trim())
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
    origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('NUXT_PROTOTYPE_AUTH_DEMO_ORIGIN debe ser un origen HTTPS sin ruta, credenciales, query ni fragmento.')
  }
  return origin
}

// Caddy preserves Host. Use the explicitly configured HTTPS origin instead of
// trusting forwarded headers or rewriting browser Origin/cookies in the proxy.
export function prototypeRequestUrl(incoming: URL, demoOrigin?: URL): URL {
  if (!demoOrigin || incoming.host !== demoOrigin.host) return incoming
  const url = new URL(incoming.href)
  url.protocol = demoOrigin.protocol
  url.host = demoOrigin.host
  return url
}

export function prototypeMfaUrlAllowed(url: URL, demoOrigin?: URL): boolean {
  return isPrototypeLocalHostname(url.hostname) || Boolean(demoOrigin && url.origin === demoOrigin.origin)
}
