-- BandPlan: make account deletion safe across all auth.users foreign keys.
-- Keep shared group data when another member survives; transfer ownership.
-- Remove empty groups and their shared records when the deleted user was sole member.

create or replace function public.bandplan_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_transfer_user uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  for v_group_id in
    select id from public.bandplan_groups where owner_id = v_uid
  loop
    select gm.user_id into v_transfer_user
    from public.bandplan_group_members gm
    where gm.group_id = v_group_id and gm.user_id <> v_uid
    order by gm.joined_at, gm.user_id
    limit 1;

    if v_transfer_user is not null then
      update public.bandplan_groups
      set owner_id = v_transfer_user
      where id = v_group_id;
    else
      delete from public.bandplan_event_participation where group_id = v_group_id;
      delete from public.bandplan_setlists where group_id = v_group_id;
      delete from public.bandplan_events where group_id = v_group_id;
      delete from public.bandplan_songs where group_id = v_group_id;
      delete from public.bandplan_group_state where group_id = v_group_id;
      delete from public.bandplan_group_invites where group_id = v_group_id;
      delete from public.bandplan_group_members where group_id = v_group_id;
      delete from public.bandplan_groups where id = v_group_id;
    end if;

    v_transfer_user := null;
  end loop;

  update public.bandplan_songs s
  set updated_by = g.owner_id
  from public.bandplan_groups g
  where s.group_id = g.id and s.updated_by = v_uid;

  update public.bandplan_events e
  set updated_by = g.owner_id
  from public.bandplan_groups g
  where e.group_id = g.id and e.updated_by = v_uid;

  update public.bandplan_setlists sl
  set updated_by = g.owner_id
  from public.bandplan_groups g
  where sl.group_id = g.id and sl.updated_by = v_uid;

  delete from public.bandplan_event_participation where user_id = v_uid;
  delete from public.bandplan_friendships where user_id = v_uid or friend_id = v_uid;

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
  where exists (
    select 1
    from jsonb_array_elements(coalesce(gs.state->'members', '[]'::jsonb)) member
    where coalesce(member->>'accountId', member->>'id', '') = v_uid::text
  );

  delete from public.bandplan_group_invites where created_by = v_uid;
  delete from public.bandplan_group_members where user_id = v_uid;
  delete from public.bandplan_accounts where user_id = v_uid;
  delete from public.bandplan_profiles where id = v_uid;
  delete from public.bandplan_user_state where user_id = v_uid;
  delete from auth.users where id = v_uid;
end
$function$;

revoke execute on function public.bandplan_delete_my_account() from public;
revoke execute on function public.bandplan_delete_my_account() from anon;
grant execute on function public.bandplan_delete_my_account() to authenticated;
