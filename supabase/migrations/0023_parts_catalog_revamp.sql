-- Parts catalog revamp: the shop's inventory is now keyed to QuickBooks'
-- active drone-parts catalog instead of a bulk-imported exploded-diagram
-- parts list that drifted far out of sync with what's actually sold.
--
-- is_active marks which parts are currently considered "real" (matched to
-- an active QuickBooks item). Inactive rows are kept, not deleted, in case
-- they're ever confirmed and brought back in.
alter table public.parts add column if not exists is_active boolean not null default true;

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
  updated_at
from parts p
where is_staff() and is_active;
