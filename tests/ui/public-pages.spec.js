// Button tests for the customer pages (runs in demo mode, so nothing real is changed).
import { test, expect } from '@playwright/test';
import { watchForErrors } from './helpers.js';

// Each sidebar link, the address it should open, and the heading on that page.
const PAGES = [
    { link: 'Home', path: '/', heading: 'Luxury Lash Extensions' },
    { link: 'About', path: '/about', heading: 'About Me' },
    { link: 'Portfolio', path: '/portfolio', heading: 'Welcome to My Lash Portfolio!' },
    { link: 'Pricing', path: '/pricing', heading: 'Price List' },
    { link: 'Book', path: '/booking', heading: 'Book Your Appointment' },
    { link: 'Reviews', path: '/reviews', heading: 'See What My Clients Are Saying!' }
];

test('every sidebar link opens the right page', async ({ page }) => {
    const checkErrors = watchForErrors(page);
    await page.goto('/');
    for (const { link, path, heading } of PAGES) {
        await page.getByRole('navigation').getByRole('link', { name: link, exact: true }).click();
        await expect(page).toHaveURL(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
    checkErrors();
});

test('home page buttons go to booking and portfolio', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('main').getByRole('link', { name: 'Book Your Appointment' }).click();
    await expect(page).toHaveURL('/booking');

    await page.goto('/');
    await page.getByRole('link', { name: 'View My Work' }).click();
    await expect(page).toHaveURL('/portfolio');
});

test('old /book address and unknown addresses redirect', async ({ page }) => {
    await page.goto('/book');
    await expect(page).toHaveURL('/booking');
    await page.goto('/this-page-does-not-exist');
    await expect(page).toHaveURL('/');
});

test('footer Instagram link opens Instagram in a new tab', async ({ page }) => {
    await page.goto('/');
    const instagram = page.getByRole('link', { name: 'Visit our Instagram' });
    await expect(instagram).toHaveAttribute('href', /instagram\.com/);
    await expect(instagram).toHaveAttribute('target', '_blank');
});

test('portfolio arrows, thumbnails and enlarged view all work', async ({ page }) => {
    const checkErrors = watchForErrors(page);
    await page.goto('/portfolio');
    const slideshow = page.getByRole('region', { name: 'Lash portfolio slideshow' });
    const firstThumb = slideshow.getByRole('button', { name: 'Show portfolio photo 1', exact: true });
    const secondThumb = slideshow.getByRole('button', { name: 'Show portfolio photo 2', exact: true });
    await expect(firstThumb).toHaveAttribute('aria-current', 'true');

    // Next and previous arrows move between photos.
    await slideshow.getByRole('button', { name: 'Next photo' }).click();
    await expect(secondThumb).toHaveAttribute('aria-current', 'true');
    await slideshow.getByRole('button', { name: 'Previous photo' }).click();
    await expect(firstThumb).toHaveAttribute('aria-current', 'true');

    // Clicking a thumbnail selects it, without jumping the page.
    await slideshow.getByRole('button', { name: 'Show portfolio photo 3', exact: true }).scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await slideshow.getByRole('button', { name: 'Show portfolio photo 3', exact: true }).click();
    await expect(slideshow.getByRole('button', { name: 'Show portfolio photo 3', exact: true })).toHaveAttribute('aria-current', 'true');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    // The big photo opens an enlarged view with its own arrows; Close and Escape shut it.
    await slideshow.getByRole('button', { name: 'Open enlarged portfolio photo' }).click();
    const lightbox = page.getByRole('dialog', { name: 'Enlarged portfolio photo' });
    await expect(lightbox.getByRole('img')).toHaveAttribute('alt', /photo 3$/);
    await lightbox.getByRole('button', { name: 'Next photo' }).click();
    await expect(lightbox.getByRole('img')).toHaveAttribute('alt', /photo 4$/);
    await lightbox.getByRole('button', { name: 'Previous photo' }).click();
    await expect(lightbox.getByRole('img')).toHaveAttribute('alt', /photo 3$/);
    await lightbox.getByRole('button', { name: 'Close enlarged photo' }).click();
    await expect(lightbox).toBeHidden();

    await slideshow.getByRole('button', { name: 'Open enlarged portfolio photo' }).click();
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    checkErrors();
});

test('pricing page lists services', async ({ page }) => {
    const checkErrors = watchForErrors(page);
    await page.goto('/pricing');
    await expect(page.getByRole('region', { name: 'Eyelash extension pricing' })).toContainText(/Full Set/);
    checkErrors();
});

test('admin sign-in page loads', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
