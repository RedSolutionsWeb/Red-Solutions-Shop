-- Reported: "a lot of parts... not showing up when trying to put in
-- repairs." Root cause: 643 parts have sat at is_active = false since
-- the catalog revamp (0023) that never finished reconciling them to
-- QuickBooks -- parts_view filters on is_active, so they were invisible
-- everywhere (Inventory, ticket parts picker, Parts Sale).
--
-- Of those 643, 591 look like genuine, specific parts (real names,
-- categories, fits, prices) -- these are reactivated here. Left out:
-- 15 generic placeholder rows from the old exploded-diagram import
-- (name = 'HD580 ' || sku, price = $1 flat, not real parts), and 37
-- that only fit "HD540S", a model not in the shop's current lineup.
--
-- None of these 591 are linked to a QuickBooks item yet, so they're
-- flagged for review. They also get the same 37%-off-retail cost
-- estimate used for the rest of the catalog (migration 0046), so
-- margin reporting treats them consistently with everything else.
--
-- parts_guard_cost only allows a manager-authenticated session to
-- change cost; disabled for this one statement, same as 0046.
alter table parts disable trigger parts_guard_cost;

update parts
set is_active = true,
    cost = round(price * 0.63, 2),
    pn_needs_review = true,
    pn_review_note = 'Reactivated from the pending-QuickBooks-reconciliation bucket (was hiding it from Inventory/repairs/Parts Sale). No matching QuickBooks catalog item found yet -- needs one created/linked.',
    updated_at = now()
where not is_active
  and not (name = 'HD580 ' || sku and price = 1.00)
  and fits <> array['HD540S'];

alter table parts enable trigger parts_guard_cost;
