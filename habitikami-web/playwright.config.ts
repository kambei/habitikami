import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (issue #121): the built app served by `vite preview`, Google
 * stubbed in the browser. Run locally with `npm run build && npm run test:e2e`
 * (needs `npx playwright install chromium` once); not part of the CI on purpose,
 * the browser install there is slow.
 */
export default defineConfig({
    testDir: 'e2e',
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
        locale: 'en-US',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npx vite preview --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
