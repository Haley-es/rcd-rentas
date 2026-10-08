import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e', testMatch: ['prototype-09-persistence.spec.ts', 'prototype-10-files.spec.ts', 'prototype-history.spec.ts', 'prototype-access-roles.spec.ts'],
  fullyParallel: false, workers: 1, timeout: 120_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3011', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
