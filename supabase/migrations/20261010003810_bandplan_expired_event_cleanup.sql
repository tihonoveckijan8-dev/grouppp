-- Automatically clean expired shared calendar events from the database.
-- Exact end-time cleanup is also performed by the app when it is open; this
-- daily server job removes fully past-date records even if nobody opens the PWA.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.bandplan_cleanup_expired_events()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.bandplan_event_participation p
  using public.bandplan_events e
  where p.group_id = e.group_id
    and p.event_id = e.id
    and (e.data->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
    and (e.data->>'date')::date < current_date
    and (
      coalesce(nullif(e.data->>'repeat',''), 'none') = 'none'
      or (
        e.data->>'repeat' in ('weekly','biweekly','monthly')
        and nullif(e.data->>'repeatUntil','') ~ '^\d{4}-\d{2}-\d{2}$'
        and (e.data->>'repeatUntil')::date < current_date
      )
    );

  delete from public.bandplan_events e
  where (e.data->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
    and (e.data->>'date')::date < current_date
    and (
      coalesce(nullif(e.data->>'repeat',''), 'none') = 'none'
      or (
        e.data->>'repeat' in ('weekly','biweekly','monthly')
        and nullif(e.data->>'repeatUntil','') ~ '^\d{4}-\d{2}-\d{2}$'
        and (e.data->>'repeatUntil')::date < current_date
      )
    );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.bandplan_cleanup_expired_events() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'bandplan-expired-events-cleanup') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'bandplan-expired-events-cleanup';
  end if;
  perform cron.schedule(
    'bandplan-expired-events-cleanup',
    '5 12 * * *',
    'select public.bandplan_cleanup_expired_events();'
  );
end $$;
