import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
export default defineNuxtConfig({
  extends: [root], rootDir: root,
  srcDir: fileURLToPath(new URL('../../../../app/', import.meta.url)),
  serverDir: fileURLToPath(new URL('../../../../server/', import.meta.url)),
  buildDir: fileURLToPath(new URL('../../../../node_modules/.cache/prototype-persistence-e2e/', import.meta.url)),
  // Let negative MFA tests reach the application guard instead of Vite's host gate.
  // This fixture still binds only to 127.0.0.1.
  vite: { server: { allowedHosts: ['demo.example.com', 'localhost.example.com', '127.0.0.1.example.com'] } },
})
