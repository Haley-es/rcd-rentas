import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'

const RcdTheme = definePreset(Aura, {
  semantic: {
    primary: { 50: '#f0f7f2', 100: '#dcebe1', 200: '#bad6c5', 300: '#90b59f', 400: '#648c75', 500: '#365e49', 600: '#284c39', 700: '#1e3b2e', 800: '#193227', 900: '#14281f', 950: '#0b1911' },
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
    prototypeAuth: { e2e: false, challengeTtlMs: 300_000, sessionTtlMs: 28_800_000 },
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
      meta: [
        { name: 'description', content: 'Prototipo interactivo de gestión de campañas de Renta y Modelo 720. Datos ficticios.' },
      ],
    },
  },
})
