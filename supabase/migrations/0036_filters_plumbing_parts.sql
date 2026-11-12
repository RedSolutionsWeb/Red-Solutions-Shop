-- New Filters and Plumbing parts from the November 2026 inventory sheet
-- (Black Betty / genset-powered C31 spray platform). None of these 63
-- SKUs existed in the catalog before (checked by both SKU and name).
--
-- Pricing: the source sheet had no Price/Cost data at all -- imported at
-- $0 pending real pricing.
--
-- A handful of rows needed a placeholder SKU (FILT-### / PLUMB-###),
-- flagged with pn_needs_review + a note explaining why:
--   - No part number given in the sheet at all.
--   - The sheet reused the same PN for multiple different parts
--     (RP30REG-DB for 4 different items, M220CPE45 for 2) -- the first
--     occurrence of each kept its real PN; the rest got placeholders.
insert into parts (sku, name, category, fits, qty_on_hand, cost, price, pn_needs_review, pn_review_note)
values
  ('A4K1ZD-14102', 'AIR FILTER', 'Filters', array['C31'], 8, 0, 0, false, null),
  ('C490BD-32100', 'OIL FILTER', 'Filters', array['C31'], 7, 0, 0, false, null),
  ('4K41ZD-24100', 'FUEL FILTER', 'Filters', array['C31'], 2, 0, 0, false, null),
  ('C490BD-24100', 'FUEL FILTER', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('GATD 7.5', 'AIR FILTER - GATD 7.5', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('115.90.135', 'OIL SEPARATOR - GATD 7.5', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('170125160', 'OIL SEPERATOR - GATD 15', 'Filters', array['C31'], 6, 0, 0, false, null),
  ('WD950.1-12UNF', 'OIL FILTER - GATD 15', 'Filters', array['C31'], 4, 0, 0, false, null),
  ('GATD-15', 'AIR FILTER - GATD 15', 'Filters', array['C31'], 6, 0, 0, false, null),
  ('A4K412D-14102', 'AIR FILTER', 'Filters', array['C31'], 3, 0, 0, false, null),
  ('F-1408000037', 'AIR FILTER', 'Filters', array['C31'], 2, 0, 0, false, null),
  ('CCEC-HJ11', 'CUMMINS GENSET MOD. KTAA19-G6A', 'Filters', array['C31'], 1, 0, 0, false, null),
  ('30010-Z050110-00AP', 'SPARK PLUG - F7RTC', 'Filters', array['C31'], 10, 0, 0, false, null),
  ('16100-Z1X0910-00AO', 'CARBURETOR', 'Filters', array['C31'], 2, 0, 0, false, null),
  ('15100-28K0110-00AO', 'PUMP', 'Filters', array['C31'], 1, 0, 0, false, null),
  ('JY2604140003', 'GENERATOR PANEL', 'Filters', array['C31'], 1, 0, 0, false, null),
  ('RP30REG-DB', 'OIL PRESSURE ALARM', 'Filters', array['C31'], 1, 0, 0, false, null),
  ('FILT-001', 'EMERGENCY STOP SWITCH', 'Filters', array['C31'], 1, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('FILT-002', 'WATER TEMP SENSOR', 'Filters', array['C31'], 1, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('16510-28 K0110-0000', 'INLINE FUEL FILTER', 'Filters', array['C31'], 4, 0, 0, false, null),
  ('FILT-003', 'TEMP SENSOR', 'Filters', array['C31'], 6, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('DCMI-250/2300', '125 AMP BREAKER', 'Filters', array['C31'], 1, 0, 0, false, null),
  ('LF479Q1-1017100A', 'ENGINE OIL FILTER', 'Filters', array['C31'], 2, 0, 0, false, null),
  ('FILT-004', 'AIR FILTER', 'Filters', array['C31'], 2, 0, 0, true, 'Inventory sheet reused PN "RP30REG-DB" for multiple different parts (this is one of 4); placeholder SKU assigned pending the real PN.'),
  ('SGMW8450087', 'FUEL FILTER ELEMENT', 'Filters', array['C31'], 2, 0, 0, false, null),
  ('15220-Z120210-00AO', 'OIL FILTER', 'Filters', array['C31'], 3, 0, 0, false, null),
  ('FILT-005', 'IGNITION COIL', 'Filters', array['C31'], 1, 0, 0, true, 'Inventory sheet reused PN "RP30REG-DB" for multiple different parts (this is one of 4); placeholder SKU assigned pending the real PN.'),
  ('37050-Z1X0310-0000', 'SENSOR', 'Filters', array['C31'], 1, 0, 0, false, null),
  ('15211-Z1X0210-00AO', 'SCREENS', 'Filters', array['C31'], 6, 0, 0, false, null),
  ('16300-Z120112-0000', 'FUEL PUMP', 'Filters', array['C31'], 3, 0, 0, false, null),
  ('30400-Z1X0310-0000', 'COILS', 'Filters', array['C31'], 4, 0, 0, false, null),
  ('30400-Z1X0410-0000', 'COILS', 'Filters', array['C31'], 4, 0, 0, false, null),
  ('16750-Y200210-00AO', 'FUEL SHUTOFF', 'Filters', array['C31'], 4, 0, 0, false, null),
  ('FILT-006', 'GAS SELENOID VALVE', 'Filters', array['C31'], 2, 0, 0, true, 'Inventory sheet reused PN "RP30REG-DB" for multiple different parts (this is one of 4); placeholder SKU assigned pending the real PN.'),
  ('SB5205', 'OIL SEPARATOR - GATD 15', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('W950', 'OIL FILTER', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('SMJF113', 'OIL SEPERATOR - GATD 10', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('C1250', 'AIR FILTER - GATD 15', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('W719/5', 'OIL FILTER', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('C1140', 'AIR FILTER - GATD 10', 'Filters', array['C31'], 5, 0, 0, false, null),
  ('P-015', 'P - GATD 10', 'Filters', array['C31'], 2, 0, 0, false, null),
  ('FILT-007', 'Q - GATD 10', 'Filters', array['C31'], 2, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('FILT-008', 'S - GATD 10', 'Filters', array['C31'], 1, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('FILT-009', 'C - GATD 15', 'Filters', array['C31'], 2, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('FILT-010', 'T - GATD 15', 'Filters', array['C31'], 2, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('FILT-011', 'A - GATD 15', 'Filters', array['C31'], 1, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('17" (43X6X43) 2PC', 'BLACK PAD BASE W/ RED PAD', 'Filters', array['C31'], 3, 0, 0, false, null),
  ('PLUMB-001', '2 to 1 Bell Reducer', 'Plumbing', array['C31'], 13, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('200Cap', '2" Camloch Cap', 'Plumbing', array['C31'], 1, 0, 0, false, null),
  ('TF200', '2" tank bungs', 'Plumbing', array['C31'], 3, 0, 0, false, null),
  ('MVS220CF', '2" Flange to Flange Valve', 'Plumbing', array['C31'], 2, 0, 0, false, null),
  ('MVSMT220', '2" Flange to threaded valve', 'Plumbing', array['C31'], 2, 0, 0, false, null),
  ('M220PG90', '2" Flange 90s', 'Plumbing', array['C31'], 14, 0, 0, false, null),
  ('PLUMB-002', '2" Double Barb 90s', 'Plumbing', array['C31'], 8, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('PLUMB-003', '2" Doube Flange 90s', 'Plumbing', array['C31'], 6, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('M220CPE45', '2" Double Flange 45s', 'Plumbing', array['C31'], 7, 0, 0, false, null),
  ('M220CPG6', '6" Flange Extender', 'Plumbing', array['C31'], 3, 0, 0, false, null),
  ('PLUMB-004', '3" Flange Extender', 'Plumbing', array['C31'], 2, 0, 0, true, 'Inventory sheet reused PN "M220CPE45" for multiple different parts (this is one of 2); placeholder SKU assigned pending the real PN.'),
  ('M220BRB', 'Flange to Hose Barb', 'Plumbing', array['C31'], 2, 0, 0, false, null),
  ('HB200', 'Hose barb to thread 2"', 'Plumbing', array['C31'], 2, 0, 0, false, null),
  ('M200MPT', 'M200MPT', 'Plumbing', array['C31'], 7, 0, 0, false, null),
  ('PLUMB-005', '2" to 1.5" threaded', 'Plumbing', array['C31'], 5, 0, 0, true, 'No part number given in Nov 2026 inventory sheet; placeholder SKU assigned.'),
  ('M220FPT', 'M220FPT', 'Plumbing', array['C31'], 4, 0, 0, false, null);
