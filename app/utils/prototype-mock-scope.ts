import type { NuxtApp } from '#app'

// Kept as the auth cleanup contract; there is no private mock dataset anymore.
export function clearPrototypeMockScope(app: NuxtApp) {
  for (const key of ['prototype-snapshot', 'prototype-portal-snapshot']) {
    app.payload.state[`$s${key}`] = null
  }
}
