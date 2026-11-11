import { defineConfig } from '@playwright/test'

// Browser tests run against a production build (offline support only exists
// there), served like GitHub Pages under /match-games/.
export default defineConfig({
  testDir: 'e2e',
  // The test server has shared state (site up/down/new version), so tests
  // run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/match-games/',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    // Lets environments without Playwright's own Chromium use a system one.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npx vite build --outDir e2e/.dist --emptyOutDir --logLevel warn && node e2e/server.mjs',
    env: { BASE_PATH: '/match-games/' },
    url: 'http://localhost:4173/__control',
    // Always rebuild: a server left running would test a stale build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
