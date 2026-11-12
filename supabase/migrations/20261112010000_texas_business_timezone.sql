-- Run the business on Texas (US Central) time instead of UTC.
-- Availability uses this zone to decide what "today" and "now" are, so customers in Texas
-- are not offered times that have already passed, and the day rolls over at local midnight.
-- 'America/Chicago' is the IANA name for US Central Time and switches between CST and CDT
-- automatically for daylight saving. (El Paso and Hudspeth counties use 'America/Denver'.)
-- Saved weekly hours are local clock times and are not shifted by this change.
update public.booking_settings
set business_timezone = 'America/Chicago',
    updated_at = now()
where id = true;

-- New databases created from these migrations start on Texas time too.
alter table public.booking_settings
    alter column business_timezone set default 'America/Chicago';
