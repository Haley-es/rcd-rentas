export function prototypeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return '/'
  }
  if (/[\u0000-\u0020\\]/.test(decoded) || decoded.startsWith('//')) return '/'
  const url = new URL(decoded, 'http://localhost')
  if (url.origin !== 'http://localhost' || /^\/(?:login|mfa)(?:\/|$)/i.test(url.pathname)) return '/'
  return value
}
