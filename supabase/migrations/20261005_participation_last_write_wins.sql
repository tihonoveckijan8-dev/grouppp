-- Backward-compatible participation conflict handling.
-- Adds an optional client timestamp while preserving the existing yes/maybe/no values.
create or replace function public.bandplan_set_event_participation(
  p_event_id text,
  p_status text,
  p_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_gid uuid;
  v_status text := nullif(trim(coalesce(p_status,'')),'');
  v_updated_at timestamptz := coalesce(p_updated_at, now());
  v_current_status text;
  v_current_updated_at timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_status is not null and v_status not in ('yes','maybe','no') then
    raise exception 'INVALID_PARTICIPATION_STATUS';
  end if;

  v_updated_at := greatest(now() - interval '30 days', least(v_updated_at, now() + interval '5 minutes'));

  select group_id into v_gid
  from public.bandplan_group_members
  where user_id = v_uid
  order by joined_at asc nulls last
  limit 1;

  if v_gid is null then raise exception 'GROUP_REQUIRED'; end if;

  if not exists (
    select 1 from public.bandplan_events
    where group_id = v_gid and id = trim(p_event_id)
  ) then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  select status, updated_at
    into v_current_status, v_current_updated_at
  from public.bandplan_event_participation
  where group_id = v_gid and event_id = trim(p_event_id) and user_id = v_uid;

  if v_status is null then
    if v_current_updated_at is null or v_updated_at >= v_current_updated_at then
      delete from public.bandplan_event_participation
      where group_id=v_gid and event_id=trim(p_event_id) and user_id=v_uid;
      v_current_status := null;
      v_current_updated_at := v_updated_at;
    end if;
  else
    insert into public.bandplan_event_participation(group_id,event_id,user_id,status,updated_at)
    values(v_gid,trim(p_event_id),v_uid,v_status,v_updated_at)
    on conflict(group_id,event_id,user_id)
    do update set status=excluded.status,updated_at=excluded.updated_at
      where excluded.updated_at >= public.bandplan_event_participation.updated_at;
    select status, updated_at
      into v_current_status, v_current_updated_at
    from public.bandplan_event_participation
    where group_id=v_gid and event_id=trim(p_event_id) and user_id=v_uid;
  end if;

  return jsonb_build_object(
    'group_id',v_gid,'event_id',trim(p_event_id),'user_id',v_uid,
    'status',v_current_status,'updated_at',coalesce(v_current_updated_at,v_updated_at)
  );
end
$function$;