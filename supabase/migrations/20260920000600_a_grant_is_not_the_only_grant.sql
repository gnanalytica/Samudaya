-- ============================================================================
-- Samudaya · 0920.0600 · A grant is not the only grant
-- ----------------------------------------------------------------------------
-- 0920.0400 says, in a comment beside app.record_bank_lines():
--
--   "only `authenticated` and `service_role` may execute this … `anon` has no
--    grant and cannot reach the check at all"
--
-- That is wrong, and the comment being wrong is worse than the hole it
-- describes. PostgreSQL grants EXECUTE on a new function to PUBLIC by default,
-- and every role inherits PUBLIC. Writing `grant execute … to authenticated`
-- adds a grant; it does not remove the one already there. Supabase's own
-- linter says so plainly — anon can call these — and the reasoning in that
-- comment would have talked the next reader out of believing it.
--
-- What was actually reachable, stated rather than minimised: an unauthenticated
-- caller holding a bank_accounts.id could post statement lines into a society's
-- reconciliation feed. They could not obtain one — bank_accounts is behind RLS
-- that asks app.is_staff() — and could not do anything with the lines, because
-- reconcile_bank_line() re-checks the caller and refuses. So the worst case was
-- junk in the unexplained list for staff to set aside. Small, and not the point:
-- the guard was load-bearing without anybody having decided it should be.
--
-- There are two grants to remove, not one, and finding that out is the reason
-- this file has a test rather than a comment. PUBLIC's default is the first.
-- The second is Supabase's own bootstrap, which runs
--
--   alter default privileges in schema public grant all on functions
--     to postgres, anon, authenticated, service_role;
--
-- so anon is also named explicitly on every function created in `public` after
-- that line ran. Revoking PUBLIC leaves that one standing, which is precisely
-- what the first attempt at this migration did: the app-schema function went
-- quiet and the three public ones did not. Both grants go.
--
-- Every function here is a staff or member action, so none has a reason to be
-- callable before sign-in. The join flow's functions (request_to_join,
-- preview_invite_code, society_units, redeem_invite_code) genuinely do run
-- before you have an account and are deliberately not touched.
--
-- 02_rls_test.sql now asserts this with has_function_privilege, so the next
-- function added here has a failing test to answer to rather than a comment.
-- ============================================================================

revoke execute on function
  app.record_bank_lines(uuid, jsonb, public.bank_line_source) from public, anon;
grant execute on function
  app.record_bank_lines(uuid, jsonb, public.bank_line_source)
  to authenticated, service_role;

revoke execute on function public.import_bank_lines(uuid, jsonb) from public, anon;
grant execute on function public.import_bank_lines(uuid, jsonb) to authenticated;

revoke execute on function public.bank_line_candidates(uuid) from public, anon;
grant execute on function public.bank_line_candidates(uuid) to authenticated;

revoke execute on function public.reconcile_bank_line(uuid, uuid, boolean) from public, anon;
grant execute on function public.reconcile_bank_line(uuid, uuid, boolean) to authenticated;

revoke execute on function public.unreconcile_bank_line(uuid) from public, anon;
grant execute on function public.unreconcile_bank_line(uuid) to authenticated;

revoke execute on function public.ignore_bank_line(uuid, text) from public, anon;
grant execute on function public.ignore_bank_line(uuid, text) to authenticated;

revoke execute on function public.member_history(uuid) from public, anon;
grant execute on function public.member_history(uuid) to authenticated;
