-- Per-customer pricing overrides for repair tickets. null means "use the
-- shop default" (catalog retail price, settings.labor_rate); set means
-- that customer always gets cost-plus pricing on parts and their own
-- labor rate instead.
--
-- parts_markup_pct is applied as price = cost * (1 + pct/100) -- only
-- when cost is actually known (> 0) and the part isn't a Service-type
-- line (labor/supply fees always use the catalog price, never cost-plus
-- a markup off a cost that's always 0 for them). Note: cost itself is
-- currently a 37%-off-retail estimate for most parts (migration 0046),
-- not a real invoiced cost, so this pricing is only as accurate as that
-- estimate until real per-part costs are loaded in.
alter table public.customers
  add column if not exists parts_markup_pct numeric,
  add column if not exists labor_rate numeric;

update public.customers set parts_markup_pct = 7.5, labor_rate = 50 where name = 'REDAIR LLC';

create or replace function public.pull_part(p_ticket_id text, p_sku text, p_qty integer)
returns table(part_line_id bigint, new_qty integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text; v_price numeric; v_qty integer; v_id bigint;
  v_cost numeric; v_category text;
  v_customer_id bigint; v_markup numeric;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;

  select customer_id into v_customer_id from public.tickets where id = p_ticket_id;
  if v_customer_id is not null then
    select parts_markup_pct into v_markup from public.customers where id = v_customer_id;
  end if;

  update public.parts
     set qty_on_hand = qty_on_hand - p_qty, updated_at = now()
   where sku = p_sku
   returning name, price, qty_on_hand, cost, category into v_name, v_price, v_qty, v_cost, v_category;
  if not found then raise exception 'unknown sku %', p_sku; end if;

  if v_markup is not null and v_category is distinct from 'Service' and v_cost > 0 then
    v_price := round(v_cost * (1 + v_markup / 100), 2);
  end if;

  insert into public.part_lines (ticket_id, sku, name, qty, price)
  values (p_ticket_id, p_sku, v_name, p_qty, v_price)
  returning id into v_id;

  return query select v_id, v_qty;
end;
$function$;
