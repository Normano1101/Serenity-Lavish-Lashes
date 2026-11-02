-- Allow public RLS checks to call the helper that identifies business admins.
grant execute on function public.is_business_admin() to anon;
