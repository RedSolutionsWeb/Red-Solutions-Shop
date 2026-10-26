-- Techs can add/edit inventory items (name, category, on-hand, retail
-- price) but must never be able to set cost — not just hidden in the UI,
-- but rejected at the database layer even if a tech's session calls the
-- API directly. Silently clamps rather than erroring, since the Add-item
-- and part-drawer forms don't send a cost field at all for a tech and
-- shouldn't have to know this rule exists.
create function public.guard_parts_cost() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    if tg_op = 'INSERT' then
      new.cost := 0;
    else
      new.cost := old.cost;
    end if;
  end if;
  return new;
end;
$$;

create trigger parts_guard_cost
  before insert or update on public.parts
  for each row execute function public.guard_parts_cost();
