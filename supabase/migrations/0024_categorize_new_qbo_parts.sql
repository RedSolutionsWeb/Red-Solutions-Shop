-- The 102 parts added straight from QuickBooks in the catalog revamp had
-- no category/fits set, which made them invisible under any aircraft
-- filter (including batteries, chargers, and motor kits people actually
-- want to find that way). Backfill from the part name.
update public.parts set category = v.category, fits = v.fits from (values
  ('QBO-657', 'Accessories', ARRAY['All']), ('QBO-658', 'Accessories', ARRAY['All']), ('QBO-656', 'Hardware', ARRAY['All']),
  ('QBO-1010000635', 'Accessories', ARRAY['All']), ('QBO-1010000623', 'Other', ARRAY['All']), ('QBO-1010000642', 'Avionics', ARRAY['All']),
  ('QBO-1010000641', 'Outer Cover', ARRAY['All']), ('QBO-1010000653', 'Nozzle', ARRAY['All']), ('QBO-682', 'Motor/Prop', ARRAY['C31']),
  ('QBO-683', 'Motor/Prop', ARRAY['C31']), ('QBO-685', 'Spray System', ARRAY['C31']), ('QBO-687', 'Motor/Prop', ARRAY['C31']),
  ('QBO-686', 'Motor/Prop', ARRAY['C31']), ('QBO-672', 'Battery/Charger', ARRAY['C31']), ('QBO-684', 'Spray System', ARRAY['C31']),
  ('QBO-689', 'Motor/Prop', ARRAY['C31']), ('QBO-690', 'Motor/Prop', ARRAY['C31']), ('QBO-667', 'Arm', ARRAY['C31']),
  ('QBO-677', 'Motor/Prop', ARRAY['C31']), ('QBO-678', 'Motor/Prop', ARRAY['C31']), ('QBO-692', 'Avionics', ARRAY['C31']),
  ('QBO-668', 'Other', ARRAY['C31']), ('QBO-674', 'Landing Gear', ARRAY['C31']), ('QBO-676', 'Landing Gear', ARRAY['C31']),
  ('QBO-673', 'Landing Gear', ARRAY['C31']), ('QBO-680', 'Other', ARRAY['C31']), ('QBO-681', 'Hardware', ARRAY['C31']),
  ('QBO-693', 'Motor/Prop', ARRAY['C31']), ('QBO-670', 'Motor/Prop', ARRAY['C31']), ('QBO-671', 'Motor/Prop', ARRAY['C31']),
  ('QBO-669', 'Motor/Prop', ARRAY['C31']), ('QBO-694', 'Motor/Prop', ARRAY['C31']), ('QBO-675', 'Airframe', ARRAY['C31']),
  ('QBO-691', 'Avionics', ARRAY['C31']), ('QBO-679', 'Other', ARRAY['C31']), ('QBO-696', 'Spray System', ARRAY['All']),
  ('QBO-1010000661', 'Accessories', ARRAY['All']), ('QBO-1010000616', 'Other', ARRAY['All']), ('QBO-1010000608', 'Avionics', ARRAY['All']),
  ('QBO-662', 'Landing Gear', ARRAY['HD580']), ('QBO-699', 'Outer Cover', ARRAY['HD580']), ('QBO-695', 'Motor/Prop', ARRAY['HD580']),
  ('QBO-1010000652', 'Nozzle', ARRAY['All']), ('QBO-1010000651', 'Outer Cover', ARRAY['All']), ('QBO-1010000643', 'Landing Gear', ARRAY['All']),
  ('QBO-1010000615', 'Landing Gear', ARRAY['All']), ('QBO-1010000566', 'Outer Cover', ARRAY['All']), ('QBO-1010000655', 'Spray System', ARRAY['All']),
  ('QBO-1010000634', 'Spray System', ARRAY['All']), ('QBO-1010000607', 'Spray System', ARRAY['All']), ('QBO-1010000654', 'Spray System', ARRAY['All']),
  ('QBO-1010000644', 'Other', ARRAY['All']), ('QBO-1010000589', 'Outer Cover', ARRAY['All']), ('QBO-1010000523', 'Other', ARRAY['All']),
  ('QBO-721', 'Other', ARRAY['All']), ('QBO-575', 'Nozzle', ARRAY['All']), ('QBO-1010000112', 'Nozzle', ARRAY['All']),
  ('QBO-864', 'Spray System', ARRAY['C31']), ('QBO-643', 'Battery/Charger', ARRAY['C31']), ('QBO-645', 'Other', ARRAY['C31']),
  ('QBO-634', 'Spray System', ARRAY['C31']), ('QBO-635', 'Spray System', ARRAY['C31']), ('QBO-633', 'Other', ARRAY['C31']),
  ('QBO-632', 'Battery/Charger', ARRAY['C31']), ('QBO-648', 'Avionics', ARRAY['C31']), ('QBO-723', 'Avionics', ARRAY['C31']),
  ('QBO-787', 'Hardware', ARRAY['C31']), ('QBO-784', 'Arm', ARRAY['C31']), ('QBO-705', 'Avionics', ARRAY['C31']),
  ('QBO-725', 'Motor/Prop', ARRAY['C31']), ('QBO-593', 'Spray System', ARRAY['All']), ('QBO-254', 'Battery/Charger', ARRAY['HD580']),
  ('QBO-644', 'Battery/Charger', ARRAY['HD580']), ('QBO-253', 'Battery/Charger', ARRAY['HD580']), ('QBO-874', 'Avionics', ARRAY['HD580']),
  ('QBO-552', 'Motor/Prop', ARRAY['HD580']), ('QBO-865', 'Arm', ARRAY['HD580']), ('QBO-866', 'Arm', ARRAY['HD580']),
  ('QBO-867', 'Arm', ARRAY['HD580']), ('QBO-868', 'Arm', ARRAY['HD580']), ('QBO-876', 'Outer Cover', ARRAY['HD580']),
  ('QBO-869', 'Motor/Prop', ARRAY['HD580']), ('QBO-875', 'Power Dist', ARRAY['HD580']), ('QBO-258', 'Other', ARRAY['HD580']),
  ('QBO-261', 'Motor/Prop', ARRAY['HD580']), ('QBO-262', 'Motor/Prop', ARRAY['HD580']), ('QBO-260', 'Motor/Prop', ARRAY['HD580']),
  ('QBO-352', 'Arm', ARRAY['HD580']), ('QBO-353', 'Arm', ARRAY['HD580']), ('QBO-354', 'Arm', ARRAY['HD580']),
  ('QBO-355', 'Arm', ARRAY['HD580']), ('QBO-592', 'Power Dist', ARRAY['All']), ('QBO-1010000141', 'Avionics', ARRAY['All']),
  ('QBO-767', 'Arm', ARRAY['HD580']), ('QBO-793', 'Outer Cover', ARRAY['All']), ('QBO-795', 'Outer Cover', ARRAY['All']),
  ('QBO-794', 'Outer Cover', ARRAY['All']), ('QBO-637', 'Battery/Charger', ARRAY['C31','HD580']), ('QBO-636', 'Battery/Charger', ARRAY['C31','HD580']),
  ('QBO-652', 'Motor/Prop', ARRAY['HD580']), ('QBO-651', 'Motor/Prop', ARRAY['HD580']), ('QBO-750', 'Avionics', ARRAY['C31'])
) as v(sku, category, fits)
where parts.sku = v.sku;
