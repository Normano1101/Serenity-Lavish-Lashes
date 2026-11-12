-- Give every lash service (full sets and fills, active or not) a standard 1 hour 30 minute appointment.
-- Booking availability uses duration_minutes to size time slots, and services without a
-- duration cannot be booked online, so this also makes Anime Lashes bookable.
-- Only the duration changes; names, prices, photos and active status are left as they are.
-- Safe to run more than once. Existing appointments keep the duration they were booked with.
update public.services
set duration_minutes = 90
where duration_minutes is distinct from 90;
