-- Reported via Report a problem (feedback #4): "ESC Wire Harness Holder"
-- (201-003217) wasn't showing up in Inventory. It already existed in the
-- parts table but with is_active = false, the wrong category ("Arm"
-- instead of "ESC"), and qty_on_hand = 0 instead of the real on-hand
-- count of 14 -- parts_view filters on is_active, so it was invisible.
-- Price (2.50) was already correct. No matching QuickBooks catalog item
-- exists yet for this part -- flagged for review until one is created
-- and linked.
update parts
set is_active = true,
    category = 'ESC',
    qty_on_hand = 14,
    pn_needs_review = true,
    pn_review_note = 'Reported via Report a problem: was inactive/miscategorized so it was missing from Inventory. No matching QuickBooks catalog item found yet -- needs one created/linked.',
    updated_at = now()
where sku = '201-003217';
