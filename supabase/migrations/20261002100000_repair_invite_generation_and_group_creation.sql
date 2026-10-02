create or replace function public.bandplan_create_group(
  p_name text,
  p_display_name text,
  p_roles text[] default '{}'::text[]
)
returns table(group_id uuid, invite_code text)
language plpgsql
security definer
set search_path to 'public','auth'
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
      select 1 from public.bandplan_group_invites where invite_code=v_code
    );
  end loop;

  insert into public.bandplan_group_invites(group_id,invite_code,created_by)
  values(v_gid,v_code,v_uid);

  insert into public.bandplan_group_state(group_id,state)
  values(v_gid,'{"members":[],"events":[],"songs":[],"setlists":[]}'::jsonb);

  return query select v_gid,v_code;
end
$function$;

create or replace function public.bandplan_get_invite_code()
returns text
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_gid uuid;
  v_code text;
  v_name text;
  v_roles text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select group_id into v_gid
  from public.bandplan_group_members
  where user_id=v_uid
  order by joined_at
  limit 1;

  if v_gid is null then
    select coalesce(nullif(trim(display_name),''),'Моя группа'),coalesce(roles,'{}')
      into v_name,v_roles
    from public.bandplan_accounts
    where user_id=v_uid;

    insert into public.bandplan_groups(name,owner_id)
    values(v_name,v_uid)
    returning id into v_gid;

    insert into public.bandplan_group_members(group_id,user_id)
    values(v_gid,v_uid);

    insert into public.bandplan_group_state(group_id,state)
    values(v_gid,'{"members":[],"events":[],"songs":[],"setlists":[]}'::jsonb)
    on conflict (group_id) do nothing;
  end if;

  select invite_code into v_code
  from public.bandplan_group_invites
  where group_id=v_gid
    and (expires_at is null or expires_at>now())
    and uses<max_uses
  order by created_at desc
  limit 1;

  if v_code is null then
    loop
      v_code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
      exit when not exists(
        select 1 from public.bandplan_group_invites where invite_code=v_code
      );
    end loop;

    insert into public.bandplan_group_invites(group_id,invite_code,created_by)
    values(v_gid,v_code,v_uid);
  end if;

  return v_code;
end
$function$;

revoke all on function public.bandplan_get_invite_code() from public,anon;
grant execute on function public.bandplan_get_invite_code() to authenticated;
