-- Security hardening: by default Postgres grants EXECUTE on every new
-- function to PUBLIC (which includes the anon role). We only ever meant
-- these RPCs to be reachable by signed-in users, and a couple of trigger
-- functions (guard_parts_cost, handle_new_auth_user) were never meant to
-- be called directly by anyone. This revokes the default PUBLIC/anon
-- grants and re-grants only what each role actually needs.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on function
  public.is_owner, public.is_tech, public.is_staff, public.is_dealer,
  public.current_dealer_id
to authenticated;

grant execute on function
  public.next_ticket_id, public.next_invoice_id, public.next_order_id
to authenticated;

grant execute on function
  public.pull_part, public.pull_bundle, public.return_part_line,
  public.create_invoice_from_ticket
to authenticated;

grant execute on function
  public.submit_dealer_order, public.approve_dealer_order,
  public.reject_dealer_order, public.invoice_dealer_order
to authenticated;

-- These two are internal triggers only (cost-guard on parts, new-auth-user
-- bootstrap) and should never be callable directly via PostgREST.
revoke execute on function public.guard_parts_cost() from authenticated;
revoke execute on function public.handle_new_auth_user() from authenticated;
