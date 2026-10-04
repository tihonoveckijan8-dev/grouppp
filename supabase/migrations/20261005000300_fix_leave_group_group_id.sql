create or replace function public.bandplan_leave_group()
returns table(group_id uuid, group_name text)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_group_name text;
  v_personal jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select gm.group_id, g.name into v_group_id, v_group_name
  from public.bandplan_group_members gm
  left join public.bandplan_groups g on g.id=gm.group_id
  where gm.user_id=v_uid
  order by gm.joined_at asc nulls last limit 1;

  if v_group_id is null then return; end if;

  update public.bandplan_group_state gs
  set state=jsonb_set(coalesce(gs.state,'{}'::jsonb),'{members}',
    coalesce((select jsonb_agg(member) from jsonb_array_elements(coalesce(gs.state->'members','[]'::jsonb)) member
      where coalesce(member->>'accountId',member->>'id','')<>v_uid::text),'[]'::jsonb),true),
    updated_at=now()
  where gs.group_id=v_group_id;

  delete from public.bandplan_group_invites gi
  where gi.created_by=v_uid and gi.group_id=v_group_id;

  delete from public.bandplan_group_members gm
  where gm.user_id=v_uid and gm.group_id=v_group_id;

  select us.state into v_personal from public.bandplan_user_state us where us.user_id=v_uid;
  if found then
    v_personal=coalesce(v_personal,'{}'::jsonb);
    v_personal=jsonb_set(v_personal,'{profile}',(coalesce(v_personal->'profile','{}'::jsonb)-'groupId') || jsonb_build_object('groupDetached',true,'eventParticipation','{}'::jsonb),true);
    v_personal=jsonb_set(v_personal,'{songs}','[]'::jsonb,true);
    v_personal=jsonb_set(v_personal,'{events}','[]'::jsonb,true);
    v_personal=jsonb_set(v_personal,'{setlists}','[]'::jsonb,true);
    v_personal=jsonb_set(v_personal,'{members}','[]'::jsonb,true);
    update public.bandplan_user_state us set state=v_personal,updated_at=now() where us.user_id=v_uid;
  end if;

  return query select g.id,g.name from public.bandplan_groups g where g.id=v_group_id;
end
$function$;

revoke all on function public.bandplan_leave_group() from public;
revoke all on function public.bandplan_leave_group() from anon;
grant execute on function public.bandplan_leave_group() to authenticated;
