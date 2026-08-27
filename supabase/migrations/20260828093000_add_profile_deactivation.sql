-- Off-boarding without destroying the audit trail.
--
-- profiles -> auth.users, requests -> profiles and approvals -> profiles are all
-- ON DELETE CASCADE, so deleting a user erases every request they raised and every
-- approval they signed. For an internal-controls app that history is the product,
-- so "remove user" is a reversible deactivation, not a delete.

-- 1. null = active. Deliberately nullable rather than a boolean so we keep the
--    timestamp of when access was withdrawn.
alter table public.profiles add column if not exists deactivated_at timestamptz;

-- 2. Deactivating must survive a page refresh AND an existing session, so it
--    touches auth.users.banned_until (GoTrue refuses sign-in while it is in the
--    future) and clears the user's live sessions.
create or replace function public.admin_set_user_active(
  p_user_id uuid,
  p_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target public.profiles;
  result public.profiles;
  active_admins int;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'No such user' using errcode = '22023';
  end if;

  if not p_active then
    -- An admin locking themselves out has no recovery path in the UI.
    if p_user_id = auth.uid() then
      raise exception 'You cannot deactivate your own account' using errcode = '42501';
    end if;

    if target.role = 'admin' then
      select count(*) into active_admins
        from public.profiles
       where role = 'admin' and deactivated_at is null;
      if active_admins <= 1 then
        raise exception 'Cannot deactivate the last remaining administrator'
          using errcode = '42501';
      end if;
    end if;
  end if;

  update public.profiles
     set deactivated_at = case when p_active then null else now() end
   where id = p_user_id
  returning * into result;

  -- 100 years, not 'infinity': GoTrue scans banned_until into a Go time.Time and
  -- a Postgres infinite timestamp does not round-trip through that. Same family of
  -- trap as the NULL token columns that broke sign-in in the previous migration.
  update auth.users
     set banned_until = case when p_active then null else now() + interval '100 years' end
   where id = p_user_id;

  if not p_active then
    -- Without this the user stays signed in until their access token expires.
    delete from auth.refresh_tokens where user_id = p_user_id::text;
    delete from auth.sessions where user_id = p_user_id;
  end if;

  return result;
end;
$$;

revoke all on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

-- 3. The last-admin guard must not count admins who can no longer sign in,
--    otherwise a deactivated admin still "protects" the seat.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_role text;
  admin_count int;
begin
  if new.role is distinct from old.role then
    claim_role := coalesce(
      (current_setting('request.jwt.claims', true)::json ->> 'role'),
      ''
    );

    -- '' = direct SQL connection (migrations / dashboard); service_role = trusted backend.
    if claim_role not in ('', 'service_role', 'supabase_admin') then
      if not public.is_admin() then
        raise exception 'Only administrators can change a user role'
          using errcode = '42501';
      end if;
    end if;

    -- Never allow the last admin to be demoted; that would lock everyone out.
    if old.role = 'admin' and new.role <> 'admin' then
      select count(*) into admin_count
        from public.profiles
       where role = 'admin' and deactivated_at is null;
      if admin_count <= 1 then
        raise exception 'Cannot demote the last remaining administrator'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_role() from public, anon, authenticated;
