import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'

const RcdTheme = definePreset(Aura, {
  semantic: {
    primary: { 50: '#f0f4fc', 100: '#e2e9f8', 200: '#c6d5ee', 300: '#9cb8e0', 400: '#638bcc', 500: '#243588', 600: '#22328a', 700: '#1c2a73', 800: '#17225e', 900: '#121b49', 950: '#0d1233' },
  },
})

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  hooks: {
    'vite:extendConfig'(config, { isServer }) {
      if (!isServer) return
      const shared = decodeURIComponent(new URL('./shared/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')
      // Bundle local shared utilities: Rolldown 8 rewrites their absolute externals incorrectly on Windows.
      for (const build of [config.build, config.environments?.ssr?.build]) {
        const options = build?.rolldownOptions
        if (options && Array.isArray(options.external)) {
          options.external = options.external.filter(entry =>
            entry !== '#shared' && !(entry instanceof RegExp && entry.test(shared)))
        }
      }
    },
  },
  runtimeConfig: {
    prototypeAuth: { e2e: false, challengeTtlMs: 300_000, sessionTtlMs: 28_800_000,
      adminUsername: '', adminPasswordHash: '', employeeUsername: '', employeePasswordHash: '' },
  },
  modules: ['@primevue/nuxt-module'],
  css: ['primeicons/primeicons.css', '~/assets/css/main.css'],
  primevue: {
    options: {
      theme: {
        preset: RcdTheme,
        options: { darkModeSelector: false },
      },
    },
  },
  app: {
    head: {
      title: 'RCD · Campañas fiscales',
      htmlAttrs: { lang: 'es' },
      link: [{ rel: 'stylesheet', href: '/brand/rcd.css' }, { rel: 'icon', href: '/brand/rcd-logo.png', type: 'image/png' }],
      meta: [
        { name: 'description', content: 'Prototipo interactivo de gestión de campañas de Renta y Modelo 720. Datos ficticios.' },
      ],
    },
  },
})
