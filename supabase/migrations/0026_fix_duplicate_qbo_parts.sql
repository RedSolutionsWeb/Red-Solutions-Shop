-- The catalog revamp (0023/0024) matched QuickBooks items against the shop's
-- existing parts by exact name string, which missed items that already
-- existed under their real manufacturer part number with slightly
-- different wording (e.g. 70" vs 70in) or, worse, matched directional
-- variants (Left/Right, Front/Rear/Upper/Lower) onto the same QBO entry.
-- Cross-referencing the physical inventory count sheet surfaced both
-- problems. This migration:
--   1. Fixes 3 genuine mis-links where a part got attached to its
--      mirror-image sibling's QuickBooks item instead of its own.
--   2. Merges 14 "new" QBO-###### placeholder rows into the real-PN rows
--      that already existed for the same physical part, then removes the
--      placeholder duplicates.
--   3. Renames 3 more QBO-###### placeholders in place, where no
--      pre-existing real-PN row existed at all to merge into.
-- 128-000803..806 (external joint carbon arms) and 126-000286 were
-- already handled live in a prior conversation turn; not repeated here.

update parts set qbo_item_id = '675', qbo_item_name = 'Drones:Drone Parts:Ceres Right Main Beam of Stand', price = 30.00, cost = 15.00 where sku = '201-002483';
update parts set qbo_item_id = '673', qbo_item_name = 'Drones:Drone Parts:Ceres Landing Gear Rear Lower Crossbeam', price = 55.00, cost = 27.50 where sku = '201-002831';
update parts set qbo_item_id = '676', qbo_item_name = 'Drones:Drone Parts:Ceres Landing Gear Front Crossbeam', price = 55.00, cost = 27.50 where sku = '201-003182';

update parts set qbo_item_id = '1010000616', qbo_item_name = 'Drone Parts:Flow Meter', is_active = true where sku = '203-000689';
update parts set qbo_item_id = '668', qbo_item_name = 'Drone Parts:Ceres Joint Lock Assembly Red', price = 70.00, cost = 44.10, is_active = true where sku = '201-002953';
update parts set qbo_item_id = '670', qbo_item_name = 'Drone Parts:Ceres Motor Adapter Plate B24', price = 75.00, cost = 37.50, is_active = true where sku = '201-003189';
update parts set qbo_item_id = '671', qbo_item_name = 'Drone Parts:Ceres Motor Adapter Plate B68', price = 150.00, cost = 75.00, is_active = true where sku = '201-003191';
update parts set qbo_item_id = '674', qbo_item_name = 'Drones:Drone Parts:Ceres Landing Gear Bent Tube', price = 195.00, cost = 97.50, is_active = true where sku = '128-001156';
update parts set qbo_item_id = '682', qbo_item_name = 'Drone Parts:Ceres 62" Propeller Blade CCW 6225', price = 350.00, cost = 113.75, is_active = true where sku = '201-002790';
update parts set qbo_item_id = '683', qbo_item_name = 'Drone Parts:Ceres 62" Propeller Blade CW 6225', price = 350.00, cost = 113.75, is_active = true where sku = '201-002789';
update parts set qbo_item_id = '686', qbo_item_name = 'Drone Parts:Ceres Air 70" Propeller CW Set', price = 350.00, cost = 152.50, is_active = true where sku = '201-002772';
update parts set qbo_item_id = '687', qbo_item_name = 'Drone Parts:Ceres Air 70" Propeller CCW Set', price = 350.00, cost = 152.50, is_active = true where sku = '201-002771';
update parts set qbo_item_id = '689', qbo_item_name = 'Drone Parts:Ceres CCW Power Motor', price = 775.00, cost = 387.50, is_active = true where sku = '203-001747';
update parts set qbo_item_id = '690', qbo_item_name = 'Drone Parts:Ceres CW Power Motor', price = 775.00, cost = 387.50, is_active = true where sku = '203-001748';
update parts set qbo_item_id = '694', qbo_item_name = 'Drone Parts:Ceres Propeller Clamp Washer Assembly', price = 12.50, cost = 6.25, is_active = true where sku = '754-000062';
update parts set qbo_item_id = '691', qbo_item_name = 'Drone Parts:Ceres Rotating Radar Assembly', price = 1300.00, cost = 650.00, is_active = true where sku = '754-000064';
update parts set qbo_item_id = '723', qbo_item_name = 'Drones:Drone Parts:Ceres HC403B Avionics Module V3.1', price = 2900.00, cost = 1450.00, is_active = true where sku = '755-000041';

delete from parts where sku in ('QBO-675','QBO-673','QBO-676','QBO-1010000616','QBO-668','QBO-670','QBO-671','QBO-674','QBO-682','QBO-683','QBO-686','QBO-687','QBO-689','QBO-690','QBO-694','QBO-691','QBO-723');

update parts set sku = '957-000093' where sku = 'QBO-632';
update parts set sku = '957-000540' where sku = 'QBO-685';
update parts set sku = '201-003102' where sku = 'QBO-784';
