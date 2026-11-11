// Test settings. Run with:  npm test   (or npm run test:security / npm run test:ui)
//
// Two groups of tests:
//   security - pretends to be a random visitor and tries to read private data or write junk
//              into the REAL Supabase database. Every attempt must be blocked.
//   ui       - opens the site in Chrome in DEMO mode (no database) and clicks every button.
import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

// Read the public Supabase address and key from .env.local for the security tests.
// They're stored under TEST_ names so they never leak into the demo-mode web server below.
const env = loadEnv('development', process.cwd(), 'VITE_');
process.env.TEST_SUPABASE_URL ??= env.VITE_SUPABASE_URL ?? '';
process.env.TEST_SUPABASE_KEY ??= env.VITE_SUPABASE_ANON_KEY ?? '';

const PORT = 5199;

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    // The dev server is occasionally slow when several browsers load it at once. One retry
    // absorbs that; a test that only passes on retry is still reported as "flaky".
    retries: 1,
    workers: 3,
    reporter: [['list']],
    projects: [
        { name: 'security', testDir: './tests/security' },
        // unit - checks shared rules (like price validation) directly, without a browser.
        { name: 'unit', testDir: './tests/unit' },
        {
            name: 'ui',
            testDir: './tests/ui',
            use: {
                baseURL: `http://localhost:${PORT}`,
                channel: 'chrome', // use the Chrome already installed on this computer
                viewport: { width: 1280, height: 900 }
            }
        }
    ],
    // Start a separate copy of the site in demo mode: blank keys = browser-only storage,
    // so the button tests can add, edit and cancel things without touching real data.
    webServer: {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }
    }
});
