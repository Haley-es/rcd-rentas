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
