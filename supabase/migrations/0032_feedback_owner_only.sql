-- Reports should go to Jackson only -- any staff member can still submit
-- one, but only the owner can read the list back (not sales, not techs).

drop policy "staff can view feedback" on public.feedback;
drop policy "managers can resolve feedback" on public.feedback;

create policy "owner can view feedback" on public.feedback
  for select using (is_owner());

create policy "owner can resolve feedback" on public.feedback
  for update using (is_owner()) with check (is_owner());
