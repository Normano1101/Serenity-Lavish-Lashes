// Button tests for the booking page: a customer books from start to finish (demo mode).
import { test, expect } from '@playwright/test';
import { watchForErrors } from './helpers.js';

// Choose a service, then the first available day (moving to next month if this one is full).
async function chooseServiceAndDay(page) {
    await page.locator('#service').selectOption({ index: 1 });
    const availableDay = page.getByRole('button', { name: /, available$/ }).first();
    if (!(await availableDay.isVisible())) await page.getByRole('button', { name: 'Next month' }).click();
    await availableDay.click();
}

test('a customer can book an appointment and it appears in the admin demo', async ({ page }) => {
    const checkErrors = watchForErrors(page);
    await page.goto('/booking');
    const submit = page.getByRole('button', { name: /Submit (demo|appointment) request/ });

    // Nothing can be picked or submitted before a service is chosen.
    await expect(submit).toBeDisabled();
    await expect(page.getByText('Choose a service first to see available times.')).toBeVisible();

    await chooseServiceAndDay(page);
    await page.locator('.booking-time-grid button').first().click();
    await expect(page.locator('.booking-time-grid button').first()).toHaveAttribute('aria-pressed', 'true');

    await page.getByLabel('Name').fill('Playwright Customer');
    await page.getByLabel('Phone').fill('555-0100');
    await page.getByLabel('Email').fill('customer@example.com');
    await expect(page.getByRole('region', { name: 'Booking details' })).toBeVisible();
    await submit.click();

    await expect(page.getByRole('status').filter({ hasText: 'Status: pending' })).toBeVisible();

    // The confirmation links to the admin demo, where the booking is listed.
    await page.getByRole('link', { name: 'View it in the development admin demo' }).click();
    await expect(page.locator('#clients')).toContainText('Playwright Customer');
    checkErrors();
});

test('changing the service clears the chosen date', async ({ page }) => {
    await page.goto('/booking');
    await chooseServiceAndDay(page);
    await expect(page.locator('.booking-time-grid')).toBeVisible();
    await page.locator('#service').selectOption({ index: 2 });
    await expect(page.getByText('Choose an available date on the calendar.')).toBeVisible();
});

test('month arrows change the calendar month', async ({ page }) => {
    await page.goto('/booking');
    const heading = page.locator('.booking-calendar-header h3');
    const thisMonth = await heading.textContent();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(heading).not.toHaveText(thisMonth);
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(heading).toHaveText(thisMonth);
});

test('the email box rejects text that is not an email', async ({ page }) => {
    await page.goto('/booking');
    await chooseServiceAndDay(page);
    await page.locator('.booking-time-grid button').first().click();
    await page.getByLabel('Name').fill('Someone');
    await page.getByLabel('Phone').fill('555-0100');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: /Submit (demo|appointment) request/ }).click();
    // The browser blocks the form, so no confirmation appears.
    expect(await page.getByLabel('Email').evaluate((input) => input.validity.valid)).toBe(false);
    await expect(page.getByText('Status: pending')).toHaveCount(0);
});
