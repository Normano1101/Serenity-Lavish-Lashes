-- Replace weekly hours and breaks atomically after validating the submitted schedule.
create or replace function public.save_business_schedule(
    p_booking_interval_minutes integer,
    p_weekly_schedule jsonb,
    p_schedule_breaks jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_day jsonb;
    v_break jsonb;
    v_day_of_week integer;
    v_is_open boolean;
    v_opens_at time;
    v_closes_at time;
    v_starts_at time;
    v_ends_at time;
    v_days integer[] := '{}';
begin
    -- Only business admins can update the shared booking schedule.
    if not public.is_business_admin() then
        raise exception 'Only owners and super admins can manage the business schedule'
            using errcode = '42501';
    end if;

    if p_booking_interval_minutes is null
        or p_booking_interval_minutes not in (15, 30, 45, 60, 90, 120) then
        raise exception 'The booking interval is invalid';
    end if;

    if jsonb_typeof(p_weekly_schedule) is distinct from 'array'
        or jsonb_typeof(p_schedule_breaks) is distinct from 'array' then
        raise exception 'The schedule data must be provided as arrays';
    end if;

    if jsonb_array_length(p_weekly_schedule) <> 7 then
        raise exception 'The schedule or booking interval is invalid';
    end if;

    -- Upsert exactly one valid open/closed entry for every day of the week.
    for v_day in select value from jsonb_array_elements(p_weekly_schedule)
    loop
        v_day_of_week := (v_day ->> 'day_of_week')::integer;
        v_is_open := (v_day ->> 'is_open')::boolean;
        v_opens_at := nullif(v_day ->> 'opens_at', '')::time;
        v_closes_at := nullif(v_day ->> 'closes_at', '')::time;

        if v_day_of_week not between 0 and 6
            or v_day_of_week = any(v_days)
            or (v_is_open and (v_opens_at is null or v_closes_at is null or v_closes_at <= v_opens_at))
            or (not v_is_open and (v_opens_at is not null or v_closes_at is not null)) then
            raise exception 'A weekly schedule day is invalid';
        end if;

        v_days := array_append(v_days, v_day_of_week);
        insert into public.weekly_schedule (day_of_week, is_open, opens_at, closes_at)
        values (v_day_of_week, v_is_open, v_opens_at, v_closes_at)
        on conflict (day_of_week) do update
        set is_open = excluded.is_open,
            opens_at = excluded.opens_at,
            closes_at = excluded.closes_at;
    end loop;

    if cardinality(v_days) <> 7 then
        raise exception 'Provide exactly one schedule entry for every weekday';
    end if;

    -- Replace all weekly breaks after validating each one against its open day.
    delete from public.schedule_breaks;
    for v_break in select value from jsonb_array_elements(p_schedule_breaks)
    loop
        v_day_of_week := (v_break ->> 'day_of_week')::integer;
        v_starts_at := (v_break ->> 'starts_at')::time;
        v_ends_at := (v_break ->> 'ends_at')::time;

        if not exists (
            select 1 from public.weekly_schedule s
            where s.day_of_week = v_day_of_week
                and s.is_open
                and s.opens_at <= v_starts_at
                and s.closes_at >= v_ends_at
        ) or v_ends_at <= v_starts_at then
            raise exception 'Breaks must fall within an open day and its business hours';
        end if;

        insert into public.schedule_breaks (day_of_week, starts_at, ends_at, label)
        values (
            v_day_of_week,
            v_starts_at,
            v_ends_at,
            coalesce(nullif(v_break ->> 'label', ''), 'Break')
        );
    end loop;

    update public.booking_settings
    set booking_interval_minutes = p_booking_interval_minutes,
        updated_at = now()
    where id = true;
end;
$$;

revoke all on function public.save_business_schedule(integer, jsonb, jsonb) from public, anon;
grant execute on function public.save_business_schedule(integer, jsonb, jsonb) to authenticated;
