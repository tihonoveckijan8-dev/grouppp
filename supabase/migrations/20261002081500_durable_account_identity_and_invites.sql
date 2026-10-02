create or replace function public.bandplan_sync_group(
  p_songs jsonb,p_events jsonb,p_setlists jsonb,p_roster jsonb,p_display_name text,p_roles text[],p_personal_settings jsonb,
  p_delete_songs text[] default '{}'::text[],p_delete_events text[] default '{}'::text[],p_delete_setlists text[] default '{}'::text[]
) returns void language plpgsql security definer set search_path to 'public','auth' as $function$
declare v_uid uuid:=auth.uid(); v_gid uuid; v_row jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select group_id into v_gid from public.bandplan_group_members where user_id=v_uid order by joined_at limit 1;
 if v_gid is null then raise exception 'GROUP_REQUIRED'; end if;
 insert into public.bandplan_accounts(user_id,display_name,roles,personal_settings)
 values(v_uid,trim(coalesce(p_display_name,'')),coalesce(p_roles,'{}'),coalesce(p_personal_settings,'{}'))
 on conflict(user_id) do update set
   display_name=case when nullif(trim(coalesce(p_display_name,'')),'') is null then public.bandplan_accounts.display_name else trim(p_display_name) end,
   roles=case when coalesce(array_length(p_roles,1),0)=0 then public.bandplan_accounts.roles else p_roles end,
   personal_settings=coalesce(p_personal_settings,public.bandplan_accounts.personal_settings),updated_at=now();
 delete from public.bandplan_songs where group_id=v_gid and id=any(coalesce(p_delete_songs,'{}'));
 for v_row in select value from jsonb_array_elements(coalesce(p_songs,'[]'::jsonb)) loop
   if coalesce(v_row->>'id','')<>'' then
     insert into public.bandplan_songs(group_id,id,data,updated_by) values(v_gid,v_row->>'id',v_row,v_uid)
     on conflict(group_id,id) do update set data=excluded.data,updated_by=v_uid,updated_at=now();
   end if;
 end loop;
 delete from public.bandplan_events where group_id=v_gid and id=any(coalesce(p_delete_events,'{}'));
 for v_row in select value from jsonb_array_elements(coalesce(p_events,'[]'::jsonb)) loop
   if coalesce(v_row->>'id','')<>'' then
     insert into public.bandplan_events(group_id,id,data,updated_by) values(v_gid,v_row->>'id',v_row,v_uid)
     on conflict(group_id,id) do update set data=excluded.data,updated_by=v_uid,updated_at=now();
   end if;
 end loop;
 delete from public.bandplan_setlists where group_id=v_gid and id=any(coalesce(p_delete_setlists,'{}'));
 for v_row in select value from jsonb_array_elements(coalesce(p_setlists,'[]'::jsonb)) loop
   if coalesce(v_row->>'id','')<>'' then
     insert into public.bandplan_setlists(group_id,id,data,updated_by) values(v_gid,v_row->>'id',v_row,v_uid)
     on conflict(group_id,id) do update set data=excluded.data,updated_by=v_uid,updated_at=now();
   end if;
 end loop;
end $function$;

create or replace function public.bandplan_join_group(p_code text,p_display_name text,p_roles text[] default '{}'::text[])
returns table(group_id uuid,group_name text) language plpgsql security definer set search_path to 'public','auth' as $function$
declare v_uid uuid:=auth.uid(); v_inv public.bandplan_group_invites%rowtype; v_added integer:=0;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_inv from public.bandplan_group_invites where invite_code=upper(trim(coalesce(p_code,''))) for update;
 if not found or (v_inv.expires_at is not null and v_inv.expires_at<now()) or v_inv.uses>=v_inv.max_uses then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;
 delete from public.bandplan_group_members where user_id=v_uid and group_id<>v_inv.group_id;
 insert into public.bandplan_group_members(group_id,user_id) values(v_inv.group_id,v_uid) on conflict do nothing;
 get diagnostics v_added=row_count;
 if v_added>0 then update public.bandplan_group_invites set uses=uses+1 where id=v_inv.id; end if;
 insert into public.bandplan_accounts(user_id,display_name,roles) values(v_uid,trim(coalesce(p_display_name,'')),coalesce(p_roles,'{}'))
 on conflict(user_id) do update set
   display_name=case when nullif(trim(coalesce(p_display_name,'')),'') is null then public.bandplan_accounts.display_name else trim(p_display_name) end,
   roles=case when coalesce(array_length(p_roles,1),0)=0 then public.bandplan_accounts.roles else p_roles end,
   updated_at=now();
 return query select g.id,g.name from public.bandplan_groups g where g.id=v_inv.group_id;
end $function$;

create or replace function public.bandplan_get_invite_code()
returns text language plpgsql security definer set search_path to 'public','auth' as $function$
declare v_uid uuid:=auth.uid(); v_gid uuid; v_code text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select group_id into v_gid from public.bandplan_group_members where user_id=v_uid order by joined_at limit 1;
 if v_gid is null then raise exception 'GROUP_REQUIRED'; end if;
 select invite_code into v_code from public.bandplan_group_invites
 where group_id=v_gid and (expires_at is null or expires_at>now()) and uses<max_uses
 order by created_at desc limit 1;
 if v_code is null then
   loop
     v_code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
     exit when not exists(select 1 from public.bandplan_group_invites where invite_code=v_code);
   end loop;
   insert into public.bandplan_group_invites(group_id,invite_code,created_by) values(v_gid,v_code,v_uid);
 end if;
 return v_code;
end $function$;
grant execute on function public.bandplan_get_invite_code() to authenticated;