-- "End Cable Clip Cover" (201-003102) now has a real QuickBooks item
-- (id 891, created to match it) -- link it and clear the review flag
-- set in 0039.
update parts
set qbo_item_name = 'End Cable Clip Cover', qbo_item_id = '891',
    pn_needs_review = false, pn_review_note = null
where sku = '201-003102';
