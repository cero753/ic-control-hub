-- Trigger functions are never called directly, so nothing should be able to invoke
-- guard_profile_role() over the REST API. Revoking from anon/authenticated alone is
-- not enough — Postgres grants EXECUTE to PUBLIC by default.
revoke all on function public.guard_profile_role() from public, anon, authenticated;

-- Remaining linter warnings on this project are accepted, not oversights:
--   is_admin() / is_approver() must stay executable — the RLS policies call them and
--     policy expressions run as the querying role.
--   admin_create_user() must stay executable by `authenticated` — it is the admin
--     provisioning entry point and re-checks is_admin() as its first statement.
