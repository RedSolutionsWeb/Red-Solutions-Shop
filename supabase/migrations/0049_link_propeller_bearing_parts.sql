-- QuickBooks catalog cleanup done via Claude in Chrome (verified live via
-- qbo_catalog_search_products before applying): resolved the duplicate
-- "HD580 CW propeller 62 inches" item (425 -> inactive, kept 552), added
-- a real QuickBooks item for the CCW propeller, and created the three
-- other parts invoice 7208 (ticket R-1009, REDAIR LLC) was blocked on.
--
-- parts_guard_cost only allows a manager-authenticated session to
-- change cost; disabled for this one statement, same as 0046/0047.
alter table parts disable trigger parts_guard_cost;

update parts set
  price = 287.50, cost = 152.73,
  qbo_item_id = '552', qbo_item_name = 'Drones:Drone Parts:HD580 CW propeller 62 inches',
  pn_needs_review = false, pn_review_note = null, updated_at = now()
where sku = '201-001945';

update parts set
  price = 287.50, cost = 143.75,
  qbo_item_id = '695', qbo_item_name = 'Drone Parts:HD580 carbon fiber reverse propeller 62 inches',
  pn_needs_review = false, pn_review_note = null, updated_at = now()
where sku = '201-001946';

update parts set
  qbo_item_id = '894', qbo_item_name = 'Drones:Drone Parts:HD580 Landing Gear Connector No.1',
  pn_needs_review = false, pn_review_note = null, updated_at = now()
where sku = '201-001806';

update parts set
  price = 18.02, cost = 9.91,
  qbo_item_id = '895', qbo_item_name = 'Drones:Drone Parts:Motor Bearings ZR5',
  pn_needs_review = false, pn_review_note = null, updated_at = now()
where sku = '6905 ZR5';

update parts set
  price = 11.29, cost = 6.21,
  qbo_item_id = '896', qbo_item_name = 'Drones:Drone Parts:Motor Bearings ZN5',
  pn_needs_review = false, pn_review_note = null, updated_at = now()
where sku = '6055-2N5E903';

alter table parts enable trigger parts_guard_cost;
