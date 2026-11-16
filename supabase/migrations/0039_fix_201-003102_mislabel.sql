-- Reported via Parts Sale (feedback #3): SKU 201-003102 was mislabeled
-- as "Ceres Rear Arm Inner & Outer Assembly" ($80) -- that's a real,
-- correctly QBO-linked item (id 784), just sitting under the wrong SKU.
-- The physical part actually labeled 201-003102 is "End Cable Clip
-- Cover" ($2.50, qty 8). No existing invoice/order/bundle/count line
-- referenced 201-003102, so the rename is safe.
update parts set sku = 'QBO-784' where sku = '201-003102';

insert into parts (sku, name, category, fits, price, qty_on_hand, cost, pn_needs_review, pn_review_note)
values (
  '201-003102', 'End Cable Clip Cover', 'Arm', array['C31'], 2.50, 8, 0,
  true,
  'Reported via Parts Sale: this SKU was mislabeled as "Ceres Rear Arm Inner & Outer Assembly" ($80), which has been moved to QBO-784. No matching QuickBooks catalog item found yet for "End Cable Clip Cover" -- needs one created/linked.'
);
