-- Shared BandPlan workspaces: common songs, calendar events, members and setlists.
create table if not exists public.bandplan_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bandplan_groups_name_length check (char_length(trim(name)) between 3 and 50)
);
create unique index if not exists bandplan_groups_normalized_name_idx
  on public.bandplan_groups(normalized_name);

create table if not exists public.bandplan_group_members (
  group_id uuid not null references public.bandplan_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);
create index if not exists bandplan_group_members_user_idx
  on public.bandplan_group_members(user_id);

create table if not exists public.bandplan_group_state (
  group_id uuid primary key references public.bandplan_groups(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bandplan_groups enable row level security;
alter table public.bandplan_group_members enable row level security;
alter table public.bandplan_group_state enable row level security;

create or replace function public.bandplan_is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$
  select exists(
    select 1 from public.bandplan_group_members m
    where m.group_id=p_group_id and m.user_id=auth.uid()
  );
$$;
revoke all on function public.bandplan_is_group_member(uuid) from public;
grant execute on function public.bandplan_is_group_member(uuid) to authenticated;

drop policy if exists "group members can view their groups" on public.bandplan_groups;
create policy "group members can view their groups" on public.bandplan_groups
for select to authenticated using (public.bandplan_is_group_member(id));

drop policy if exists "members can view group membership" on public.bandplan_group_members;
create policy "members can view group membership" on public.bandplan_group_members
for select to authenticated using (public.bandplan_is_group_member(group_id));

drop policy if exists "members can read shared group state" on public.bandplan_group_state;
create policy "members can read shared group state" on public.bandplan_group_state
for select to authenticated using (public.bandplan_is_group_member(group_id));

drop policy if exists "members can insert shared group state" on public.bandplan_group_state;
create policy "members can insert shared group state" on public.bandplan_group_state
for insert to authenticated with check (public.bandplan_is_group_member(group_id));

drop policy if exists "members can update shared group state" on public.bandplan_group_state;
create policy "members can update shared group state" on public.bandplan_group_state
for update to authenticated using (public.bandplan_is_group_member(group_id))
with check (public.bandplan_is_group_member(group_id));

grant select on public.bandplan_groups, public.bandplan_group_members, public.bandplan_group_state to authenticated;
grant insert,update on public.bandplan_group_state to authenticated;
revoke delete on public.bandplan_group_state from authenticated;

create or replace function public.bandplan_join_group_by_name(p_name text)
returns table(group_id uuid, group_name text, member_count bigint)
language plpgsql security definer set search_path=public,auth
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name,''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 50 then
    raise exception 'GROUP_NAME_INVALID';
  end if;
  insert into public.bandplan_groups(name,owner_id)
  values(v_name,v_uid)
  on conflict(normalized_name) do update set name=public.bandplan_groups.name
  returning id into v_id;

  insert into public.bandplan_group_members(group_id,user_id)
  values(v_id,v_uid) on conflict do nothing;

  insert into public.bandplan_group_state(group_id,state)
  values(v_id,'{"members":[],"events":[],"songs":[],"setlists":[]}'::jsonb)
  on conflict(group_id) do nothing;

  return query select g.id,g.name,
    (select count(*) from public.bandplan_group_members m where m.group_id=g.id)
    from public.bandplan_groups g where g.id=v_id;
end;
$$;
revoke all on function public.bandplan_join_group_by_name(text) from public;
grant execute on function public.bandplan_join_group_by_name(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='bandplan_group_state'
  ) then
    alter publication supabase_realtime add table public.bandplan_group_state;
  end if;
end $$;
