-- Views own the column-masking that RLS can't express (RLS is row-level;
-- cost/margin needs to disappear per-column for techs). Views default to
-- the *definer's* privileges (postgres), so they can read the otherwise
-- ungranted `parts` base table while still gating rows with is_staff() /
-- is_dealer() checks baked into the view body itself.

-- Shop-facing catalog: owner sees cost, tech sees NULL (never 0 — 0 would
-- read as a real cost and produce a false 100% margin).
create view public.parts_view
  with (security_invoker = false) as
select
  p.sku, p.name, p.category, p.fits, p.qty_on_hand, p.price,
  -- cost = 0 is the shop's own "unknown, never entered" sentinel, not a real
  -- $0 cost — the client renders both cost and margin as "—" in that case.
  case when public.is_owner() then p.cost else null end as cost,
  case when public.is_owner() and p.cost > 0
       then round(p.price - p.cost, 2) else null end as margin,
  p.updated_at
from public.parts p
where public.is_staff();

grant select on public.parts_view to authenticated;

-- Dealer-facing catalog: retail + this dealer's discounted price, no cost
-- ever, availability instead of raw on-hand count.
create view public.dealer_catalog
  with (security_invoker = false) as
select
  p.sku, p.name, p.category, p.fits,
  p.price as retail,
  round(p.price * (1 - d.discount_pct / 100.0), 2) as dealer_price,
  greatest(p.qty_on_hand, 0) as available,
  (p.qty_on_hand <= 0) as backorder
from public.parts p
join public.dealer_users du on du.id = auth.uid()
join public.dealers d on d.id = du.dealer_id;

grant select on public.dealer_catalog to authenticated;

-- Bundles priced live off current component retail (never denormalized),
-- for both the shop ticket picker and the dealer portal's "Complete kits".
create view public.bundle_pricing
  with (security_invoker = false) as
select
  b.id as bundle_id, b.sku, b.name,
  sum(bl.qty * p.price) as retail_total,
  min(p.qty_on_hand / bl.qty) as buildable,   -- floor via integer division
  jsonb_agg(jsonb_build_object(
    'sku', p.sku, 'name', p.name, 'qty', bl.qty, 'price', p.price
  ) order by p.name) as components
from public.bundles b
join public.bundle_lines bl on bl.bundle_id = b.id
join public.parts p on p.sku = bl.sku
where public.is_staff() or public.is_dealer()
group by b.id, b.sku, b.name;

grant select on public.bundle_pricing to authenticated;

-- Dealer's own catalog-priced bundles (discount applied)
create view public.dealer_bundle_pricing
  with (security_invoker = false) as
select
  bp.bundle_id, bp.sku, bp.name, bp.components, bp.buildable,
  bp.retail_total,
  round(bp.retail_total * (1 - d.discount_pct / 100.0), 2) as dealer_price
from public.bundle_pricing bp
join public.dealer_users du on du.id = auth.uid()
join public.dealers d on d.id = du.dealer_id;

grant select on public.dealer_bundle_pricing to authenticated;
