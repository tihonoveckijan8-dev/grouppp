-- WHY: a single-member group must not trap its owner. When the last owner leaves,
-- delete that now-unowned workspace; foreign-key cascades remove only that group's data.
create or replace function public.bandplan_leave_group(p_group_id uuid default null)
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
    where gm.user_id = v_uid
    order by case when gm.group_id = (
      select nullif(state->>'activeGroupId','')::uuid
      from public.bandplan_user_state where user_id = v_uid
    ) then 0 else 1 end, gm.joined_at
    limit 1;
  end if;
  if v_group_id is null then return; end if;
  if not exists (
    select 1 from public.bandplan_group_members
    where user_id = v_uid and group_id = v_group_id
  ) then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;

  select name into v_group_name
  from public.bandplan_groups where id = v_group_id;

  if exists (
    select 1 from public.bandplan_groups
    where id = v_group_id and owner_id = v_uid
  ) then
    select gm.user_id into v_next_owner
    from public.bandplan_group_members gm
    where gm.group_id = v_group_id and gm.user_id <> v_uid
    order by gm.joined_at asc nulls last, gm.user_id
    limit 1;

    if v_next_owner is null then
      -- WHY: delete only the now-unowned group so its owner can leave cleanly.
      delete from public.bandplan_groups
      where id = v_group_id and owner_id = v_uid;
    else
      update public.bandplan_groups set owner_id = v_next_owner
      where id = v_group_id and owner_id = v_uid;
    end if;
  end if;

  if exists (select 1 from public.bandplan_groups where id = v_group_id) then
    update public.bandplan_group_state gs
    set state = jsonb_set(
      coalesce(gs.state, '{}'::jsonb),
      '{members}',
      coalesce((
        select jsonb_agg(member)
        from jsonb_array_elements(coalesce(gs.state->'members', '[]'::jsonb)) member
        where coalesce(member->>'accountId', member->>'id', '') <> v_uid::text
      ), '[]'::jsonb),
      true
    ),
    updated_at = now()
    where gs.group_id = v_group_id;

    delete from public.bandplan_group_invites
    where created_by = v_uid and group_id = v_group_id;
    delete from public.bandplan_group_members
    where user_id = v_uid and group_id = v_group_id;
  end if;

  select gm.group_id, g.name into v_next_group, v_next_name
  from public.bandplan_group_members gm
  join public.bandplan_groups g on g.id = gm.group_id
  where gm.user_id = v_uid
  order by gm.joined_at asc nulls last
  limit 1;

  select state into v_personal
  from public.bandplan_user_state where user_id = v_uid;
  v_personal := coalesce(v_personal, '{}'::jsonb);

  if v_next_group is not null then
    v_personal := jsonb_set(v_personal, '{activeGroupId}', to_jsonb(v_next_group::text), true);
    v_personal := jsonb_set(v_personal, '{profile}',
      (coalesce(v_personal->'profile', '{}'::jsonb) - 'groupDetached')
        || jsonb_build_object('groupId', v_next_group::text, 'bandName', v_next_name), true);
  else
    v_personal := v_personal - 'activeGroupId';
    v_personal := jsonb_set(v_personal, '{profile}',
      (coalesce(v_personal->'profile', '{}'::jsonb) - 'groupId')
        || jsonb_build_object('groupDetached', true, 'eventParticipation', '{}'::jsonb), true);
    v_personal := jsonb_set(v_personal, '{songs}', '[]'::jsonb, true);
    v_personal := jsonb_set(v_personal, '{events}', '[]'::jsonb, true);
    v_personal := jsonb_set(v_personal, '{setlists}', '[]'::jsonb, true);
    v_personal := jsonb_set(v_personal, '{members}', '[]'::jsonb, true);
  end if;

  insert into public.bandplan_user_state(user_id, state)
  values (v_uid, v_personal)
  on conflict (user_id) do update
    set state = excluded.state, updated_at = now();

  return query select v_group_id, v_group_name;
end;
$$;
