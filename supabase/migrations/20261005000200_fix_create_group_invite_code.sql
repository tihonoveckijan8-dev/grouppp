-- BandPlan: fix provisioning failure caused by ambiguity between
-- the RETURNS TABLE invite_code output and the invite_code column.

create or replace function public.bandplan_create_group(
  p_name text,
  p_display_name text,
  p_roles text[] default '{}'
)
returns table(group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_gid uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(coalesce(p_name,''))) not between 3 and 50 then
    raise exception 'GROUP_NAME_INVALID';
  end if;

  insert into public.bandplan_groups(name,owner_id)
  values(trim(p_name),v_uid)
  returning id into v_gid;

  insert into public.bandplan_group_members(group_id,user_id)
  values(v_gid,v_uid);

  insert into public.bandplan_accounts(user_id,display_name,roles)
  values(v_uid,trim(coalesce(p_display_name,'')),coalesce(p_roles,'{}'))
  on conflict(user_id) do update set
    display_name=case
      when nullif(trim(coalesce(p_display_name,'')),'') is null
        then public.bandplan_accounts.display_name
      else trim(p_display_name)
    end,
    roles=case
      when coalesce(array_length(p_roles,1),0)=0
        then public.bandplan_accounts.roles
      else p_roles
    end,
    updated_at=now();

  loop
    v_code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
    exit when not exists(
      select 1
      from public.bandplan_group_invites gi
      where gi.invite_code=v_code
    );
  end loop;

  insert into public.bandplan_group_invites(group_id,invite_code,created_by)
  values(v_gid,v_code,v_uid);

  insert into public.bandplan_group_state(group_id,state)
  values(v_gid,'{"members":[],"events":[],"songs":[],"setlists":[]}'::jsonb);

  return query select v_gid,v_code;
end
$function$;

revoke execute on function public.bandplan_create_group(text,text,text[]) from public;
revoke execute on function public.bandplan_create_group(text,text,text[]) from anon;
grant execute on function public.bandplan_create_group(text,text,text[]) to authenticated;
