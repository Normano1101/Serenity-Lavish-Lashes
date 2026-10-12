# Supabase admin foundation setup

This repository includes a Supabase Auth client, protected admin routes, a super-admin account role screen, and PostgreSQL migrations with RLS policies. Appointment administration and schedule editing still use browser `localStorage`; do not treat those admin workflows as shared production features.

## Configure the project

1. Create a Supabase project and set the project Authentication URL configuration for the local and production website URLs.
2. In Supabase Authentication settings, disable public sign-ups. Create the first account from the Supabase dashboard using a unique, strong password. The auth trigger creates a profile with role `unassigned`, which grants no business permissions.
3. In the Supabase SQL Editor, run the migration files in timestamp order:
   - `migrations/20261012000000_secure_admin_booking.sql`
   - `migrations/20261012010000_full_set_and_fill_durations.sql`
   - `migrations/20261012020000_managed_lash_services.sql`
   - `migrations/20261012030000_initial_service_prices_and_addons.sql`
   - `migrations/20261012040000_public_service_catalog_access.sql`
   - `migrations/20261012050000_restore_initial_lash_catalog.sql`
4. Find the first account's immutable user UUID in **Authentication → Users**. In SQL Editor, promote only that verified account. Replace the email below with the exact email used to create the initial account:

   ```sql
   do $$
   declare
       initial_user_id uuid;
   begin
       select id into strict initial_user_id
       from auth.users
       where lower(email) = lower('REPLACE_WITH_INITIAL_ADMIN_EMAIL');

       update public.profiles
       set role = 'super_admin', updated_at = now()
       where id = initial_user_id;

       if not found then
           raise exception 'The initial account profile was not found';
       end if;
   end
   $$;
   ```

   This step runs as the database owner through the trusted SQL Editor. Do not expose an endpoint that performs first-admin bootstrap. After this promotion, use **Admin accounts** in the dashboard to assign `owner`, `super_admin`, or `unassigned` to other existing accounts. A super admin cannot change their own role from that screen.
5. Copy `.env.example` to `.env.local` and fill in the project's URL and publishable/anon key from Supabase project API settings. Never use a `service_role` key in any `VITE_*` variable or browser code.
6. Restart Vite with `npm run dev`. Open `/admin/login` and sign in with the provisioned account. Test owner and super-admin accounts separately.
7. In the Admin Dashboard, use **Services & Pricing** and **Add-Ons** to manage the shared service names, prices, refill prices, descriptions, photos, durations, and active status. Migration `20261012030000` seeds the client-provided prices only into empty price fields, seeds the five add-ons only when their names are absent, and leaves Wispy pricing unconfigured. It does not seed Brown Lashes durations.
8. Customer online bookings are disabled by default. Do not set `VITE_ENABLE_PUBLIC_BOOKINGS=true` until the real timezone, database weekly hours, schedule workflow, appointment dashboard, and booking flow have been configured and tested. The public form uses the secure availability and appointment RPCs when enabled; it never submits a price.

## What the migration protects

- `profiles.role` is not writable by ordinary authenticated users; profile updates are limited to `display_name`. Only `manage_admin_role()` can change roles, and it requires an existing super admin and forbids changing the caller's own role.
- Unprovisioned auth users receive `unassigned`, not `owner`, so an enabled public signup cannot self-enroll as an admin.
- RLS permits owners and super admins to administer business tables. Appointment rows, which contain customer contact details, are only readable by authorized admins. Anonymous clients can call an availability RPC that returns dates/times only and a booking RPC that returns only the appointment ID and pending status.
- The services table remains the single source for public pricing and booking-service prices. Public reads are restricted to active service rows; owners and super admins can edit services through a role-checked RPC. Service images use a public-read Storage bucket whose upload, update, and delete policies require an owner or super admin.
- Service changes are published through Supabase Realtime. Pricing and booking pages also fetch the latest service rows when they load.
- Add-ons are stored in `public.service_addons`, have independent active status, and are editable under owner/super-admin RLS policies.
- Anonymous public catalog reads need execute permission on the security-definer `is_business_admin()` helper used in the existing public-read RLS predicates. It returns only whether the caller is an authorized admin; granting anonymous execute lets the RLS predicate safely return false for public visitors.
- An exclusion constraint on active appointment time ranges prevents overlapping pending/confirmed appointments even when two booking requests race.
- The portfolio bucket allows public reads and restricts uploads, updates, and deletes to admins.
- The `serenity-portfolio` bucket is private; public photo delivery should use signed URLs for rows marked published.

The migrations have **not** been applied or tested against a live Supabase project in this workspace. The Admin Dashboard's appointment, schedule, calendar, and manual appointment tools still use browser `localStorage`; those workflows are not shared between admins. The customer booking form remains disabled for production unless explicitly enabled after configuration and testing.

## Before production

- Apply the migration to a non-production project first, review policies with both owner and super-admin test accounts, and test anonymous access directly through Supabase (including attempts to read appointments or modify roles).
- Migrate appointment status/rescheduling/manual entry and schedule administration to server-validated functions if those admin workflows need to be shared. Do not use direct browser writes for appointment creation; the public booking form uses the atomic database function when production booking is explicitly enabled.
- Keep customer-contact data out of all public queries.
- Choose and configure the actual business timezone. Add rate limiting/bot protection for public bookings, password reset and recovery guidance, backups, monitoring, and production redirect URLs.
- Run `npm run build` and verify all roles/policies against the actual project before deploying. A Vite `.env.local` value is public to the browser bundle; only the publishable/anon key belongs there, protected by RLS.
