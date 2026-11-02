-- Second-round reconciliation of QBO-placeholder SKUs against Raptor
-- Dynamic's real catalog (researched externally, applied here). Of 78
-- placeholders, 33 resolved (29 merged/corrected into an existing real-PN
-- row, 1 removed as a pure duplicate, 3 renamed directly), 23 flagged for
-- manual review (price conflicts or ambiguous duplicate QuickBooks
-- listings), 3 marked as Red Solutions' own product line (no Raptor PN
-- exists by design), and the remainder left untouched (genuinely not
-- found). Several of these merges also fixed directional mis-links from
-- the original catalog-revamp fuzzy matching (e.g. motor kits No.1/2/4
-- had all been wrongly sharing No.3's QuickBooks link).
alter table public.parts
  add column if not exists pn_needs_review boolean not null default false,
  add column if not exists pn_review_note text;

-- Clean merges: name and price both confirm identity, no conflict.
update parts set qbo_item_id='352', qbo_item_name='Drones:Drone Parts:HD580External joint carbon arm-No.1', is_active=true where sku='758-000154';
update parts set qbo_item_id='353', qbo_item_name='Drones:Drone Parts:HD580External joint carbon arm-No.2', is_active=true where sku='758-000155';
update parts set qbo_item_id='354', qbo_item_name='Drones:Drone Parts:HD580External joint carbon arm-No.3', is_active=true where sku='758-000156';
update parts set qbo_item_id='662', qbo_item_name='Drones:Drone Parts:HD580 Landing Gear Bent Tube', is_active=true where sku='128-000758';
update parts set qbo_item_id='678', qbo_item_name='Drone Parts:Ceres Gasket for Propeller Motor', is_active=true where sku='201-003194';
update parts set qbo_item_id='679', qbo_item_name='Drone Parts:Ceres Upper Weighing Scale Assembly', is_active=true where sku='755-000050';
update parts set qbo_item_id='681', qbo_item_name='Drone Parts:Ceres M4*55 Hexagon Screw', is_active=true where sku='126-001074';
update parts set qbo_item_id='684', qbo_item_name='Drone Parts:Ceres C31 31 gal Spray System', is_active=true where sku='755-000055';
update parts set qbo_item_id='692', qbo_item_name='Drone Parts:Ceres HS410 FPV Camera Assembly', is_active=true where sku='754-000017';
update parts set qbo_item_id='693', qbo_item_name='Drone Parts:Ceres Main Propeller Hub Clamp Washer Assembly', is_active=true where sku='754-000063';
update parts set qbo_item_id='705', qbo_item_name='Drones:Drone Parts:Ceres Rotary Radar Support Bracket Nylon Carbon Fiber', is_active=true where sku='201-002778';
update parts set qbo_item_id='725', qbo_item_name='Drones:Drone Parts:Ceres Silicone Rubber Pressing Strip for Motor Three - Phase Wires', is_active=true where sku='201-002792';
update parts set qbo_item_id='767', qbo_item_name='Drones:Drone Parts:Rear Arm Water Pipe - HD580 2026', is_active=true where sku='201-003223';
update parts set qbo_item_id='793', qbo_item_name='Drones:Drone Parts:Upper Nose Cover - Yellow', is_active=true where sku='201-003607';

-- Merges with a price conflict, or correcting a mis-link from the earlier revamp - flagged for manual review.
update parts set qbo_item_id='355', qbo_item_name='Drones:Drone Parts:HD580External joint carbon arm-No.4', is_active=true,
  pn_needs_review=true, pn_review_note='QBO item 355 is priced $162.50 vs this part''s existing $220.00 - same arm as 1-3 should probably match that price; confirm with Raptor.'
where sku='758-000157';
update parts set qbo_item_id='667', qbo_item_name='Drone Parts:Ceres Drone Outer Arm Assembly', is_active=true,
  pn_needs_review=true, pn_review_note='QuickBooks lists this at $400.00; this part''s existing price is $600.00. Confirm which is current.'
where sku='755-000031';
update parts set qbo_item_id='669', qbo_item_name='Drone Parts:Ceres Motor Adapter Plate Locking Bolt', is_active=true,
  pn_needs_review=true, pn_review_note='QuickBooks lists this at $30.00; this part''s existing price is $15.00. Confirm which is current.'
where sku='201-002815';
update parts set qbo_item_id='721', qbo_item_name='Drones:Drone Parts:126-000286', is_active=true,
  pn_needs_review=true, pn_review_note='QuickBooks lists this as bare PN 126-000286 at $0.63; this part''s existing price is $1.25. Likely the same screw at two different recorded prices - confirm current price.'
where sku='126-000286';
update parts set qbo_item_id='787', qbo_item_name='Drones:Drone Parts:Ceres M5*D4*L8 Pin Screw', is_active=true,
  pn_needs_review=true, pn_review_note='QuickBooks lists this at $1.25; this part''s existing price is $2.50. Confirm which is current.'
where sku='126-000808';
update parts set qbo_item_id='875', qbo_item_name='Drones:Drone Parts:HD580 Rubber Pad (below Power Distribution Board)', is_active=true,
  pn_needs_review=true, pn_review_note='QuickBooks has no price set for this item; kept this part''s existing $2.50 price.'
where sku='201-001931';
update parts set qbo_item_id='699', qbo_item_name='Drones:Drone Parts:HD580 Tail Upper Cover Plate Orange', price=20.00, cost=13.00,
  pn_needs_review=true, pn_review_note='Was mis-linked to the plain "Tail Upper Cover Orange" QBO item (no "Plate"); relinked to the correct "Cover Plate Orange" entry and updated price from $50 to $20.'
where sku='201-001843';
update parts set qbo_item_id='262', qbo_item_name='Drones:Drone Parts:HD580-No.1 motor kit',
  pn_needs_review=true, pn_review_note='Was wrongly sharing the "No.3 motor kit" QuickBooks link with the No.2 and No.4 kits; relinked to its own No.1 entry.'
where sku='957-000195';
update parts set qbo_item_id='261', qbo_item_name='Drones:Drone Parts:HD580- No.2 motor kit',
  pn_needs_review=true, pn_review_note='Was wrongly sharing the "No.3 motor kit" QuickBooks link with the No.1 and No.4 kits; relinked to its own No.2 entry.'
where sku='957-000196';
update parts set qbo_item_id='260', qbo_item_name='Drones:Drone Parts:HD580-No.4 motor kit',
  pn_needs_review=true, pn_review_note='Was wrongly sharing the "No.3 motor kit" QuickBooks link with the No.1 and No.2 kits; relinked to its own No.4 entry.'
where sku='957-000198';
update parts set qbo_item_id='552', qbo_item_name='Drones:Drone Parts:HD580 CW propeller 62 inches',
  pn_needs_review=true, pn_review_note='Was wrongly sharing a QuickBooks link with the reverse-propeller part (201-002368); relinked to its own entry.'
where sku='201-002367';
update parts set qbo_item_id='636', qbo_item_name='Drones:Drone Parts:Vector AGR - C31/ HD580 - Smart Battery - 18S - 38,000 mAh', is_active=true,
  pn_needs_review=true, pn_review_note='Raptor research treats this as a close match (branding differs: "Ceres HE102" vs "Vector AGR Smart Battery"); confirm same battery.'
where sku='754-000087';
update parts set qbo_item_id='258', qbo_item_name='Drones:Drone Parts:HD580 Spreader', is_active=true,
  pn_needs_review=true, pn_review_note='Raptor research calls this a close match (name differs slightly) but price matches exactly at $2499.'
where sku='957-000247';
update parts set qbo_item_id='637', qbo_item_name='Drones:Drone Parts:Vector AGR - C31/ HD580 - Battery Charger - 12kw', is_active=true,
  pn_needs_review=true, pn_review_note='Raptor research also suggested QBO-253 ("HD580 - Battery Charger", also $1999) for this same PN. Picked this one since its own name explicitly says "12kw" matching this part''s name. QBO-253 left unresolved - may be a duplicate QuickBooks listing of the same charger.'
where sku='957-000504';
update parts set qbo_item_id='864', qbo_item_name='Drones:Drone Parts:Ceres Air - 31 Gal Tank', price=225.00, cost=141.75, is_active=true,
  pn_needs_review=true, pn_review_note='Raptor research flagged uncertainty: this part''s $225 price actually matches the 40-gal tank (201-002836) better than a 31-gal tank. Confirm this is really the 31-gal tank before relying on it.'
where sku='201-003196';

-- Direct renames: real PN had no existing shop record at all.
update parts set sku = '754-000054' where sku = 'QBO-644';
update parts set sku = 'applicator-view' where sku = 'QBO-645';

-- c31-18S8500W: merge, exact price match.
update parts set qbo_item_id='643', qbo_item_name='Drones:Drone Parts:Ceres Air - 9KW Battery Charger - 18S8500W', is_active=true where sku='c31-18S8500W';

-- Remove the now-redundant QBO- placeholder rows these merges replaced, and the pure duplicate.
delete from parts where sku in ('QBO-352','QBO-353','QBO-354','QBO-355','QBO-662','QBO-667','QBO-669','QBO-678','QBO-679','QBO-681','QBO-684','QBO-692','QBO-693','QBO-699','QBO-705','QBO-721','QBO-725','QBO-767','QBO-787','QBO-793','QBO-875','QBO-258','QBO-260','QBO-261','QBO-262','QBO-552','QBO-636','QBO-637','QBO-864','QBO-643','QBO-695');

-- Flag the ones left unresolved on purpose, with notes explaining why.
update parts set pn_needs_review=true, pn_review_note='Raptor research suggests PN 758-000159, but that part already carries a different, correctly-matched QuickBooks link at a lower price ($50 vs this item''s $150). Likely a duplicate QuickBooks listing of the same clamp under a different brand name ("Vector AGR" vs generic) - needs manual reconciliation, not auto-merged.' where sku='QBO-651';
update parts set pn_needs_review=true, pn_review_note='Raptor research suggests PN 758-000158, but that part already carries a different, correctly-matched QuickBooks link at a lower price ($50 vs this item''s $150). Likely a duplicate QuickBooks listing of the same clamp under a different brand name ("Vector AGR" vs generic) - needs manual reconciliation, not auto-merged.' where sku='QBO-652';
update parts set pn_needs_review=true, pn_review_note='Raptor research suggests PN 957-000193, but that part already carries a different, correctly-matched QuickBooks link at a wildly different price ($0.50 vs this item''s $122.50). Not auto-merged - needs a human to figure out which price is real.' where sku='QBO-696';
update parts set pn_needs_review=true, pn_review_note='Raptor research suggests PN 129-000426, but that part already carries a different, correctly-matched QuickBooks link ("Ceres Image Transmission Antenna", id 749) at the same $22.50 price. This item is QuickBooks id 750, "...( 750 )" - likely a duplicate QuickBooks listing of the same antenna. Not auto-merged.' where sku='QBO-750';
update parts set pn_needs_review=true, pn_review_note='Raptor research suggests PN 957-000504 for this charger, but that PN was assigned to QBO-637 instead (its name explicitly says "12kw", a closer match). This item may be a duplicate QuickBooks listing of the same 12KW charger - needs manual reconciliation.' where sku='QBO-253';
update parts set pn_needs_review=true, pn_review_note='Raptor research suggests PN 754-000116 ("Battery Locking Assembly"), but that part is already active with a different QuickBooks link at $88.75 vs this item''s $62.50 - likely a genuine duplicate QuickBooks listing (same part filed twice at two prices), not something to auto-merge. An alternate candidate, 754-000069 ("Battery Bracket Roller Version Assembly"), matches this item''s $62.50 price but is a physically different part (a bracket, not a locking assembly) - do not use it.' where sku='QBO-672';
update parts set pn_needs_review=true, pn_review_note='Raptor research suggests PN 754-000062, but that PN is already correctly used for a different physical part ("Propeller Clamp Washer Assembly") - this item is a "Gasket", not a "Washer". No real match found; needs a person to check Raptor''s site directly.' where sku='QBO-677';
update parts set pn_needs_review=true, pn_review_note='Raptor research marked this as a probable duplicate of QBO-793 (now merged into PN 201-003607). Not auto-merged since that PN is taken; if confirmed as the same part, delete this row and keep 201-003607.' where sku='QBO-876';

-- Mark the 3 Red Solutions-branded accessories as intentionally not Raptor parts.
update parts set pn_review_note='Red Solutions'' own branded accessory - no Raptor Dynamic part number exists for this by design, not a failed lookup.' where sku in ('QBO-656','QBO-657','QBO-658');

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
  qbo_qty_synced_at,
  pn_needs_review,
  pn_review_note
from parts p
where is_staff() and is_active;
