import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of every game's rules in a real browser. Each worker starts its own server with the test hooks
// (server/e2e.ts) on, see e2e/fixtures.ts; the client is built once first.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure'
  }
});
