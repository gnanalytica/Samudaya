-- ============================================================================
-- Samudaya · 0920.0800 · A config line is not a permission
-- ----------------------------------------------------------------------------
-- 0920.0600 and 0920.0700 closed twenty-four functions in `public` that anon
-- could execute. The sweep they left behind in 02_rls_test.sql asks only about
-- `public`, so it had nothing to say about the schema next door: `app` holds
-- forty SECURITY DEFINER functions, anon has USAGE on the schema, and anon
-- holds EXECUTE on every one of them.
--
-- What is actually reachable, stated plainly rather than dressed up: nothing,
-- today. PostgREST answers an anonymous caller who asks for `app` by
-- Content-Profile with
--
--   {"code":"PGRST106","message":"Invalid schema: app",
--    "hint":"Only the following schemas are exposed: public, graphql_public"}
--
-- and anon is NOLOGIN, so there is no direct connection either. The forty are
-- held shut by PostgREST's exposed-schema list — a line of project config in a
-- dashboard, with nothing in this repository recording that anything depends
-- on it. Add `app` to that list for one debugging session and forty definer
-- functions open at once, among them app.notify(), which writes notification
-- rows into any community whose id you hold, and app.member_user_ids(), which
-- hands back a society's user ids straight past the RLS on memberships.
--
-- That is the same shape as the bug in 0920.0600 and deserves the same words:
-- the guard was load-bearing without anybody having decided it should be.
--
-- ---------------------------------------------------------------------------
-- Why this revokes the schema and not the functions
-- ---------------------------------------------------------------------------
-- A per-function revoke would be the obvious mirror of 0920.0700, and it is
-- the wrong tool here. Twenty-six of the forty have no ACL at all — their only
-- grant is PostgreSQL's default to PUBLIC — so `revoke execute … from public`
-- would take the function from `authenticated` in the same breath. That is not
-- hypothetical: public.todo_items is SECURITY INVOKER and calls
-- app.flat_label(), one of the twenty-six, so it would start failing for every
-- signed-in member. Doing it safely means auditing forty call graphs to close
-- an exposure against a role that appears in none of them.
--
-- Revoking USAGE is also the only version that covers the next function added
-- to `app`, which is the failure mode this run of migrations keeps hitting.
--
-- Three things were measured first, because any of them would have made this a
-- bad trade:
--
--   · RLS policies that call app.is_member() and friends keep working. Policy
--     expressions are not privilege-checked against the querying role, so anon
--     reading public.events still gets an empty set rather than an error.
--     Measured against a database with rows in it — an empty table never
--     evaluates its policy and would have passed either way.
--   · Triggers whose functions live in `app` still fire for a caller holding
--     no USAGE; trigger functions are not privilege-checked when they fire.
--   · anon can call app.is_member() directly today, and cannot once USAGE is
--     gone: `permission denied for schema app`.
--
-- authenticated and service_role keep USAGE. This takes it from anon alone.
-- ============================================================================

revoke usage on schema app from anon;

comment on schema app is
  'Internal helpers: RLS predicates, trigger functions, and the writes behind '
  'the public RPCs. Not exposed through PostgREST, and not reachable by anon, '
  'which holds no USAGE here. Policies and triggers defined in this schema go '
  'on working for every role either way, because neither is privilege-checked '
  'against the caller.';
