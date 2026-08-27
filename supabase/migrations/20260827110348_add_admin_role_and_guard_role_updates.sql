-- 1. Widen the role check to include 'admin'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('requestor', 'approver', 'admin'));

-- 2. is_admin() helper (SECURITY DEFINER so RLS policies can call it without recursion)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 3. Admins inherit every approver right. is_approver() now means
--    "may act as an approver", which an admin always may.
create or replace function public.is_approver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('approver', 'admin')
  );
$$;

-- 4. Admins can read and update every profile (role management).
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "admins update all profiles" on public.profiles;
create policy "admins update all profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- 5. SECURITY FIX: the "own profile update" policy has no WITH CHECK, so Postgres
--    reuses its USING clause (id = auth.uid()) as the check. That stays true when a
--    user rewrites their own role, so any requestor could self-promote to approver.
--    A trigger is the durable fix: it fires regardless of which policy allowed the row.
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
      select count(*) into admin_count from public.profiles where role = 'admin';
      if admin_count <= 1 then
        raise exception 'Cannot demote the last remaining administrator'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

revoke execute on function public.guard_profile_role() from anon, authenticated;
