insert into public.services (name, duration_minutes, is_active) values
    ('Classic Full Set', 210, true), ('Classic Fill', 150, true),
    ('Wet Full Set', 210, true), ('Wet Fill', 150, true),
    ('Hybrid Full Set', 210, true), ('Hybrid Fill', 150, true),
    ('Volume Full Set', 210, true), ('Volume Fill', 150, true),
    ('Wispy Full Set', 210, true), ('Wispy Fill', 150, true),
    ('Anime Full Set', 210, true), ('Anime Fill', 150, true)
on conflict (name) do update
set duration_minutes = excluded.duration_minutes,
    is_active = excluded.is_active;
