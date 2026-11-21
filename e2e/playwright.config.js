import { defineConfig } from '@playwright/test'

// Runs against an already running GatePass stack (see README "End-to-end tests").
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://localhost:8443',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: process.env.E2E_OUTPUT_DIR || 'test-results',
})
