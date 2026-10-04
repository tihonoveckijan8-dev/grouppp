-- Restrict legacy profile directory reads to the signed-in owner.
-- The production frontend does not use this legacy table; the register Edge Function
-- accesses it with the server key when username lookup is required.
drop policy if exists "profiles_authenticated_read" on public.bandplan_profiles;
create policy "profiles_own_read"
  on public.bandplan_profiles
  for select
  to authenticated
  using (id = (select auth.uid()));
