-- Monthly inventory count feature: a staff member walks the shelf,
-- entering counted quantities as they go; finishing the session produces
-- a variance report against both the shop's current qty_on_hand and
-- QuickBooks' last-synced quantity (QBO has no live API connection here —
-- qbo_qty_on_hand is a periodic snapshot, refreshed by a scheduled sync,
-- not a live read).
alter table public.parts
  add column if not exists qbo_qty_on_hand integer,
  add column if not exists qbo_qty_synced_at timestamptz;

create table if not exists public.inventory_counts (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  started_by uuid references public.profiles(id),
  completed_at timestamptz,
  applied_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed', 'applied'))
);

create table if not exists public.inventory_count_lines (
  id bigint generated always as identity primary key,
  count_id bigint not null references public.inventory_counts(id) on delete cascade,
  sku text not null references public.parts(sku),
  system_qty integer not null,
  qbo_qty integer,
  counted_qty integer not null,
  counted_at timestamptz not null default now(),
  counted_by uuid references public.profiles(id),
  unique (count_id, sku)
);

alter table public.inventory_counts enable row level security;
alter table public.inventory_count_lines enable row level security;

create policy inventory_counts_staff_all on public.inventory_counts
  for all using (is_staff()) with check (is_staff());

create policy inventory_count_lines_staff_all on public.inventory_count_lines
  for all using (is_staff()) with check (is_staff());

create or replace function public.start_inventory_count()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id bigint;
begin
  if not is_staff() then
    raise exception 'Staff only';
  end if;

  select id into v_id from inventory_counts where status = 'open' order by started_at desc limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into inventory_counts (started_by) values (auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.count_line_upsert(p_count_id bigint, p_sku text, p_qty integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status text;
begin
  if not is_staff() then
    raise exception 'Staff only';
  end if;
  if p_qty < 0 then
    raise exception 'Count cannot be negative';
  end if;

  select status into v_status from inventory_counts where id = p_count_id;
  if v_status is null then
    raise exception 'Count session not found';
  end if;
  if v_status <> 'open' then
    raise exception 'This count is already finished';
  end if;

  insert into inventory_count_lines (count_id, sku, system_qty, qbo_qty, counted_qty, counted_by)
  select p_count_id, p_sku, qty_on_hand, qbo_qty_on_hand, p_qty, auth.uid()
  from parts where sku = p_sku
  on conflict (count_id, sku) do update
    set counted_qty = excluded.counted_qty, counted_at = now(), counted_by = excluded.counted_by;
end;
$$;

create or replace function public.complete_inventory_count(p_count_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_staff() then
    raise exception 'Staff only';
  end if;

  update inventory_counts
  set status = 'completed', completed_at = now()
  where id = p_count_id and status = 'open';

  if not found then
    raise exception 'Count session not open';
  end if;
end;
$$;

create or replace function public.apply_inventory_count(p_count_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status text;
begin
  if not is_manager() then
    raise exception 'Manager or owner only';
  end if;

  select status into v_status from inventory_counts where id = p_count_id;
  if v_status is distinct from 'completed' then
    raise exception 'Count must be completed before applying';
  end if;

  update parts set qty_on_hand = l.counted_qty
  from inventory_count_lines l
  where parts.sku = l.sku and l.count_id = p_count_id;

  update inventory_counts set status = 'applied', applied_at = now() where id = p_count_id;
end;
$$;

revoke all on function public.start_inventory_count() from public;
revoke all on function public.count_line_upsert(bigint, text, integer) from public;
revoke all on function public.complete_inventory_count(bigint) from public;
revoke all on function public.apply_inventory_count(bigint) from public;
grant execute on function public.start_inventory_count() to authenticated;
grant execute on function public.count_line_upsert(bigint, text, integer) to authenticated;
grant execute on function public.complete_inventory_count(bigint) to authenticated;
grant execute on function public.apply_inventory_count(bigint) to authenticated;

create or replace view parts_view as
select
  sku,
  name,
  category,
  fits,
  qty_on_hand,
  price,
  case when is_manager() then cost else null::numeric end as cost,
  case when is_manager() and cost > 0::numeric then round(price - cost, 2) else null::numeric end as margin,
  updated_at,
  qbo_qty_on_hand,
  qbo_qty_synced_at
from parts p
where is_staff() and is_active;
