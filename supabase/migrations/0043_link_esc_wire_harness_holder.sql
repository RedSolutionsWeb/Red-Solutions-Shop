-- "ESC Wire Harness Holder" (201-003217) now has a real QuickBooks item
-- (id 892, created to match it) -- link it and clear the review flag
-- set in 0042.
update parts
set qbo_item_name = 'ESC Wire Harness Holder', qbo_item_id = '892',
    pn_needs_review = false, pn_review_note = null
where sku = '201-003217';
