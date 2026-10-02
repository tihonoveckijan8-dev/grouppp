create or replace function public.bandplan_create_group_and_invite(
  p_name text,
  p_display_name text,
  p_roles text[] default '{}'
)
returns table(group_id uuid, group_name text, invite_code text)
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_gid uuid;
  v_gname text;
  v_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select m.group_id into v_gid from public.bandplan_group_members m
  where m.user_id=v_uid order by m.joined_at limit 1;

  if v_gid is not null then
    select g.name into v_gname from public.bandplan_groups g where g.id=v_gid;
    select i.invite_code into v_code from public.bandplan_group_invites i
    where i.group_id=v_gid and (i.expires_at is null or i.expires_at>now())
      and i.uses<i.max_uses order by i.created_at desc limit 1;
    if v_code is null then
      loop
        v_code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
        exit when not exists(select 1 from public.bandplan_group_invites i where i.invite_code=v_code);
      end loop;
      insert into public.bandplan_group_invites(group_id,invite_code,created_by,max_uses)
      values(v_gid,v_code,v_uid,500);
    end if;
    return query select v_gid,v_gname,v_code;
    return;
  end if;

  v_gname:=trim(coalesce(p_name,''));
  if length(v_gname) not between 3 and 50 then v_gname:='Моя группа'; end if;
  insert into public.bandplan_groups(name,owner_id) values(v_gname,v_uid) returning id into v_gid;
  insert into public.bandplan_group_members(group_id,user_id) values(v_gid,v_uid);
  insert into public.bandplan_accounts(user_id,display_name,roles)
  values(v_uid,trim(coalesce(p_display_name,'')),coalesce(p_roles,'{}'))
  on conflict(user_id) do update set
    display_name=case when nullif(trim(coalesce(p_display_name,'')),'') is null
      then public.bandplan_accounts.display_name else trim(p_display_name) end,
    roles=case when coalesce(array_length(p_roles,1),0)=0
      then public.bandplan_accounts.roles else p_roles end,
    updated_at=now();
  insert into public.bandplan_group_state(group_id,state)
  values(v_gid,'{"members":[],"events":[],"songs":[],"setlists":[]}'::jsonb);
  loop
    v_code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
    exit when not exists(select 1 from public.bandplan_group_invites i where i.invite_code=v_code);
  end loop;
  insert into public.bandplan_group_invites(group_id,invite_code,created_by,max_uses)
  values(v_gid,v_code,v_uid,500);
  return query select v_gid,v_gname,v_code;
end
$function$;

revoke all on function public.bandplan_create_group_and_invite(text,text,text[]) from public,anon;
grant execute on function public.bandplan_create_group_and_invite(text,text,text[]) to authenticated;

create or replace function public.bandplan_join_group(
  p_code text,
  p_display_name text,
  p_roles text[] default '{}'
)
returns table(group_id uuid,group_name text)
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_inv public.bandplan_group_invites%rowtype;
  v_added integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select i.* into v_inv
  from public.bandplan_group_invites i
  where i.invite_code=upper(trim(coalesce(p_code,'')))
  for update;
  if not found
     or (v_inv.expires_at is not null and v_inv.expires_at<now())
     or v_inv.uses>=v_inv.max_uses
  then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;

  delete from public.bandplan_group_members m
  where m.user_id=v_uid and m.group_id<>v_inv.group_id;

  insert into public.bandplan_group_members(group_id,user_id)
  values(v_inv.group_id,v_uid)
  on conflict do nothing;
  get diagnostics v_added=row_count;

  if v_added>0 then
    update public.bandplan_group_invites i
    set uses=i.uses+1
    where i.id=v_inv.id;
  end if;

  insert into public.bandplan_accounts(user_id,display_name,roles)
  values(v_uid,trim(coalesce(p_display_name,'')),coalesce(p_roles,'{}'))
  on conflict(user_id) do update set
    display_name=case when nullif(trim(coalesce(p_display_name,'')),'') is null
      then public.bandplan_accounts.display_name else trim(p_display_name) end,
    roles=case when coalesce(array_length(p_roles,1),0)=0
      then public.bandplan_accounts.roles else p_roles end,
    updated_at=now();

  return query
  select g.id,g.name from public.bandplan_groups g where g.id=v_inv.group_id;
end
$function$;

alter table public.bandplan_group_invites alter column max_uses set default 500;
