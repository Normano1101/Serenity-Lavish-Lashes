-- Enable live date-rule updates when the Supabase Realtime publication is available.
do $$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'date_rules'
    ) then
        alter publication supabase_realtime add table public.date_rules;
    end if;
end;
$$;
