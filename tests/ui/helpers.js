// Shared helpers for the button tests.
import { expect } from '@playwright/test';

// Collect browser errors while a test runs, so a broken button that only logs an error
// (instead of showing one) still fails the test. Call the returned function at the end.
export function watchForErrors(page) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        // Missing files are reported below with their address instead.
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text());
    });
    page.on('response', (response) => {
        if (response.status() >= 400) errors.push(`${response.status()} missing file: ${response.url()}`);
    });
    return () => expect(errors, 'the browser reported errors').toEqual([]);
}

// Today's date as YYYY-MM-DD in this computer's timezone (same as the site uses in demo mode).
export function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
