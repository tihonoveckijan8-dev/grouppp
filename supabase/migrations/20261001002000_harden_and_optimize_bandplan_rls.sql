-- BandPlan: harden RLS and add indexes for the shared group data model.
-- Applied to production on 2026-10-01; kept in git so the schema change is reproducible.

revoke all on table public.bandplan_state from anon, authenticated;

create policy "legacy state unavailable" on public.bandplan_state
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists "account own write" on public.bandplan_accounts;
drop policy if exists "members write bandplan_songs" on public.bandplan_songs;
drop policy if exists "members write bandplan_events" on public.bandplan_events;
drop policy if exists "members write bandplan_setlists" on public.bandplan_setlists;

create policy "account own insert" on public.bandplan_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "account own update" on public.bandplan_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "account own delete" on public.bandplan_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "account own read" on public.bandplan_accounts;
drop policy if exists "group accounts visible to members" on public.bandplan_accounts;
create policy "group accounts read" on public.bandplan_accounts for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.bandplan_group_members mine
      join public.bandplan_group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = bandplan_accounts.user_id
    )
  );

create policy "members insert bandplan_songs" on public.bandplan_songs for insert to authenticated
  with check (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_songs.group_id and m.user_id = (select auth.uid())));
create policy "members update bandplan_songs" on public.bandplan_songs for update to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_songs.group_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_songs.group_id and m.user_id = (select auth.uid())));
create policy "members delete bandplan_songs" on public.bandplan_songs for delete to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_songs.group_id and m.user_id = (select auth.uid())));

drop policy if exists "members read bandplan_songs" on public.bandplan_songs;
create policy "members read bandplan_songs" on public.bandplan_songs for select to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_songs.group_id and m.user_id = (select auth.uid())));

create policy "members insert bandplan_events" on public.bandplan_events for insert to authenticated
  with check (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_events.group_id and m.user_id = (select auth.uid())));
create policy "members update bandplan_events" on public.bandplan_events for update to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_events.group_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_events.group_id and m.user_id = (select auth.uid())));
create policy "members delete bandplan_events" on public.bandplan_events for delete to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_events.group_id and m.user_id = (select auth.uid())));

drop policy if exists "members read bandplan_events" on public.bandplan_events;
create policy "members read bandplan_events" on public.bandplan_events for select to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_events.group_id and m.user_id = (select auth.uid())));

create policy "members insert bandplan_setlists" on public.bandplan_setlists for insert to authenticated
  with check (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_setlists.group_id and m.user_id = (select auth.uid())));
create policy "members update bandplan_setlists" on public.bandplan_setlists for update to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_setlists.group_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_setlists.group_id and m.user_id = (select auth.uid())));
create policy "members delete bandplan_setlists" on public.bandplan_setlists for delete to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_setlists.group_id and m.user_id = (select auth.uid())));

drop policy if exists "members read bandplan_setlists" on public.bandplan_setlists;
create policy "members read bandplan_setlists" on public.bandplan_setlists for select to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_setlists.group_id and m.user_id = (select auth.uid())));

drop policy if exists "group member read invites" on public.bandplan_group_invites;
create policy "group member read invites" on public.bandplan_group_invites for select to authenticated
  using (exists (select 1 from public.bandplan_group_members m where m.group_id = bandplan_group_invites.group_id and m.user_id = (select auth.uid())));

create index if not exists bandplan_events_updated_by_idx on public.bandplan_events(updated_by);
create index if not exists bandplan_setlists_updated_by_idx on public.bandplan_setlists(updated_by);
create index if not exists bandplan_songs_updated_by_idx on public.bandplan_songs(updated_by);
create index if not exists bandplan_group_invites_created_by_idx on public.bandplan_group_invites(created_by);
create index if not exists bandplan_group_invites_group_id_idx on public.bandplan_group_invites(group_id);
