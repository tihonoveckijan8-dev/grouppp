-- WHY: BandPlan previously stored memberships as (group_id, user_id), but
-- several RPCs still deleted or selected a user's first membership. Keep every
-- membership and make the active workspace an explicit, user-owned choice.

create or replace function public.bandplan_get_my_groups()
returns table(group_id uuid, group_name text, owner_id uuid, joined_at timestamptz, role text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select g.id, g.name, g.owner_id, gm.joined_at,
         case when g.owner_id = auth.uid() then 'owner' else 'member' end
  from public.bandplan_group_members gm
  join public.bandplan_groups g on g.id = gm.group_id
  where gm.user_id = auth.uid()
  order by gm.joined_at asc nulls last, g.created_at asc;
$$;

create or replace function public.bandplan_set_active_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_group_id is null or not exists (
    select 1 from public.bandplan_group_members
    where user_id = v_uid and group_id = p_group_id
  ) then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;

  insert into public.bandplan_user_state(user_id, state)
  values (v_uid, jsonb_build_object('activeGroupId', p_group_id::text))
  on conflict (user_id) do update
    set state = coalesce(public.bandplan_user_state.state, '{}'::jsonb)
                || jsonb_build_object('activeGroupId', p_group_id::text),
        updated_at = now();
  return p_group_id;
end;
$$;

create or replace function public.bandplan_get_my_group()
returns table(group_id uuid, group_name text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select g.id, g.name
  from public.bandplan_groups g
  join public.bandplan_group_members gm on gm.group_id = g.id
  where gm.user_id = auth.uid()
  order by
    case when g.id = (
      select nullif(us.state->>'activeGroupId', '')::uuid
      from public.bandplan_user_state us
      where us.user_id = auth.uid()
    ) then 0 else 1 end,
    gm.joined_at asc nulls last
  limit 1;
$$;

create or replace function public.bandplan_create_group(
  p_name text, p_display_name text, p_roles text[] default '{}'::text[]
)
returns table(group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid := auth.uid(); v_gid uuid; v_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(coalesce(p_name,''))) not between 3 and 50 then
    raise exception 'GROUP_NAME_INVALID';
  end if;

  insert into public.bandplan_groups(name, owner_id)
  values (trim(p_name), v_uid) returning id into v_gid;
  insert into public.bandplan_group_members(group_id, user_id)
  values (v_gid, v_uid);

  insert into public.bandplan_accounts(user_id, display_name, roles)
  values (v_uid, trim(coalesce(p_display_name,'')), coalesce(p_roles,'{}'))
  on conflict (user_id) do update set
    display_name = case when nullif(trim(coalesce(p_display_name,'')), '') is null
      then public.bandplan_accounts.display_name else trim(p_display_name) end,
    roles = case when coalesce(array_length(p_roles,1),0) = 0
      then public.bandplan_accounts.roles else p_roles end,
    updated_at = now();

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
    exit when not exists (select 1 from public.bandplan_group_invites where invite_code=v_code);
  end loop;
  insert into public.bandplan_group_invites(group_id, invite_code, created_by)
  values (v_gid, v_code, v_uid);

  insert into public.bandplan_group_state(group_id, state)
  values (v_gid, '{"members":[],"events":[],"songs":[],"setlists":[]}'::jsonb);

  perform public.bandplan_set_active_group(v_gid);
  return query select v_gid, v_code;
end;
$$;

create or replace function public.bandplan_join_group(
  p_code text, p_display_name text, p_roles text[] default '{}'::text[]
)
returns table(group_id uuid, group_name text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.bandplan_group_invites%rowtype;
  v_added integer := 0;
  v_new_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select i.* into v_inv
  from public.bandplan_group_invites i
  where i.invite_code = upper(trim(coalesce(p_code,'')))
  for update;

  if not found
     or (v_inv.expires_at is not null and v_inv.expires_at < now())
     or (v_inv.max_uses is not null and v_inv.uses >= v_inv.max_uses)
  then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;

  -- WHY: joining another band must add a membership, never replace existing ones.
  insert into public.bandplan_group_members(group_id, user_id)
  values (v_inv.group_id, v_uid) on conflict do nothing;
  get diagnostics v_added = row_count;

  if v_added > 0 then
    update public.bandplan_group_invites set uses = uses + 1 where id = v_inv.id;
  end if;

  insert into public.bandplan_accounts(user_id, display_name, roles)
  values (v_uid, trim(coalesce(p_display_name,'')), coalesce(p_roles,'{}'))
  on conflict (user_id) do update set
    display_name = case when nullif(trim(coalesce(p_display_name,'')), '') is null
      then public.bandplan_accounts.display_name else trim(p_display_name) end,
    roles = case when coalesce(array_length(p_roles,1),0) = 0
      then public.bandplan_accounts.roles else p_roles end,
    updated_at = now();

  perform public.bandplan_set_active_group(v_inv.group_id);

  select i.invite_code into v_new_code
  from public.bandplan_group_invites i
  where i.group_id = v_inv.group_id and i.created_by = v_uid
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.uses < i.max_uses)
  order by i.created_at desc limit 1;

  if v_new_code is null then
    loop
      v_new_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
      exit when not exists (select 1 from public.bandplan_group_invites where invite_code=v_new_code);
    end loop;
    insert into public.bandplan_group_invites(group_id, invite_code, created_by, max_uses)
    values (v_inv.group_id, v_new_code, v_uid, null);
  end if;

  return query select g.id, g.name from public.bandplan_groups g where g.id = v_inv.group_id;
end;
$$;

create or replace function public.bandplan_get_invite_code()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid := auth.uid(); v_gid uuid; v_code text; v_name text; v_roles text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select gm.group_id into v_gid
  from public.bandplan_group_members gm
  where gm.user_id = v_uid
  order by case when gm.group_id = (
    select nullif(state->>'activeGroupId','')::uuid
    from public.bandplan_user_state where user_id=v_uid
  ) then 0 else 1 end, gm.joined_at
  limit 1;

  if v_gid is null then
    select coalesce(nullif(trim(display_name),''),'Моя группа'), coalesce(roles,'{}')
      into v_name, v_roles
    from public.bandplan_accounts where user_id=v_uid;
    select c.group_id into v_gid
    from public.bandplan_create_group(v_name, '', coalesce(v_roles,'{}')) c;
  end if;

  select invite_code into v_code
  from public.bandplan_group_invites
  where group_id=v_gid and created_by=v_uid
    and (expires_at is null or expires_at>now())
    and (max_uses is null or uses<max_uses)
  order by created_at desc limit 1;

  if v_code is null then
    loop
      v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
      exit when not exists (select 1 from public.bandplan_group_invites where invite_code=v_code);
    end loop;
    insert into public.bandplan_group_invites(group_id, invite_code, created_by, max_uses)
    values (v_gid, v_code, v_uid, null);
  end if;
  return v_code;
end;
$$;

drop function if exists public.bandplan_create_group_and_invite(text,text,text[]);
create function public.bandplan_create_group_and_invite(
  p_name text, p_display_name text, p_roles text[] default '{}'::text[],
  p_group_id uuid default null
)
returns table(group_id uuid, group_name text, invite_code text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid := auth.uid(); v_gid uuid; v_gname text; v_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  v_gid := p_group_id;
  if v_gid is null then
    select gm.group_id into v_gid
    from public.bandplan_group_members gm
    where gm.user_id=v_uid
    order by case when gm.group_id = (
      select nullif(state->>'activeGroupId','')::uuid
      from public.bandplan_user_state where user_id=v_uid
    ) then 0 else 1 end, gm.joined_at
    limit 1;
  end if;

  if v_gid is not null then
    if not exists (select 1 from public.bandplan_group_members where user_id=v_uid and group_id=v_gid) then
      raise exception 'GROUP_MEMBERSHIP_REQUIRED';
    end if;
    select g.name into v_gname from public.bandplan_groups g where g.id=v_gid;
  else
    v_gname := trim(coalesce(p_name,''));
    if length(v_gname) not between 3 and 50 then v_gname := 'Моя группа'; end if;
    select c.group_id into v_gid
    from public.bandplan_create_group(v_gname,p_display_name,p_roles) c;
    select g.name into v_gname from public.bandplan_groups g where g.id=v_gid;
  end if;

  select i.invite_code into v_code
  from public.bandplan_group_invites i
  where i.group_id=v_gid and i.created_by=v_uid
    and (i.expires_at is null or i.expires_at>now())
    and (i.max_uses is null or i.uses<i.max_uses)
  order by i.created_at desc limit 1;

  if v_code is null then
    loop
      v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
      exit when not exists (select 1 from public.bandplan_group_invites where invite_code=v_code);
    end loop;
    insert into public.bandplan_group_invites(group_id,invite_code,created_by,max_uses)
    values (v_gid,v_code,v_uid,null);
  end if;

  perform public.bandplan_set_active_group(v_gid);
  return query select v_gid,v_gname,v_code;
end;
$$;

drop function if exists public.bandplan_leave_group();
create function public.bandplan_leave_group(p_group_id uuid default null)
returns table(group_id uuid, group_name text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid := p_group_id;
  v_group_name text;
  v_personal jsonb;
  v_next_owner uuid;
  v_next_group uuid;
  v_next_name text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  if v_group_id is null then
    select gm.group_id into v_group_id
    from public.bandplan_group_members gm
    where gm.user_id=v_uid
    order by case when gm.group_id = (
      select nullif(state->>'activeGroupId','')::uuid
      from public.bandplan_user_state where user_id=v_uid
    ) then 0 else 1 end, gm.joined_at
    limit 1;
  end if;
  if v_group_id is null then return; end if;
  if not exists (select 1 from public.bandplan_group_members where user_id=v_uid and group_id=v_group_id) then
    raise exception 'GROUP_MEMBERSHIP_REQUIRED';
  end if;

  select name into v_group_name from public.bandplan_groups where id=v_group_id;

  if exists (select 1 from public.bandplan_groups where id=v_group_id and owner_id=v_uid) then
    select gm.user_id into v_next_owner
    from public.bandplan_group_members gm
    where gm.group_id=v_group_id and gm.user_id<>v_uid
    order by gm.joined_at asc nulls last, gm.user_id limit 1;
    if v_next_owner is null then raise exception 'GROUP_OWNER_CANNOT_LEAVE_ALONE'; end if;
    update public.bandplan_groups set owner_id=v_next_owner
    where id=v_group_id and owner_id=v_uid;
  end if;

  update public.bandplan_group_state gs
  set state=jsonb_set(coalesce(gs.state,'{}'::jsonb),'{members}',
    coalesce((select jsonb_agg(member)
      from jsonb_array_elements(coalesce(gs.state->'members','[]'::jsonb)) member
      where coalesce(member->>'accountId',member->>'id','')<>v_uid::text),'[]'::jsonb),true),
    updated_at=now()
  where gs.group_id=v_group_id;

  delete from public.bandplan_group_invites
  where created_by=v_uid and group_id=v_group_id;
  delete from public.bandplan_group_members
  where user_id=v_uid and group_id=v_group_id;

  select gm.group_id,g.name into v_next_group,v_next_name
  from public.bandplan_group_members gm
  join public.bandplan_groups g on g.id=gm.group_id
  where gm.user_id=v_uid
  order by gm.joined_at asc nulls last limit 1;

  select state into v_personal from public.bandplan_user_state where user_id=v_uid;
  v_personal := coalesce(v_personal,'{}'::jsonb);
  if v_next_group is not null then
    v_personal := jsonb_set(v_personal,'{activeGroupId}',to_jsonb(v_next_group::text),true);
    v_personal := jsonb_set(v_personal,'{profile}',
      (coalesce(v_personal->'profile','{}'::jsonb)-'groupDetached')
        || jsonb_build_object('groupId',v_next_group::text,'bandName',v_next_name),true);
  else
    v_personal := v_personal - 'activeGroupId';
    v_personal := jsonb_set(v_personal,'{profile}',
      (coalesce(v_personal->'profile','{}'::jsonb)-'groupId')
        || jsonb_build_object('groupDetached',true,'eventParticipation','{}'::jsonb),true);
    v_personal := jsonb_set(v_personal,'{songs}','[]'::jsonb,true);
    v_personal := jsonb_set(v_personal,'{events}','[]'::jsonb,true);
    v_personal := jsonb_set(v_personal,'{setlists}','[]'::jsonb,true);
    v_personal := jsonb_set(v_personal,'{members}','[]'::jsonb,true);
  end if;
  insert into public.bandplan_user_state(user_id,state)
  values(v_uid,v_personal)
  on conflict(user_id) do update set state=excluded.state,updated_at=now();

  return query select v_group_id,v_group_name;
end;
$$;

drop function if exists public.bandplan_rename_group(text);
create function public.bandplan_rename_group(p_name text, p_group_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid:=auth.uid(); v_gid uuid:=p_group_id; v_name text:=trim(coalesce(p_name,''));
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_name) not between 3 and 50 then raise exception 'GROUP_NAME_INVALID'; end if;
  if v_gid is null then
    select gm.group_id into v_gid
    from public.bandplan_group_members gm
    where gm.user_id=v_uid
    order by case when gm.group_id = (
      select nullif(state->>'activeGroupId','')::uuid
      from public.bandplan_user_state where user_id=v_uid
    ) then 0 else 1 end, gm.joined_at limit 1;
  end if;
  if v_gid is null or not exists (
    select 1 from public.bandplan_group_members where user_id=v_uid and group_id=v_gid
  ) then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;
  update public.bandplan_groups set name=v_name
  where id=v_gid and name is distinct from v_name;
end;
$$;

-- Replace the implicit "first membership" sync with an explicit workspace id.
drop function if exists public.bandplan_sync_group(jsonb,jsonb,jsonb,jsonb,text,text[],jsonb,text[],text[],text[]);
create function public.bandplan_sync_group(
  p_songs jsonb, p_events jsonb, p_setlists jsonb, p_roster jsonb,
  p_display_name text, p_roles text[], p_personal_settings jsonb,
  p_delete_songs text[] default '{}', p_delete_events text[] default '{}',
  p_delete_setlists text[] default '{}', p_group_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_gid uuid := p_group_id;
  v_row jsonb;
  v_existing jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_gid is null then
    select gm.group_id into v_gid
    from public.bandplan_group_members gm
    where gm.user_id=v_uid
    order by case when gm.group_id = (
      select nullif(state->>'activeGroupId','')::uuid
      from public.bandplan_user_state where user_id=v_uid
    ) then 0 else 1 end, gm.joined_at limit 1;
  end if;
  if v_gid is null or not exists (
    select 1 from public.bandplan_group_members where user_id=v_uid and group_id=v_gid
  ) then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;

  insert into public.bandplan_accounts(user_id,display_name,roles,personal_settings)
  values(v_uid,trim(coalesce(p_display_name,'')),coalesce(p_roles,'{}'),coalesce(p_personal_settings,'{}'))
  on conflict(user_id) do update set
    display_name=case when nullif(trim(coalesce(p_display_name,'')),'') is null
      then public.bandplan_accounts.display_name else trim(p_display_name) end,
    roles=case when coalesce(array_length(p_roles,1),0)=0
      then public.bandplan_accounts.roles else p_roles end,
    personal_settings=coalesce(p_personal_settings,public.bandplan_accounts.personal_settings),
    updated_at=now();

  delete from public.bandplan_songs
  where group_id=v_gid and id=any(coalesce(p_delete_songs,'{}'));
  for v_row in select value from jsonb_array_elements(coalesce(p_songs,'[]'::jsonb)) loop
    if coalesce(v_row->>'id','')<>'' then
      insert into public.bandplan_songs(group_id,id,data,updated_by)
      values(v_gid,v_row->>'id',v_row,v_uid)
      on conflict(group_id,id) do update
        set data=excluded.data,updated_by=v_uid,updated_at=now();
    end if;
  end loop;

  delete from public.bandplan_events
  where group_id=v_gid and id=any(coalesce(p_delete_events,'{}'));
  for v_row in select value from jsonb_array_elements(coalesce(p_events,'[]'::jsonb)) loop
    if coalesce(v_row->>'id','')<>'' then
      select data into v_existing from public.bandplan_events
      where group_id=v_gid and id=v_row->>'id' for update;
      if v_existing is not null and v_row ? 'participation' then
        v_row := jsonb_set(v_row,'{participation}',
          coalesce(v_existing->'participation','{}'::jsonb)
          || coalesce(v_row->'participation','{}'::jsonb),true);
      end if;
      insert into public.bandplan_events(group_id,id,data,updated_by)
      values(v_gid,v_row->>'id',v_row,v_uid)
      on conflict(group_id,id) do update
        set data=excluded.data,updated_by=v_uid,updated_at=now();
    end if;
  end loop;

  delete from public.bandplan_setlists
  where group_id=v_gid and id=any(coalesce(p_delete_setlists,'{}'));
  for v_row in select value from jsonb_array_elements(coalesce(p_setlists,'[]'::jsonb)) loop
    if coalesce(v_row->>'id','')<>'' then
      insert into public.bandplan_setlists(group_id,id,data,updated_by)
      values(v_gid,v_row->>'id',v_row,v_uid)
      on conflict(group_id,id) do update
        set data=excluded.data,updated_by=v_uid,updated_at=now();
    end if;
  end loop;
end;
$$;

drop function if exists public.bandplan_set_event_participation(text,text);
drop function if exists public.bandplan_set_event_participation(text,text,timestamptz);
create function public.bandplan_set_event_participation(
  p_event_id text, p_status text, p_updated_at timestamptz default null,
  p_group_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_gid uuid := p_group_id;
  v_status text := nullif(trim(coalesce(p_status,'')),'');
  v_updated_at timestamptz := coalesce(p_updated_at,now());
  v_current_status text;
  v_current_updated_at timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_status is not null and v_status not in ('yes','maybe','no') then
    raise exception 'INVALID_PARTICIPATION_STATUS';
  end if;
  v_updated_at := greatest(now()-interval '30 days',least(v_updated_at,now()+interval '5 minutes'));

  if v_gid is null then
    select gm.group_id into v_gid
    from public.bandplan_group_members gm
    where gm.user_id=v_uid
    order by case when gm.group_id = (
      select nullif(state->>'activeGroupId','')::uuid
      from public.bandplan_user_state where user_id=v_uid
    ) then 0 else 1 end, gm.joined_at limit 1;
  end if;
  if v_gid is null or not exists (
    select 1 from public.bandplan_group_members where user_id=v_uid and group_id=v_gid
  ) then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;

  if not exists (select 1 from public.bandplan_events
    where group_id=v_gid and id=trim(p_event_id)) then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  select status,updated_at into v_current_status,v_current_updated_at
  from public.bandplan_event_participation
  where group_id=v_gid and event_id=trim(p_event_id) and user_id=v_uid;

  if v_status is null then
    if v_current_updated_at is null or v_updated_at>=v_current_updated_at then
      delete from public.bandplan_event_participation
      where group_id=v_gid and event_id=trim(p_event_id) and user_id=v_uid;
      v_current_status := null;
      v_current_updated_at := v_updated_at;
    end if;
  else
    insert into public.bandplan_event_participation(group_id,event_id,user_id,status,updated_at)
    values(v_gid,trim(p_event_id),v_uid,v_status,v_updated_at)
    on conflict(group_id,event_id,user_id) do update
      set status=excluded.status,updated_at=excluded.updated_at
      where excluded.updated_at>=public.bandplan_event_participation.updated_at;
    select status,updated_at into v_current_status,v_current_updated_at
    from public.bandplan_event_participation
    where group_id=v_gid and event_id=trim(p_event_id) and user_id=v_uid;
  end if;

  return jsonb_build_object(
    'group_id',v_gid,'event_id',trim(p_event_id),'user_id',v_uid,
    'status',v_current_status,'updated_at',coalesce(v_current_updated_at,v_updated_at)
  );
end;
$$;

-- Public-schema RPCs are intentionally callable only by authenticated users.
revoke all on function public.bandplan_get_my_groups() from public, anon;
revoke all on function public.bandplan_set_active_group(uuid) from public, anon;
revoke all on function public.bandplan_get_my_group() from public, anon;
revoke all on function public.bandplan_create_group(text,text,text[]) from public, anon;
revoke all on function public.bandplan_join_group(text,text,text[]) from public, anon;
revoke all on function public.bandplan_get_invite_code() from public, anon;
revoke all on function public.bandplan_create_group_and_invite(text,text,text[],uuid) from public, anon;
revoke all on function public.bandplan_leave_group(uuid) from public, anon;
revoke all on function public.bandplan_rename_group(text,uuid) from public, anon;
revoke all on function public.bandplan_sync_group(jsonb,jsonb,jsonb,jsonb,text,text[],jsonb,text[],text[],text[],uuid) from public, anon;
revoke all on function public.bandplan_set_event_participation(text,text,timestamptz,uuid) from public, anon;

grant execute on function public.bandplan_get_my_groups() to authenticated;
grant execute on function public.bandplan_set_active_group(uuid) to authenticated;
grant execute on function public.bandplan_get_my_group() to authenticated;
grant execute on function public.bandplan_create_group(text,text,text[]) to authenticated;
grant execute on function public.bandplan_join_group(text,text,text[]) to authenticated;
grant execute on function public.bandplan_get_invite_code() to authenticated;
grant execute on function public.bandplan_create_group_and_invite(text,text,text[],uuid) to authenticated;
grant execute on function public.bandplan_leave_group(uuid) to authenticated;
grant execute on function public.bandplan_rename_group(text,uuid) to authenticated;
grant execute on function public.bandplan_sync_group(jsonb,jsonb,jsonb,jsonb,text,text[],jsonb,text[],text[],text[],uuid) to authenticated;
grant execute on function public.bandplan_set_event_participation(text,text,timestamptz,uuid) to authenticated;
