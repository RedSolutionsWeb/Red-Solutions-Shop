-- 0012 granted execute on clear_must_change_password() to authenticated
-- but never revoked the default PUBLIC grant Postgres adds on CREATE
-- FUNCTION, so anon could call it too (harmless in practice, since the
-- function only ever touches the caller's own row via auth.uid(), which
-- is null for an anonymous request — but tighten it anyway).
revoke execute on function public.clear_must_change_password() from public;
revoke execute on function public.clear_must_change_password() from anon;
