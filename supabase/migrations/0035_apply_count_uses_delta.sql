-- apply_inventory_count() was overwriting qty_on_hand with the raw
-- counted value, discarding any stock movement (sales, pulls, receiving)
-- that happened between when a part was counted and when the count is
-- later applied. Fix: apply the *delta* found during counting
-- (counted_qty - system_qty, where system_qty is the snapshot taken the
-- moment the part was first counted in this session) on top of whatever
-- qty_on_hand is *now*, instead of replacing it outright. A part with no
-- discrepancy (counted == system_qty) is left untouched by real-time
-- activity; a part found off by N stays off by N regardless of what's
-- happened to stock since.
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

  update parts set qty_on_hand = parts.qty_on_hand + (l.counted_qty - l.system_qty), updated_at = now()
  from inventory_count_lines l
  where parts.sku = l.sku and l.count_id = p_count_id and l.counted_qty <> l.system_qty;

  update inventory_counts set status = 'applied', applied_at = now() where id = p_count_id;
end;
$$;
