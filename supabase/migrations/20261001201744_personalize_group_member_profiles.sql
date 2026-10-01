-- BandPlan: participant identity and roles are owned by each account.
-- The shared group roster is derived from group membership + bandplan_accounts.
-- Keep p_roster in the RPC signature for backwards compatibility, but never
-- overwrite shared member identity from one client's local state.

create or replace function public.bandplan_sync_group(
  p_songs jsonb,
  p_events jsonb,
  p_setlists jsonb,
  p_roster jsonb,
  p_display_name text,
  p_roles text[],
  p_personal_settings jsonb,
  p_delete_songs text[] default '{}'::text[],
  p_delete_events text[] default '{}'::text[],
  p_delete_setlists text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_gid uuid;
  v_row jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select group_id into v_gid
  from public.bandplan_group_members
  where user_id=v_uid
  order by joined_at
  limit 1;

  if v_gid is null then raise exception 'GROUP_REQUIRED'; end if;

  insert into public.bandplan_accounts(user_id,display_name,roles,personal_settings)
  values(
    v_uid,
    trim(coalesce(p_display_name,'')),
    coalesce(p_roles,'{}'),
    coalesce(p_personal_settings,'{}')
  )
  on conflict(user_id) do update set
    display_name=excluded.display_name,
    roles=excluded.roles,
    personal_settings=excluded.personal_settings,
    updated_at=now();

  delete from public.bandplan_songs
    where group_id=v_gid and id=any(coalesce(p_delete_songs,'{}'));

  for v_row in select value from jsonb_array_elements(coalesce(p_songs,'[]'::jsonb)) loop
    if coalesce(v_row->>'id','')<>'' then
      insert into public.bandplan_songs(group_id,id,data,updated_by)
      values(v_gid,v_row->>'id',v_row,v_uid)
      on conflict(group_id,id) do update set
        data=excluded.data,updated_by=v_uid,updated_at=now();
    end if;
  end loop;

  delete from public.bandplan_events
    where group_id=v_gid and id=any(coalesce(p_delete_events,'{}'));

  for v_row in select value from jsonb_array_elements(coalesce(p_events,'[]'::jsonb)) loop
    if coalesce(v_row->>'id','')<>'' then
      insert into public.bandplan_events(group_id,id,data,updated_by)
      values(v_gid,v_row->>'id',v_row,v_uid)
      on conflict(group_id,id) do update set
        data=excluded.data,updated_by=v_uid,updated_at=now();
    end if;
  end loop;

  delete from public.bandplan_setlists
    where group_id=v_gid and id=any(coalesce(p_delete_setlists,'{}'));

  for v_row in select value from jsonb_array_elements(coalesce(p_setlists,'[]'::jsonb)) loop
    if coalesce(v_row->>'id','')<>'' then
      insert into public.bandplan_setlists(group_id,id,data,updated_by)
      values(v_gid,v_row->>'id',v_row,v_uid)
      on conflict(group_id,id) do update set
        data=excluded.data,updated_by=v_uid,updated_at=now();
    end if;
  end loop;
end
$function$;
