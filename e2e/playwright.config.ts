import { defineConfig } from '@playwright/test';

// Real Google Chrome (channel: 'chrome') against the production build served by `vite preview`
// (./stack.sh). The app has no backend; every test starts from a fresh browser context, so the
// board is the seed until the test changes it. PW_CHANNEL picks another installed channel
// (for example msedge, or chromium for Playwright's own build after `npx playwright install chromium`).
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    channel: process.env.PW_CHANNEL || 'chrome',
    headless: true,
    video: 'on',
    trace: 'on',
    screenshot: 'on',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ],
});
