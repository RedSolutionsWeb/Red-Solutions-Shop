-- Add a way to cancel an open inventory count (e.g. one started by
-- accident, or one that was never going to be finished) without having
-- to finish and apply it. Cancelling is always safe since nothing is
-- written to parts.qty_on_hand until apply_inventory_count runs.
alter table public.inventory_counts drop constraint if exists inventory_counts_status_check;
alter table public.inventory_counts add constraint inventory_counts_status_check
  check (status in ('open', 'completed', 'applied', 'cancelled'));
alter table public.inventory_counts add column if not exists cancelled_at timestamptz;

create or replace function public.cancel_inventory_count(p_count_id bigint)
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
  set status = 'cancelled', cancelled_at = now()
  where id = p_count_id and status = 'open';

  if not found then
    raise exception 'Count session not open';
  end if;
end;
$$;

revoke all on function public.cancel_inventory_count(bigint) from public;
grant execute on function public.cancel_inventory_count(bigint) to authenticated;
