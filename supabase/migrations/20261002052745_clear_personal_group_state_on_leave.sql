create or replace function public.bandplan_leave_group()
returns table(group_id uuid, group_name text)
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_group_name text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select m.group_id, g.name into v_group_id, v_group_name
  from public.bandplan_group_members m
  join public.bandplan_groups g on g.id=m.group_id
  where m.user_id=v_uid
  order by m.created_at asc nulls last
  limit 1;
  if v_group_id is null then return; end if;
  delete from public.bandplan_group_members
  where user_id=v_uid and group_id=v_group_id;
  update public.bandplan_state
  set state = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(state,'{}'::jsonb),'{"songs"}','[]'::jsonb,true),
        '{"events"}','[]'::jsonb,true
      ),
      '{"setlists"}','[]'::jsonb,true
    ),
    '{"members"}','[]'::jsonb,true
  ),
  updated_at=now()
  where user_id=v_uid;
  return query select v_group_id, v_group_name;
end
$function$;