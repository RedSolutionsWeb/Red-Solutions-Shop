-- The one part number from the Nov 2026 inventory count (HD580-ARM
-- sheet) that had no existing match in the shop catalog -- added now at
-- $0 pending real pricing, category/fits matching the other
-- "Centrifugal Nozzle" HD580 parts already in the system.
insert into parts (sku, name, category, fits, qty_on_hand, cost, price)
values ('201-002569', 'Centrifugal Nozzle Gasket', 'Nozzle', array['HD580'], 108, 0, 0);
