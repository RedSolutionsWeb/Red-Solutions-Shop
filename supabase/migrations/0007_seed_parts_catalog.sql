-- Seed the parts catalog. The hardcoded shop rows below (complete
-- aircraft + shop supplies) are reconstructed from this conversation's
-- history. The bulk catalog — 858 real SKUs from parts-catalog.json — is
-- NOT included here: that file only ever existed in the container that
-- was reclaimed, and was never echoed into this conversation in full (only
-- transformed via a script). See the project README for how to restore it.
--
-- Additive only — ON CONFLICT DO NOTHING, so a re-run never overwrites a
-- shop-edited row (matches the prototype's "Load Red Solutions catalog"
-- merge behavior).

insert into public.parts (sku, name, category, fits, price) values
  ('D-HD580', 'Vector HD580 — complete aircraft', 'Airframe', ARRAY['HD580']::text[], 0),
  ('D-C31', 'Ceres Air C31 — complete aircraft', 'Airframe', ARRAY['C31']::text[], 0),
  ('S-SHOP', 'Shop supplies', 'Service', ARRAY['All']::text[], 15)
on conflict (sku) do nothing;
