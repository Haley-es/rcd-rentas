import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
export default defineNuxtConfig({
  extends: [root],
  rootDir: root,
  srcDir: fileURLToPath(new URL('../../../../app/', import.meta.url)),
  serverDir: fileURLToPath(new URL('../../../../server/', import.meta.url)),
  buildDir: fileURLToPath(new URL('../../../../node_modules/.cache/prototype-auth-e2e/', import.meta.url)),
  runtimeConfig: {
    prototypeAuth: { e2e: true, challengeTtlMs: 1800, sessionTtlMs: 3000 },
  },
  nitro: {
    handlers: [
      { route: '/api/prototype/slow', handler: fileURLToPath(new URL('./slow.ts', import.meta.url)).replaceAll('\\', '/') },
    ],
  },
  hooks: {
    'pages:extend'(pages) {
      pages.push({
        name: 'auth-expiry', path: '/auth-expiry',
        file: fileURLToPath(new URL('./expiry.vue', import.meta.url)).replaceAll('\\', '/'),
      })
    },
  },
})
