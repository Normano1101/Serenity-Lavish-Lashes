alter table public.services
    add column if not exists description text not null default '',
    add column if not exists image_urls text[] not null default '{}',
    add column if not exists refill_3_week_price numeric(10, 2)
        check (refill_3_week_price is null or refill_3_week_price >= 0);

update public.services
set image_urls = case name
        when 'Classic Full Set' then case when cardinality(image_urls) = 0 then array[
            '/assets/Pictures/LashSet/Classic1.jpg',
            '/assets/Pictures/LashSet/Classic2.jpg'
        ] else image_urls end
        when 'Wet Full Set' then case when cardinality(image_urls) = 0 then array['/assets/Pictures/LashSet/WetSet.JPG'] else image_urls end
        when 'Hybrid Full Set' then case when cardinality(image_urls) = 0 then array[
            '/assets/Pictures/LashSet/Hybrid1.jpg',
            '/assets/Pictures/LashSet/Hybrid2.jpg'
        ] else image_urls end
        when 'Volume Full Set' then case when cardinality(image_urls) = 0 then array['/assets/Pictures/LashSet/VolumeSet.JPG'] else image_urls end
        when 'Anime Full Set' then case when cardinality(image_urls) = 0 then array['/assets/Pictures/LashSet/AnimeSet.JPG'] else image_urls end
        when 'Wispy Full Set' then case when cardinality(image_urls) = 0 then array[
            '/assets/Pictures/LashSet/Wispy1.jpg',
            '/assets/Pictures/LashSet/Wispy2.jpg',
            '/assets/Pictures/LashSet/Wispy3.jpg'
        ] else image_urls end
        when 'YY Full Set' then case when cardinality(image_urls) = 0 then array['/assets/Pictures/LashSet/YYset.jpg'] else image_urls end
        else image_urls
    end,
    updated_at = now()
where name in (
    'Classic Full Set', 'Wet Full Set', 'Hybrid Full Set',
    'Volume Full Set', 'Anime Full Set', 'Wispy Full Set'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'serenity-service-images',
    'serenity-service-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public reads service images" on storage.objects
for select to anon, authenticated
using (bucket_id = 'serenity-service-images');

create policy "Admins upload service images" on storage.objects
for insert to authenticated
with check (bucket_id = 'serenity-service-images' and public.is_business_admin());

create policy "Admins update service images" on storage.objects
for update to authenticated
using (bucket_id = 'serenity-service-images' and public.is_business_admin())
with check (bucket_id = 'serenity-service-images' and public.is_business_admin());

create policy "Admins delete service images" on storage.objects
for delete to authenticated
using (bucket_id = 'serenity-service-images' and public.is_business_admin());

create or replace function public.save_lash_service(
    p_full_service_id uuid,
    p_name text,
    p_description text,
    p_image_urls text[],
    p_full_set_price numeric,
    p_refill_two_week_price numeric,
    p_refill_three_week_price numeric,
    p_full_set_duration integer,
    p_refill_duration integer,
    p_is_active boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
    v_name text := trim(coalesce(p_name, ''));
    v_full_name text;
    v_fill_name text;
    v_old_full_name text;
    v_old_fill_name text;
    v_full_id uuid;
begin
    if not public.is_business_admin() then
        raise exception 'Only owners and super admins can manage services'
            using errcode = '42501';
    end if;
    if length(v_name) not between 1 and 100
        or v_name ~ ' (Full Set|Fill)$'
        or p_description is null
        or length(p_description) > 2000 then
        raise exception 'Enter a service name and a description under 2000 characters';
    end if;
    if (p_full_set_price is not null and p_full_set_price < 0)
        or (p_refill_two_week_price is not null and p_refill_two_week_price < 0)
        or (p_refill_three_week_price is not null and p_refill_three_week_price < 0) then
        raise exception 'Service prices must be non-negative';
    end if;
    if (p_full_set_duration is not null and p_full_set_duration not between 1 and 1440)
        or (p_refill_duration is not null and p_refill_duration not between 1 and 1440)
        or p_is_active is null then
        raise exception 'Service durations or active status are invalid';
    end if;

    v_full_name := v_name || ' Full Set';
    v_fill_name := v_name || ' Fill';

    if p_full_service_id is null then
        insert into public.services (
            name, duration_minutes, price, description, image_urls, is_active
        )
        values (
            v_full_name, p_full_set_duration, p_full_set_price,
            p_description, coalesce(p_image_urls, '{}'), p_is_active
        )
        returning id into v_full_id;

        insert into public.services (
            name, duration_minutes, price, refill_3_week_price, is_active
        )
        values (
            v_fill_name, p_refill_duration, p_refill_two_week_price,
            p_refill_three_week_price, p_is_active
        );
    else
        select name into v_old_full_name
        from public.services
        where id = p_full_service_id and name like '% Full Set'
        for update;
        if not found then
            raise exception 'The lash service was not found';
        end if;
        v_old_fill_name := left(v_old_full_name, length(v_old_full_name) - length(' Full Set')) || ' Fill';

        update public.services
        set name = v_full_name,
            duration_minutes = p_full_set_duration,
            price = p_full_set_price,
            description = p_description,
            image_urls = coalesce(p_image_urls, '{}'),
            is_active = p_is_active,
            updated_at = now()
        where id = p_full_service_id
        returning id into v_full_id;

        update public.services
        set name = v_fill_name,
            duration_minutes = p_refill_duration,
            price = p_refill_two_week_price,
            refill_3_week_price = p_refill_three_week_price,
            is_active = p_is_active,
            updated_at = now()
        where name = v_old_fill_name;

        if not found then
            insert into public.services (
                name, duration_minutes, price, refill_3_week_price, is_active
            )
            values (
                v_fill_name, p_refill_duration, p_refill_two_week_price,
                p_refill_three_week_price, p_is_active
            );
        end if;
    end if;

    return v_full_id;
end;
$$;

revoke all on function public.save_lash_service(
    uuid, text, text, text[], numeric, numeric, numeric, integer, integer, boolean
) from public, anon;
grant execute on function public.save_lash_service(
    uuid, text, text, text[], numeric, numeric, numeric, integer, integer, boolean
) to authenticated;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
        and not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
                and schemaname = 'public'
                and tablename = 'services'
        ) then
        alter publication supabase_realtime add table public.services;
    end if;
end;
$$;
