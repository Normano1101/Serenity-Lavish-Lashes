// Database security tests. These connect to the REAL Supabase project as an anonymous
// visitor (using only the public key that every website visitor already has) and check
// that private data can't be read and that nothing can be added, changed or deleted.
//
// Safe to run on the live site: every "attack" uses data the database would reject anyway
// (an impossible value or a row that doesn't exist). So even if a protection were broken,
// nothing would be saved; the test would just fail and tell you which protection is missing.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_KEY;
const NO_SUCH_ID = '00000000-0000-0000-0000-000000000000';

test.skip(!url || !key, 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to run these tests.');

// A brand-new visitor who is not signed in.
const visitor = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// "Blocked" means the database answered "permission denied" (Postgres code 42501).
function expectPermissionDenied(result, what) {
    expect(result.error, `${what} should be refused, but it was allowed`).toBeTruthy();
    expect(result.error.code, `${what} failed for the wrong reason: ${result.error.message}`).toBe('42501');
}

test.describe('Private information cannot be read by visitors', () => {
    test('appointments (client names, emails, phones) are hidden', async () => {
        const { data, error } = await visitor().from('appointments').select('*').limit(5);
        expect(error?.code ?? 'no rows', 'appointments must be refused').toBe('42501');
        expect(data ?? []).toHaveLength(0);
    });

    test('admin account profiles are hidden', async () => {
        const { data, error } = await visitor().from('profiles').select('*').limit(5);
        expect(error?.code).toBe('42501');
        expect(data ?? []).toHaveLength(0);
    });

    test('only active services are visible', async () => {
        const { data, error } = await visitor().from('services').select('name, is_active');
        expect(error).toBeNull();
        expect(data.filter((row) => !row.is_active)).toEqual([]);
    });

    test('only active add-ons are visible', async () => {
        const { data, error } = await visitor().from('service_addons').select('name, is_active');
        expect(error).toBeNull();
        expect(data.filter((row) => !row.is_active)).toEqual([]);
    });

    test('only published portfolio photos are visible', async () => {
        const { data, error } = await visitor().from('portfolio_photos').select('storage_path, is_published');
        expect(error).toBeNull();
        expect(data.filter((row) => !row.is_published)).toEqual([]);
    });

    test('the availability lookup returns open times only, never client details', async () => {
        const client = visitor();
        const { data: services } = await client.from('services').select('id').limit(1);
        test.skip(!services?.length, 'No active services to check availability for.');

        const today = new Date().toISOString().slice(0, 10);
        const inAMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
        const { data, error } = await client.rpc('get_public_availability', {
            p_start_date: today, p_end_date: inAMonth, p_service_id: services[0].id
        });
        expect(error).toBeNull();
        for (const slot of data) {
            expect(Object.keys(slot).sort()).toEqual(['available_date', 'starts_at_time']);
        }
    });

    test('a visitor is not treated as an admin', async () => {
        const client = visitor();
        const { data } = await client.rpc('is_business_admin');
        expect(data ?? false).toBe(false);
        expectPermissionDenied(await client.rpc('current_admin_role'), 'Reading the admin role');
    });
});

// One impossible row per table. Each also breaks a database rule, as a second safety net.
const JUNK_ROWS = {
    appointments: {
        customer_name: '', customer_email: 'x', customer_phone: 'x', service_id: NO_SUCH_ID,
        appointment_date: '2000-01-01', starts_at_time: '10:00', duration_minutes: -1
    },
    services: { name: 'SECURITY TEST', duration_minutes: -1 },
    service_addons: { name: '', price: -1 },
    booking_settings: { id: false, booking_interval_minutes: 7 },
    weekly_schedule: { day_of_week: 99 },
    schedule_breaks: { day_of_week: 99, starts_at: '12:00', ends_at: '11:00' },
    date_rules: { rule_date: '2000-01-01', rule_type: 'hacked' },
    portfolio_photos: { storage_path: null },
    profiles: { id: NO_SUCH_ID, role: 'hacker' }
};

// An impossible change for each table, aimed at rows that don't exist.
const JUNK_UPDATES = {
    appointments: [{ status: 'hacked' }, 'id', NO_SUCH_ID],
    services: [{ duration_minutes: -1 }, 'id', NO_SUCH_ID],
    service_addons: [{ price: -1 }, 'id', NO_SUCH_ID],
    booking_settings: [{ booking_interval_minutes: 7 }, 'id', false],
    weekly_schedule: [{ day_of_week: 99 }, 'day_of_week', 99],
    schedule_breaks: [{ day_of_week: 99 }, 'id', NO_SUCH_ID],
    date_rules: [{ rule_type: 'hacked' }, 'id', NO_SUCH_ID],
    portfolio_photos: [{ storage_path: null }, 'id', NO_SUCH_ID],
    profiles: [{ role: 'hacker' }, 'id', NO_SUCH_ID]
};

test.describe('Visitors cannot add, change or delete anything', () => {
    for (const [table, row] of Object.entries(JUNK_ROWS)) {
        test(`cannot add to ${table}`, async () => {
            expectPermissionDenied(await visitor().from(table).insert(row), `Adding to ${table}`);
        });

        test(`cannot change ${table}`, async () => {
            const [changes, column, value] = JUNK_UPDATES[table];
            expectPermissionDenied(
                await visitor().from(table).update(changes).eq(column, value),
                `Changing ${table}`
            );
        });

        test(`cannot delete from ${table}`, async () => {
            const [, column, value] = JUNK_UPDATES[table];
            expectPermissionDenied(
                await visitor().from(table).delete().eq(column, value),
                `Deleting from ${table}`
            );
        });
    }

    test('cannot change the real business settings (even to the same value)', async () => {
        const client = visitor();
        const { data } = await client.from('booking_settings').select('booking_interval_minutes').maybeSingle();
        test.skip(!data, 'No booking settings row is visible.');
        expectPermissionDenied(
            await client.from('booking_settings').update({ booking_interval_minutes: 7 }).eq('id', true),
            'Changing the booking settings'
        );
    });
});

test.describe('Admin-only actions are refused for visitors', () => {
    test('cannot make anyone an admin', async () => {
        expectPermissionDenied(
            await visitor().rpc('manage_admin_role', { target_user_id: NO_SUCH_ID, new_role: 'hacker' }),
            'Changing an admin role'
        );
    });

    test('cannot change the business hours', async () => {
        expectPermissionDenied(
            await visitor().rpc('save_business_schedule', {
                p_booking_interval_minutes: 7, p_weekly_schedule: [], p_schedule_breaks: []
            }),
            'Saving the business schedule'
        );
    });

    test('cannot create or edit services', async () => {
        expectPermissionDenied(
            await visitor().rpc('save_lash_service', {
                p_full_service_id: NO_SUCH_ID, p_name: '', p_description: null, p_image_urls: [],
                p_full_set_price: -1, p_refill_two_week_price: -1, p_refill_three_week_price: -1,
                p_full_set_duration: -1, p_refill_duration: -1, p_is_active: false
            }),
            'Saving a service'
        );
    });
});

test.describe('The public booking form rejects junk', () => {
    const goodLooking = {
        p_customer_name: 'Test Person', p_customer_email: 'test@example.com', p_customer_phone: '5550100',
        p_service_id: NO_SUCH_ID, p_appointment_date: '2000-01-01', p_starts_at_time: '10:00'
    };
    const book = (changes) => visitor().rpc('create_public_appointment', { ...goodLooking, ...changes });

    test('an empty name is refused', async () => {
        const { error } = await book({ p_customer_name: '   ' });
        expect(error?.message).toMatch(/valid contact information/i);
    });

    test('a 10,000-character name is refused', async () => {
        const { error } = await book({ p_customer_name: 'A'.repeat(10_000) });
        expect(error?.message).toMatch(/valid contact information/i);
    });

    test('a phone number that is too short is refused', async () => {
        const { error } = await book({ p_customer_phone: '1' });
        expect(error?.message).toMatch(/valid contact information/i);
    });

    test('a made-up service is refused', async () => {
        const { error } = await book({});
        expect(error?.message).toMatch(/service is not available/i);
    });

    test('a database-hacking attempt in the name is treated as plain text and refused', async () => {
        const { error } = await book({ p_customer_name: "x'); delete from appointments; --" });
        expect(error?.message).toMatch(/service is not available/i);
    });

    test('a date in the past is refused', async () => {
        const { data: services } = await visitor().from('services').select('id').not('duration_minutes', 'is', null).limit(1);
        test.skip(!services?.length, 'No bookable services to test with.');
        const { data, error } = await book({ p_service_id: services[0].id });
        expect(data).toBeNull();
        expect(error, 'a booking in the year 2000 should be refused').toBeTruthy();
    });
});

test.describe('Photo storage is protected', () => {
    // A tiny text file: storage only accepts images, so even a broken rule couldn't store it.
    const junkFile = new Blob(['security test'], { type: 'text/plain' });

    for (const bucket of ['serenity-service-images', 'serenity-portfolio']) {
        test(`visitors cannot upload to ${bucket}`, async () => {
            const { data, error } = await visitor().storage.from(bucket).upload(`security-test-${Date.now()}.txt`, junkFile);
            expect(data).toBeNull();
            expect(error).toBeTruthy();
        });
    }
});
