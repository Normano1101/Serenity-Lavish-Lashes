// Button tests for the admin dashboard (demo mode: anyone can open it and nothing real changes).
import { test, expect } from '@playwright/test';
import { watchForErrors } from './helpers.js';

// Add an appointment through the "New Appointment" pop-up and wait for it to be saved.
async function addAppointment(page, name) {
    await page.getByRole('button', { name: 'New Appointment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add appointment' });
    await dialog.getByLabel('Client name').fill(name);
    await dialog.getByLabel('Email').fill('client@example.com');
    await dialog.getByLabel('Phone').fill('555-0101');
    await dialog.getByLabel('Service').selectOption({ index: 1 });

    // Try the next few days until one has a free time.
    const timeSelect = dialog.getByLabel('Available time');
    for (let days = 1; days <= 14; days += 1) {
        const date = new Date(Date.now() + days * 86_400_000);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        await dialog.getByLabel('Date').fill(key);
        if (await timeSelect.locator('option:not([disabled])').count()) break;
    }
    await timeSelect.selectOption({ index: 1 });
    await dialog.getByRole('button', { name: 'Add appointment' }).click();
    await expect(page.getByText('Appointment added successfully.')).toBeVisible();
    return page.locator('#clients tbody tr', { hasText: name });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Appointment Calendar' })).toBeVisible();
});

test('sidebar links highlight and jump to their section', async ({ page }) => {
    const sidebar = page.getByRole('navigation', { name: 'Admin dashboard' });
    for (const [label, id] of [['Clients', 'clients'], ['Services', 'services'], ['Availability', 'availability'], ['Reports', 'reports'], ['Appointments', 'appointments-calendar']]) {
        await sidebar.getByRole('link', { name: label }).click();
        await expect(sidebar.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect(page.locator(`#${id}`)).toBeInViewport();
    }
});

test('add, view, edit, confirm, reschedule and cancel an appointment', async ({ page }) => {
    const checkErrors = watchForErrors(page);
    const row = await addAppointment(page, 'Test Client');
    await expect(row).toContainText('confirmed');

    // Details pop-up, and its Edit button switches to the edit form.
    await row.getByRole('button', { name: 'Details' }).click();
    const details = page.getByRole('dialog', { name: 'Client details' });
    await expect(details).toContainText('client@example.com');
    await details.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit appointment' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Edit the name.
    await row.getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit appointment' });
    await edit.getByLabel('Client name').fill('Renamed Client');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Appointment updated.')).toBeVisible();
    const renamed = page.locator('#clients tbody tr', { hasText: 'Renamed Client' });
    await expect(renamed).toBeVisible();

    // Reschedule to another free time.
    await renamed.getByRole('button', { name: 'Reschedule' }).click();
    const reschedule = page.getByRole('dialog', { name: 'Reschedule appointment' });
    await reschedule.getByLabel('Available time').selectOption({ index: 2 });
    await reschedule.getByRole('button', { name: 'Save new time' }).click();
    await expect(page.getByText('Appointment rescheduled.')).toBeVisible();

    // Cancel: the site asks "are you sure?" first; say yes.
    page.once('dialog', (dialog) => dialog.accept());
    await renamed.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Appointment cancelled.')).toBeVisible();
    await expect(renamed).toContainText('cancelled');
    await expect(renamed.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
    checkErrors();
});

test('saying "no" to cancel keeps the appointment', async ({ page }) => {
    const row = await addAppointment(page, 'Keep Me');
    page.once('dialog', (dialog) => dialog.dismiss());
    await row.getByRole('button', { name: 'Cancel' }).click();
    await expect(row).toContainText('confirmed');
});

test('Cancel inside the details pop-up cancels the appointment', async ({ page }) => {
    const row = await addAppointment(page, 'Details Cancel');
    await row.getByRole('button', { name: 'Details' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('dialog', { name: 'Client details' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(row).toContainText('cancelled');
});

test('a pending booking can be confirmed', async ({ page }) => {
    // Customer bookings arrive as "pending"; make one through the booking page.
    await page.goto('/booking');
    await page.locator('#service').selectOption({ index: 1 });
    const day = page.getByRole('button', { name: /, available$/ }).first();
    if (!(await day.isVisible())) await page.getByRole('button', { name: 'Next month' }).click();
    await day.click();
    await page.locator('.booking-time-grid button').first().click();
    await page.getByLabel('Name').fill('Pending Person');
    await page.getByLabel('Phone').fill('555-0102');
    await page.getByLabel('Email').fill('pending@example.com');
    await page.getByRole('button', { name: /Submit/ }).click();

    await page.goto('/admin');
    const row = page.locator('#clients tbody tr', { hasText: 'Pending Person' });
    await expect(row).toContainText('pending');
    await row.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Appointment confirmed.')).toBeVisible();
    await expect(row).toContainText('confirmed');
});

test('the filter and Refresh button work', async ({ page }) => {
    await addAppointment(page, 'Filter Client');
    const filter = page.locator('#clients').getByLabel('Show');
    // "Cancelled" hides the new (confirmed) appointment and shows only cancelled ones.
    await filter.selectOption('cancelled');
    await expect(page.locator('#clients')).not.toContainText('Filter Client');
    for (const status of await page.locator('#clients .status-tag').allTextContents()) expect(status).toBe('cancelled');
    await filter.selectOption('confirmed');
    await expect(page.locator('#clients')).toContainText('Filter Client');
    await page.locator('#clients').getByRole('button', { name: 'Refresh' }).click();
    await expect(page.locator('#clients')).toContainText('Filter Client');
});

test('calendar view, arrows, Today and side buttons work', async ({ page }) => {
    const checkErrors = watchForErrors(page);
    const calendar = page.locator('#appointments-calendar');
    const datePicker = calendar.getByLabel('Choose a date');
    const today = await datePicker.inputValue();

    for (const view of ['Day', 'Week', 'Month']) {
        await calendar.getByRole('button', { name: view, exact: true }).click();
        await expect(calendar.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    await calendar.getByRole('button', { name: 'Day', exact: true }).click();
    await calendar.getByRole('button', { name: 'Next period' }).click();
    await expect(datePicker).not.toHaveValue(today);
    await calendar.getByRole('button', { name: 'Previous period' }).click();
    await expect(datePicker).toHaveValue(today);
    await calendar.getByRole('button', { name: 'Next period' }).click();
    await calendar.getByRole('button', { name: 'Today' }).click();
    await expect(datePicker).toHaveValue(today);

    await calendar.getByRole('button', { name: 'Add Appointment' }).click();
    await expect(page.getByRole('dialog', { name: 'Add appointment' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await calendar.getByRole('button', { name: 'Edit Availability' }).click();
    await expect(page.locator('#availability')).toBeInViewport();
    await page.locator('#appointments-calendar').scrollIntoViewIfNeeded();
    await calendar.getByRole('button', { name: 'Block Time' }).click();
    await expect(page.locator('#block-time')).toBeInViewport();
    checkErrors();
});

test('schedule: add and remove a break, then save', async ({ page }) => {
    const checkErrors = watchForErrors(page);
    const schedule = page.locator('#availability');
    const monday = schedule.locator('fieldset.schedule-day', { has: page.locator('legend', { hasText: 'Monday' }) });
    const breaks = monday.locator('.schedule-break-row');
    const before = await breaks.count();

    await monday.getByRole('button', { name: 'Add break' }).click();
    await expect(breaks).toHaveCount(before + 1);
    await breaks.last().getByRole('button', { name: 'Remove' }).click();
    await expect(breaks).toHaveCount(before);

    await schedule.getByRole('button', { name: 'Save Schedule' }).click();
    await expect(schedule.locator('.form-success')).toBeVisible();
    checkErrors();
});

test('live-only panels are clearly switched off in demo mode', async ({ page }) => {
    await expect(page.locator('#services').getByRole('button', { name: 'Add lash set' })).toBeDisabled();
    await expect(page.getByText('Supabase is not configured. Date rules cannot be loaded or saved.')).toBeVisible();
});
