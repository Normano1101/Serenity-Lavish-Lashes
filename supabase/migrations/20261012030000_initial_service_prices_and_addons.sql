-- Seed the initial public service prices and create the shared service add-on catalog.
do $$
declare
    service_name record;
begin
    for service_name in
        select * from (values
            ('Classic Full Set', 'Classic Lashes Full Set'),
            ('Classic Fill', 'Classic Lashes Fill'),
            ('Wet Full Set', 'Wet Set Full Set'),
            ('Wet Fill', 'Wet Set Fill'),
            ('Hybrid Full Set', 'Hybrid Lashes Full Set'),
            ('Hybrid Fill', 'Hybrid Lashes Fill'),
            ('Volume Full Set', 'Volume Lashes Full Set'),
            ('Volume Fill', 'Volume Lashes Fill'),
            ('Anime Full Set', 'Anime Lashes Full Set'),
            ('Anime Fill', 'Anime Lashes Fill'),
            ('Wispy Full Set', 'Wispy Set Full Set'),
            ('Wispy Fill', 'Wispy Set Fill')
        ) as names(old_name, new_name)
    loop
        if exists (select 1 from public.services where name = service_name.new_name) then
            update public.services
            set is_active = false, updated_at = now()
            where name = service_name.old_name;
        else
            update public.services
            set name = service_name.new_name, updated_at = now()
            where name = service_name.old_name;
        end if;
    end loop;
end;
$$;

-- Ensure every starter lash style has full-set and fill records before setting prices.
insert into public.services (name, is_active)
values
    ('YY Set Full Set', true),
    ('YY Set Fill', true),
    ('Brown Lashes Full Set', true),
    ('Brown Lashes Fill', true)
on conflict (name) do nothing;

update public.services
set image_urls = array['/assets/Pictures/LashSet/YYset.jpg'],
    updated_at = now()
where name = 'YY Set Full Set'
    and cardinality(image_urls) = 0;

update public.services
set price = coalesce(price, case name
        when 'Wet Set Full Set' then 115
        when 'YY Set Full Set' then 100
        when 'Brown Lashes Full Set' then 135
        when 'Hybrid Lashes Full Set' then 120
        when 'Volume Lashes Full Set' then 130
        when 'Anime Lashes Full Set' then 115
        when 'Classic Lashes Full Set' then 105
        else null
    end),
    updated_at = now()
where name in (
    'Wet Set Full Set', 'YY Set Full Set', 'Brown Lashes Full Set',
    'Hybrid Lashes Full Set', 'Volume Lashes Full Set',
    'Anime Lashes Full Set', 'Classic Lashes Full Set'
);

update public.services
set price = coalesce(price, case name
        when 'Wet Set Fill' then 80
        when 'YY Set Fill' then 75
        when 'Brown Lashes Fill' then 95
        when 'Hybrid Lashes Fill' then 85
        when 'Volume Lashes Fill' then 90
        when 'Anime Lashes Fill' then 80
        when 'Classic Lashes Fill' then 75
        else null
    end),
    refill_3_week_price = coalesce(refill_3_week_price, case name
        when 'Wet Set Fill' then 90
        when 'YY Set Fill' then 80
        when 'Brown Lashes Fill' then 100
        when 'Hybrid Lashes Fill' then 90
        when 'Volume Lashes Fill' then 95
        when 'Anime Lashes Fill' then 90
        when 'Classic Lashes Fill' then 85
        else null
    end),
    updated_at = now()
where name in (
    'Wet Set Fill', 'YY Set Fill', 'Brown Lashes Fill',
    'Hybrid Lashes Fill', 'Volume Lashes Fill',
    'Anime Lashes Fill', 'Classic Lashes Fill'
);

-- Keep optional upgrades in a separate catalog with their own active status.
create table public.service_addons (
    id uuid primary key default gen_random_uuid(),
    name text not null unique check (length(trim(name)) between 1 and 100),
    description text not null default '' check (length(description) <= 1000),
    price numeric(10, 2) check (price is null or price >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.service_addons enable row level security;
revoke all on public.service_addons from anon, authenticated;
grant select on public.service_addons to anon, authenticated;
grant select, insert, update, delete on public.service_addons to authenticated;

-- Let customers read active add-ons while restricting catalog changes to admins.
create policy "Public reads active service add-ons" on public.service_addons
for select to anon, authenticated using (is_active or public.is_business_admin());

create policy "Admins insert service add-ons" on public.service_addons
for insert to authenticated
with check (public.is_business_admin());

create policy "Admins update service add-ons" on public.service_addons
for update to authenticated
using (public.is_business_admin())
with check (public.is_business_admin());

create policy "Admins delete service add-ons" on public.service_addons
for delete to authenticated
using (public.is_business_admin());

-- Add starter upgrades only when their names are not already present.
insert into public.service_addons (name, price)
values
    ('Spikes', 10),
    ('Color', 10),
    ('Decal', 5),
    ('Remover', 25),
    ('Mini Fill', 55)
on conflict (name) do nothing;

-- Publish add-on changes to subscribed pricing pages.
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
        and not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
                and schemaname = 'public'
                and tablename = 'service_addons'
        ) then
        alter publication supabase_realtime add table public.service_addons;
    end if;
end;
$$;
