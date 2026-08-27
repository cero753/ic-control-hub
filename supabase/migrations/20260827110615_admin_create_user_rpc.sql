-- Admin-only account provisioning.
--
-- The browser cannot create an account with a chosen role: signup is deliberately
-- hardened so handle_new_user always writes 'requestor' (the anon key is public, so
-- client-supplied role metadata is never trusted). This SECURITY DEFINER function is
-- the single audited path that may do it, and its first statement is the admin check.
--
-- Note on the empty-string token columns: GoTrue scans auth.users token columns into
-- Go strings, which cannot hold NULL. Leaving them NULL makes every subsequent sign-in
-- fail with "Database error querying schema", so they must be seeded as ''.
create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  clean_email text := lower(trim(p_email));
  clean_name text := nullif(trim(p_full_name), '');
  result public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if clean_email is null or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters' using errcode = '22023';
  end if;

  if p_role not in ('requestor', 'approver', 'admin') then
    raise exception 'Role must be requestor, approver or admin' using errcode = '22023';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = clean_email) then
    raise exception 'An account with that email already exists' using errcode = '23505';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(clean_name, clean_email)),
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  -- auth.identities.email is a generated column, so it must be omitted here.
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), new_id, new_id::text, 'email',
    jsonb_build_object('sub', new_id::text, 'email', clean_email),
    now(), now(), now()
  );

  -- handle_new_user has already inserted the profile row as 'requestor'.
  -- This runs as the definer, so guard_profile_role permits the role change.
  update public.profiles
     set role = p_role,
         full_name = coalesce(clean_name, full_name)
   where id = new_id
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.admin_create_user(text, text, text, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
