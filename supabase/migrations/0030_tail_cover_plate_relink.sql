-- Three parts were linked to the wrong QuickBooks item during earlier
-- reconciliation passes -- QBO has distinct "cover" vs "cover plate" items
-- (different price points), and these were pointed at the wrong one.
-- Prices are left untouched; only the QBO link is corrected.

update parts set qbo_item_name = 'Drone Parts:HD580 Tail Upper Cover Plate Orange', qbo_item_id = '699'
 where sku = '201-002935'; -- was linked to "HD580 Tail Upper Cover Orange" (877, the plain cover)

update parts set qbo_item_name = 'Drones:Drone Parts:Upper Tail Cover Plate - Yellow', qbo_item_id = '794'
 where sku = '201-003608'; -- was linked to "Upper Tail Cover-yellow-w/cover plate" (836, the combo kit)

update parts set qbo_item_name = 'Drones:Drone Parts:Upper Tail Cover - Yellow', qbo_item_id = '795'
 where sku = '201-003609'; -- was linked to "Upper Tail Cover-yellow-w/cover plate" (836, the combo kit)
