import { defineConfig, devices } from '@playwright/test'
import { prototypeTestDatabaseURL } from './scripts/prototype-e2e.mjs'

process.env.DATABASE_URL = prototypeTestDatabaseURL()

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  testIgnore: ['prototype-09-persistence.spec.ts', 'prototype-10-files.spec.ts'],
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3011',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/prototype-e2e-dev.mjs',
    url: 'http://127.0.0.1:3011',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
