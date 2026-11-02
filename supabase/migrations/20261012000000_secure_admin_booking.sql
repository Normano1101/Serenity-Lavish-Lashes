-- Create admin roles, shared booking data, row-level policies, and safe public booking RPCs.
create extension if not exists btree_gist with schema extensions;

-- A profile stores each auth user's business role; new accounts start unassigned.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text unique,
    display_name text not null default '',
    role text not null default 'unassigned'
        check (role in ('super_admin', 'owner', 'unassigned')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Read the signed-in user's role through narrowly scoped security-definer helpers.
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.role
    from public.profiles p
    where p.id = (select auth.uid())
$$;

create or replace function public.is_business_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(public.current_admin_role() in ('super_admin', 'owner'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(public.current_admin_role() = 'super_admin', false)
$$;

revoke all on function public.current_admin_role() from public, anon;
revoke all on function public.is_business_admin() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.is_business_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- Create an unprivileged profile automatically for each new auth account.
create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, display_name, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', ''),
        'unassigned'
    )
    on conflict (id) do update
    set email = excluded.email;
    return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (id, email, display_name, role)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', ''), 'unassigned'
from auth.users
on conflict (id) do nothing;

-- Let existing super admins change other users' roles without removing the last super admin.
create or replace function public.manage_admin_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_super_admin() then
        raise exception 'Only a super admin can manage admin roles' using errcode = '42501';
    end if;
    if target_user_id = (select auth.uid()) then
        raise exception 'You cannot change your own role';
    end if;
    if new_role is null or new_role not in ('super_admin', 'owner', 'unassigned') then
        raise exception 'Role is not allowed';
    end if;

    if new_role <> 'super_admin'
        and exists (
            select 1 from public.profiles
            where id = target_user_id and role = 'super_admin'
        )
        and (select count(*) from public.profiles where role = 'super_admin') <= 1 then
        raise exception 'At least one super admin account must remain';
    end if;

    update public.profiles
    set role = new_role, updated_at = now()
    where id = target_user_id;
    if not found then
        raise exception 'Account profile was not found';
    end if;
end;
$$;
revoke all on function public.manage_admin_role(uuid, text) from public, anon;
grant execute on function public.manage_admin_role(uuid, text) to authenticated;

-- Store the business timezone and recurring schedule used to calculate availability.
create table public.booking_settings (
    id boolean primary key default true check (id),
    booking_interval_minutes integer not null default 30
        check (booking_interval_minutes in (15, 30, 45, 60, 90, 120)),
    business_timezone text not null default 'UTC',
    updated_at timestamptz not null default now()
);
insert into public.booking_settings (id) values (true) on conflict (id) do nothing;

create table public.weekly_schedule (
    day_of_week integer primary key check (day_of_week between 0 and 6),
    is_open boolean not null default false,
    opens_at time,
    closes_at time,
    check (
        (not is_open and opens_at is null and closes_at is null)
        or (
            is_open and opens_at is not null and closes_at is not null
            and closes_at > opens_at
        )
    )
);

create table public.schedule_breaks (
    id uuid primary key default gen_random_uuid(),
    day_of_week integer not null references public.weekly_schedule (day_of_week) on delete cascade,
    starts_at time not null,
    ends_at time not null check (ends_at > starts_at),
    label text not null default 'Break'
);

create table public.services (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
    price numeric(10, 2) check (price is null or price >= 0),
    is_active boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
insert into public.services (name) values
    ('Classic'), ('Wet'), ('Hybrid'), ('Volume'), ('Wispy'), ('Anime')
on conflict (name) do nothing;

create table public.date_rules (
    id uuid primary key default gen_random_uuid(),
    rule_date date not null,
    rule_type text not null check (rule_type in ('closed', 'block', 'hours')),
    starts_at time,
    ends_at time,
    opens_at time,
    closes_at time,
    label text not null default '',
    created_at timestamptz not null default now(),
    check (
        (rule_type = 'closed' and starts_at is null and ends_at is null and opens_at is null and closes_at is null)
        or (
            rule_type = 'block' and starts_at is not null and ends_at is not null
            and ends_at > starts_at and opens_at is null and closes_at is null
        )
        or (
            rule_type = 'hours' and opens_at is not null and closes_at is not null
            and closes_at > opens_at and starts_at is null and ends_at is null
        )
    )
);
create index date_rules_date_idx on public.date_rules (rule_date, created_at);

-- Store private customer bookings and prevent overlapping active appointment ranges.
create table public.appointments (
    id uuid primary key default gen_random_uuid(),
    customer_name text not null check (length(trim(customer_name)) between 1 and 160),
    customer_email text not null check (length(trim(customer_email)) between 3 and 320),
    customer_phone text not null check (length(trim(customer_phone)) between 3 and 50),
    service_id uuid not null references public.services (id),
    appointment_date date not null,
    starts_at_time time not null,
    duration_minutes integer not null check (duration_minutes between 1 and 1440),
    starts_at timestamp generated always as (appointment_date + starts_at_time) stored,
    ends_at timestamp generated always as (
        appointment_date + starts_at_time + make_interval(mins => duration_minutes)
    ) stored,
    status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
    source text not null default 'customer' check (source in ('customer', 'manual')),
    private_notes text not null default '',
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint active_appointments_do_not_overlap
        exclude using gist ((tsrange(starts_at, ends_at, '[)')) with &&)
        where (status in ('pending', 'confirmed'))
);
create index appointments_date_idx on public.appointments (appointment_date, starts_at_time);

create table public.portfolio_photos (
    id uuid primary key default gen_random_uuid(),
    storage_path text not null unique,
    alt_text text not null default '',
    display_order integer not null default 0,
    is_published boolean not null default false,
    created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('serenity-portfolio', 'serenity-portfolio', false)
on conflict (id) do nothing;

-- Require row-level policies for every business table before granting access.
alter table public.profiles enable row level security;
alter table public.booking_settings enable row level security;
alter table public.weekly_schedule enable row level security;
alter table public.schedule_breaks enable row level security;
alter table public.services enable row level security;
alter table public.date_rules enable row level security;
alter table public.appointments enable row level security;
alter table public.portfolio_photos enable row level security;

revoke all on public.profiles, public.booking_settings, public.weekly_schedule,
    public.schedule_breaks, public.services, public.date_rules,
    public.appointments, public.portfolio_photos from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.booking_settings, public.weekly_schedule,
    public.schedule_breaks, public.services, public.date_rules,
    public.portfolio_photos to anon, authenticated;
grant select, insert, update, delete on public.booking_settings,
    public.weekly_schedule, public.schedule_breaks, public.services,
    public.date_rules, public.portfolio_photos to authenticated;
grant select on public.appointments to authenticated;
grant insert, update, delete on public.appointments to authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

-- Public reads expose schedule/catalog data only; customer records stay admin-only.
create policy "Users read own profile; super admins read profiles"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_super_admin());
create policy "Users update their display name only"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Public reads booking interval" on public.booking_settings
for select to anon, authenticated using (true);
create policy "Admins manage booking interval" on public.booking_settings
for all to authenticated using (public.is_business_admin()) with check (public.is_business_admin());

create policy "Public reads weekly hours" on public.weekly_schedule
for select to anon, authenticated using (true);
create policy "Admins manage weekly hours" on public.weekly_schedule
for all to authenticated using (public.is_business_admin()) with check (public.is_business_admin());

create policy "Public reads breaks" on public.schedule_breaks
for select to anon, authenticated using (true);
create policy "Admins manage breaks" on public.schedule_breaks
for all to authenticated using (public.is_business_admin()) with check (public.is_business_admin());

create policy "Public reads active services" on public.services
for select to anon, authenticated using (is_active or public.is_business_admin());
create policy "Admins manage services" on public.services
for all to authenticated using (public.is_business_admin()) with check (public.is_business_admin());

create policy "Public reads date availability rules" on public.date_rules
for select to anon, authenticated using (true);
create policy "Admins manage date availability rules" on public.date_rules
for all to authenticated using (public.is_business_admin()) with check (public.is_business_admin());

create policy "Admins read appointments" on public.appointments
for select to authenticated using (public.is_business_admin());
create policy "Admins create appointments" on public.appointments
for insert to authenticated with check (public.is_business_admin());
create policy "Admins update appointments" on public.appointments
for update to authenticated using (public.is_business_admin()) with check (public.is_business_admin());
create policy "Admins delete appointments" on public.appointments
for delete to authenticated using (public.is_business_admin());

create policy "Public reads published portfolio photos" on public.portfolio_photos
for select to anon, authenticated using (is_published or public.is_business_admin());
create policy "Admins manage portfolio photos" on public.portfolio_photos
for all to authenticated using (public.is_business_admin()) with check (public.is_business_admin());

create policy "Public reads portfolio images" on storage.objects
for select to anon, authenticated using (
    bucket_id = 'serenity-portfolio'
    and exists (
        select 1 from public.portfolio_photos p
        where p.storage_path = name and p.is_published
    )
);
create policy "Admins upload portfolio images" on storage.objects
for insert to authenticated with check (bucket_id = 'serenity-portfolio' and public.is_business_admin());
create policy "Admins update portfolio images" on storage.objects
for update to authenticated
using (bucket_id = 'serenity-portfolio' and public.is_business_admin())
with check (bucket_id = 'serenity-portfolio' and public.is_business_admin());
create policy "Admins delete portfolio images" on storage.objects
for delete to authenticated using (bucket_id = 'serenity-portfolio' and public.is_business_admin());

-- Return open date/time slots without exposing appointment or customer records.
create or replace function public.get_public_availability(
    p_start_date date,
    p_end_date date,
    p_service_id uuid
)
returns table (available_date date, starts_at_time time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_service public.services%rowtype;
    v_interval integer;
    v_timezone text;
    v_date date;
    v_day integer;
    v_open time;
    v_close time;
    v_slot time;
    v_end time;
begin
    select booking_interval_minutes, business_timezone
    into v_interval, v_timezone
    from public.booking_settings where id = true;
    if v_interval is null then v_interval := 30; end if;
    if v_timezone is null then v_timezone := 'UTC'; end if;

    if p_start_date < (timezone(v_timezone, now()))::date
        or p_end_date < p_start_date or p_end_date > p_start_date + 90 then
        raise exception 'Availability range must be within the next 90 days';
    end if;

    select * into v_service
    from public.services
    where id = p_service_id and is_active and duration_minutes is not null;
    if not found then
        raise exception 'Service is not available';
    end if;

    for v_date in select generate_series(p_start_date, p_end_date, interval '1 day')::date loop
        v_day := extract(dow from v_date)::integer;
        if exists (
            select 1 from public.date_rules r
            where r.rule_date = v_date and r.rule_type = 'closed'
        ) then
            continue;
        end if;

        select r.opens_at, r.closes_at into v_open, v_close
        from public.date_rules r
        where r.rule_date = v_date and r.rule_type = 'hours'
        order by r.created_at desc
        limit 1;

        if v_open is null then
            select s.opens_at, s.closes_at into v_open, v_close
            from public.weekly_schedule s
            where s.day_of_week = v_day and s.is_open;
        end if;
        if v_open is null or v_close is null then continue; end if;
        if v_service.duration_minutes > extract(epoch from (v_close - v_open)) / 60 then
            continue;
        end if;

        v_slot := v_open;
        while v_slot + make_interval(mins => v_service.duration_minutes) <= v_close loop
            v_end := v_slot + make_interval(mins => v_service.duration_minutes);
            if (v_date + v_slot) > timezone(v_timezone, now())
                and not exists (
                    select 1 from public.schedule_breaks b
                    where b.day_of_week = v_day and b.starts_at < v_end and b.ends_at > v_slot
                )
                and not exists (
                    select 1 from public.date_rules r
                    where r.rule_date = v_date and r.rule_type = 'block'
                        and r.starts_at < v_end and r.ends_at > v_slot
                )
                and not exists (
                    select 1 from public.appointments a
                    where a.status in ('pending', 'confirmed')
                        and a.starts_at < (v_date + v_end)
                        and a.ends_at > (v_date + v_slot)
                )
            then
                available_date := v_date;
                starts_at_time := v_slot;
                return next;
            end if;
            v_slot := v_slot + make_interval(mins => v_interval);
        end loop;
    end loop;
end;
$$;
revoke all on function public.get_public_availability(date, date, uuid) from public;
grant execute on function public.get_public_availability(date, date, uuid) to anon, authenticated;

-- Validate customer input and current availability before creating a pending booking.
create or replace function public.create_public_appointment(
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_service_id uuid,
    p_appointment_date date,
    p_starts_at_time time
)
returns table (appointment_id uuid, booking_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_service public.services%rowtype;
    v_id uuid;
begin
    if length(trim(coalesce(p_customer_name, ''))) not between 1 and 160
        or length(trim(coalesce(p_customer_email, ''))) not between 3 and 320
        or length(trim(coalesce(p_customer_phone, ''))) not between 3 and 50 then
        raise exception 'Enter valid contact information';
    end if;

    select * into v_service
    from public.services
    where id = p_service_id and is_active and duration_minutes is not null;
    if not found then
        raise exception 'Service is not available';
    end if;

    if not exists (
        select 1 from public.get_public_availability(
            p_appointment_date, p_appointment_date, p_service_id
        ) slot
        where slot.starts_at_time = p_starts_at_time
    ) then
        raise exception 'Selected appointment time is no longer available';
    end if;

    insert into public.appointments (
        customer_name, customer_email, customer_phone, service_id,
        appointment_date, starts_at_time, duration_minutes, status, source
    )
    values (
        trim(p_customer_name), trim(p_customer_email), trim(p_customer_phone),
        p_service_id, p_appointment_date, p_starts_at_time,
        v_service.duration_minutes, 'pending', 'customer'
    )
    returning id into v_id;

    return query select v_id, 'pending'::text;
exception
    when exclusion_violation then
        raise exception 'Selected appointment time was just booked; choose another time'
            using errcode = '23P01';
end;
$$;
revoke all on function public.create_public_appointment(text, text, text, uuid, date, time) from public;
grant execute on function public.create_public_appointment(text, text, text, uuid, date, time) to anon, authenticated;

comment on table public.profiles is 'Admin roles are assigned only by the initial SQL bootstrap or the super-admin RPC.';
comment on table public.appointments is 'Customer contact details are private; anonymous clients use availability and booking RPCs only.';
comment on function public.get_public_availability(date, date, uuid) is 'Returns available dates/times only; it never returns appointment records or customer details.';
comment on function public.create_public_appointment(text, text, text, uuid, date, time) is 'Creates pending public bookings; exclusion constraint prevents concurrent overlapping appointments.';
