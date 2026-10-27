-- Timers so techs can track hands-on time per job instead of guessing
-- hours after the fact. A running timer is a time_entries row with no
-- stopped_at; stopping it converts the elapsed time straight into a
-- labor_line at the shop's current labor rate.
create table public.time_entries (
  id bigint generated always as identity primary key,
  ticket_id text not null references public.tickets(id) on delete cascade,
  tech_id uuid not null references public.profiles(id),
  description text not null default 'Labor',
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  cancelled boolean not null default false
);

-- A tech can only have one timer going at a time, shop-wide.
create unique index time_entries_one_active_per_tech
  on public.time_entries (tech_id)
  where stopped_at is null;

alter table public.time_entries enable row level security;
create policy time_entries_select on public.time_entries for select
  using (public.is_staff());
-- No insert/update policy: every mutation goes through the RPCs below,
-- same "no direct writes" pattern used for invoices.

grant select on public.time_entries to authenticated;

create function public.start_timer(p_ticket_id text, p_description text default 'Labor')
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;
  if exists (select 1 from public.time_entries where tech_id = auth.uid() and stopped_at is null) then
    raise exception 'you already have a timer running on another job';
  end if;
  insert into public.time_entries (ticket_id, tech_id, description)
  values (p_ticket_id, auth.uid(), coalesce(nullif(trim(p_description), ''), 'Labor'))
  returning id into v_id;
  return v_id;
end;
$$;

-- Freezes elapsed hours (rounded to the nearest 0.01h) onto a new
-- labor_line at the shop's CURRENT labor rate, same as a manually typed
-- line. A timer stopped within a second of starting is treated as an
-- accidental tap and discarded rather than creating a $0 line.
create function public.stop_timer(p_time_entry_id bigint)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_tech_id uuid;
  v_ticket_id text;
  v_description text;
  v_started_at timestamptz;
  v_stopped_at timestamptz := now();
  v_hours numeric;
  v_rate numeric;
  v_line_id bigint;
begin
  select tech_id, ticket_id, description, started_at
    into v_tech_id, v_ticket_id, v_description, v_started_at
    from public.time_entries
   where id = p_time_entry_id and stopped_at is null;
  if not found then raise exception 'timer % is not running', p_time_entry_id; end if;
  if v_tech_id <> auth.uid() and not public.is_owner() then raise exception 'not authorized'; end if;

  update public.time_entries set stopped_at = v_stopped_at where id = p_time_entry_id;

  v_hours := round(extract(epoch from (v_stopped_at - v_started_at)) / 3600.0, 2);
  if v_hours <= 0 then
    update public.time_entries set cancelled = true where id = p_time_entry_id;
    return null;
  end if;

  select labor_rate into v_rate from public.shop_settings;

  insert into public.labor_lines (ticket_id, description, hours, rate)
  values (v_ticket_id, v_description, v_hours, v_rate)
  returning id into v_line_id;

  return v_line_id;
end;
$$;

-- Discards a running timer with no labor_line created (started by mistake).
create function public.cancel_timer(p_time_entry_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tech_id uuid;
begin
  select tech_id into v_tech_id from public.time_entries
   where id = p_time_entry_id and stopped_at is null;
  if not found then raise exception 'timer % is not running', p_time_entry_id; end if;
  if v_tech_id <> auth.uid() and not public.is_owner() then raise exception 'not authorized'; end if;
  update public.time_entries set stopped_at = now(), cancelled = true where id = p_time_entry_id;
end;
$$;

revoke execute on function public.start_timer(text, text) from public;
revoke execute on function public.start_timer(text, text) from anon;
revoke execute on function public.stop_timer(bigint) from public;
revoke execute on function public.stop_timer(bigint) from anon;
revoke execute on function public.cancel_timer(bigint) from public;
revoke execute on function public.cancel_timer(bigint) from anon;

grant execute on function public.start_timer(text, text) to authenticated;
grant execute on function public.stop_timer(bigint) to authenticated;
grant execute on function public.cancel_timer(bigint) to authenticated;
