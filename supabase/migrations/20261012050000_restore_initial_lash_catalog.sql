-- Normalize legacy names and restore missing starter styles, images, and prices.
do $$
declare
    lash_set record;
    full_set_name text;
    fill_name text;
    old_fill_name text;
    v_image_urls text[];
begin
    for lash_set in
        select * from (values
            ('Classic Full Set', 'Classic Lashes', array[
                '/assets/Pictures/LashSet/Classic1.jpg',
                '/assets/Pictures/LashSet/Classic2.jpg'
            ]::text[]),
            ('Wet Full Set', 'Wet Set', array[
                '/assets/Pictures/LashSet/WetSet.JPG'
            ]::text[]),
            ('Hybrid Full Set', 'Hybrid Lashes', array[
                '/assets/Pictures/LashSet/Hybrid1.jpg',
                '/assets/Pictures/LashSet/Hybrid2.jpg'
            ]::text[]),
            ('Volume Full Set', 'Volume Lashes', array[
                '/assets/Pictures/LashSet/VolumeSet.JPG'
            ]::text[]),
            ('Anime Full Set', 'Anime Lashes', array[
                '/assets/Pictures/LashSet/AnimeSet.JPG'
            ]::text[]),
            ('Wispy Full Set', 'Wispy Set', array[
                '/assets/Pictures/LashSet/Wispy1.jpg',
                '/assets/Pictures/LashSet/Wispy2.jpg',
                '/assets/Pictures/LashSet/Wispy3.jpg'
            ]::text[]),
            ('YY Full Set', 'YY Set', array[
                '/assets/Pictures/LashSet/YYset.jpg'
            ]::text[]),
            ('Brown Lashes Full Set', 'Brown Lashes', '{}'::text[])
        ) as catalog(old_name, display_name, images)
    loop
        full_set_name := lash_set.display_name || ' Full Set';
        fill_name := lash_set.display_name || ' Fill';
        old_fill_name := regexp_replace(lash_set.old_name, 'Full Set$', 'Fill');
        v_image_urls := lash_set.images;

        if not exists (select 1 from public.services where name = full_set_name) then
            update public.services
            set name = full_set_name,
                is_active = true,
                image_urls = case
                    when cardinality(v_image_urls) > 0 and cardinality(services.image_urls) = 0 then v_image_urls
                    else services.image_urls
                end,
                updated_at = now()
            where name = lash_set.old_name;
        else
            update public.services
            set is_active = false, updated_at = now()
            where name = lash_set.old_name
                and name <> full_set_name;
        end if;

        insert into public.services as existing_service (name, is_active, image_urls)
        values (full_set_name, true, v_image_urls)
        on conflict (name) do update
        set is_active = true,
            image_urls = case
                when cardinality(excluded.image_urls) > 0
                    and cardinality(existing_service.image_urls) = 0
                    then excluded.image_urls
                else existing_service.image_urls
            end,
            updated_at = now();

        if not exists (select 1 from public.services where name = fill_name) then
            update public.services
            set name = fill_name,
                is_active = true,
                updated_at = now()
            where name = old_fill_name;
        else
            update public.services
            set is_active = false, updated_at = now()
            where name = old_fill_name
                and name <> fill_name;
        end if;

        insert into public.services (name, is_active)
        values (fill_name, true)
        on conflict (name) do update
        set is_active = true,
            updated_at = now();
    end loop;
end;
$$;
