-- Appointments start every 2 hours from opening time (for example 9:00, 11:00, 1:00, 3:00).
-- The admin dashboard no longer offers other intervals, and it always saves 120 minutes.
-- The availability function reads this value to space out the start times it offers.
update public.booking_settings
set booking_interval_minutes = 120,
    updated_at = now()
where id = true;

-- New databases created from these migrations start with the 2-hour interval too.
alter table public.booking_settings
    alter column booking_interval_minutes set default 120;
