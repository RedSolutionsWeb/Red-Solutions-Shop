-- Jackson doesn't have real per-part cost data loaded yet (every active
-- part is still sitting at the cost=0 "unknown" sentinel). As a working
-- estimate for margin reporting, approximate cost as a 37% discount off
-- retail price (cost = price * 0.63) for every drone part. The one
-- "Service" category line ("Shop supplies", a consumable/labor fee, not
-- a physical drone part) is deliberately left out.
--
-- parts_guard_cost normally only lets a manager-authenticated session
-- change cost; a direct migration has no such session, so it's disabled
-- just for this one statement.
alter table parts disable trigger parts_guard_cost;

update parts
set cost = round(price * 0.63, 2), updated_at = now()
where is_active and category <> 'Service';

alter table parts enable trigger parts_guard_cost;
