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