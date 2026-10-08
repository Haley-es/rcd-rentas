import { describe, expect, it } from 'vitest'
import { isPrototypeLocalHostname } from '../../shared/utils/prototype-local-host'

describe('local MFA hostnames', () => {
  it('accepts exact loopback hostnames including IPv6 URL notation', () => {
    for (const hostname of ['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]']) {
      expect(isPrototypeLocalHostname(hostname)).toBe(true)
    }
  })
  it('rejects external addresses and localhost lookalikes', () => {
    for (const hostname of ['', 'demo.example.com', 'localhost.example.com', '127.0.0.1.example.com', 'mylocalhost', '192.168.1.1', '[::2]']) {
      expect(isPrototypeLocalHostname(hostname)).toBe(false)
    }
  })
})
