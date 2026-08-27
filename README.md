# IC Control Hub

A web app for managing **Internal Control (IC) framework** requests and approvals across four finance processes — **FSCR** (Financial Statement Closing & Reporting), **Fixed Assets**, **P2P** (Procure to Pay), and **R2R** (Record to Report).

Users raise requests against any of the **36 documented controls** (e.g. *"create a new ledger in Tally"* under Chart of Account Management). A finance approver reviews and approves/rejects. Once approved, the requestor can download a **Tally-ready XML** for ledger requests and create the ledger in Tally.

## Features

- **Controls Library** — all 36 controls with full detail (objective, risk, description, 6 financial-statement assertions, frequency, preventive/detective, key-control flag), filterable by framework and searchable.
- **Three roles** — *Requestor* (raises requests), *Approver* (finance head/supervisor who approves) and *Administrator* (full access). Roles live on a `profiles` table and are enforced with Postgres **Row Level Security**.
- **Admin portal** — every user with live role switching, account creation for any role and reversible **deactivation**; every request across all users with CSV and Tally export; the full control framework as an exportable table.
- **Generic request engine** — a request can be raised against any control; the Chart-of-Accounts control has a rich typed ledger form.
- **Approvals inbox** — approvers review pending requests with full control context and approve/reject with a comment.
- **Status tabs everywhere** — My Requests, the Approvals inbox and the admin request list share one tab bar (All / Pending / Approved / Rejected / Completed). **Approved deliberately includes completed**: marking a ledger created in Tally does not undo the approval, so it must not vanish from the approved set.
- **Tally XML export** — approved ledger requests generate a Tally `ENVELOPE` import file (ledger name, parent group, opening balance, Dr/Cr). Available per request, and as **one consolidated file** holding every approved ledger currently in view. Both are offered to the requestor, the approver and the admin.

## Tech stack

- Vite + React + TypeScript + Tailwind CSS
- React Router
- Supabase (Auth + Postgres + RLS)
- Deployed on Netlify

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + publishable key
npm run dev
```

Environment variables (must be prefixed `VITE_`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Database

The four source Excel frameworks are parsed into `src/data/controls.json` by `scripts/extract_controls.py` and seeded into the `controls` table. Tables: `profiles`, `controls`, `requests`, `approvals`.

### Roles & auth

New sign-ups are **Requestors** — this is enforced **server-side** by the `handle_new_user`
trigger, which ignores any client-supplied role in the signup metadata (the anon key is public,
so the role must not be trusted from the client).

Roles are changed from the **Admin portal**, or directly in SQL:

```sql
update public.profiles set role = 'approver' where email = 'someone@example.com';
```

Two server-side guards make role management safe:

- **`guard_profile_role`** (BEFORE UPDATE on `profiles`) rejects any role change not made by
  an admin. This is a trigger rather than an RLS policy on purpose: the `own profile update`
  policy declares no `WITH CHECK`, so Postgres reuses its `USING` clause (`id = auth.uid()`),
  which stays true when a user rewrites their own role — every user could otherwise self-promote.
  The same trigger refuses to demote the last remaining administrator.
- **`admin_create_user(email, password, full_name, role)`** is the only path that can create an
  account with a chosen role. It is `SECURITY DEFINER` and its first statement is an `is_admin()`
  check, so a non-admin calling the RPC directly gets `Administrator access required`.

Admins inherit every approver right: `is_approver()` returns true for `approver` and `admin`.

### Off-boarding

There is no "delete user". `profiles → auth.users`, `requests → profiles` and `approvals →
profiles` are all `ON DELETE CASCADE`, so deleting an account would erase every request that
person raised and every approval they signed — the audit trail this app exists to keep.

Instead, **`admin_set_user_active(user_id, active)`** withdraws access reversibly. It sets
`profiles.deactivated_at`, sets `auth.users.banned_until` (GoTrue refuses sign-in while it is in
the future) and clears the user's rows from `auth.sessions` and `auth.refresh_tokens` so an
already-signed-in user is logged out rather than surviving until their access token expires. It
refuses to deactivate you (an admin locking themselves out has no recovery path in the UI) or the
last remaining active admin. `guard_profile_role` counts only `deactivated_at is null` admins, so
a deactivated admin no longer holds the seat.

`banned_until` is set to `now() + interval '100 years'`, **not `'infinity'`** — GoTrue scans that
column into a Go `time.Time` and a Postgres infinite timestamp does not round-trip, which breaks
sign-in for everyone.

New users are **auto-confirmed** on signup (an `auto_confirm_user` trigger sets
`email_confirmed_at`), so they can sign in immediately — the project has no custom SMTP and the
built-in mailer is rate-limited. For a production deployment with real email delivery, remove that
trigger and enable "Confirm email" in the Supabase Auth settings.

## Demo accounts

| Role          | Email                 | Password   |
|---------------|-----------------------|------------|
| Requestor     | requestor@ichub.com   | Passw0rd!  |
| Approver      | approver@ichub.com    | Passw0rd!  |
| Administrator | admin@ichub.com       | Passw0rd!  |

## Scripts

- `scripts/extract_controls.py` — parse the 4 xlsx frameworks → `src/data/controls.json`
- `scripts/e2e_test.mjs` — end-to-end workflow + RLS test against the live project

## Tests

All suites accept `BASE_URL` (defaults to the live site) and run against the real Supabase project:

```bash
node tests/backend.mjs      # 29 auth / RLS / control-data checks
node tests/browser.mjs      # 41 Playwright checks, requestor + approver
node tests/admin.mjs        # 34 admin role, provisioning and deactivation checks
node tests/admin_ui.mjs     # 43 Playwright checks of the admin portal + XML per role
node tests/tally_xml.mjs    # 20 Dr/Cr sign, escaping and consolidated-file checks
node tests/signup_ui.mjs    # 4 signup checks
node tests/signup_probe.mjs # privilege-escalation probe
```

The Playwright suites default `BASE_URL` to the **live site**, so pointing them at a local build
means running `npm run build && npm run preview` first and passing
`BASE_URL=http://127.0.0.1:4173` — otherwise they silently test the deployed version and fail
against changes you have not shipped yet.

`admin_ui.mjs` prints SQL for the accounts and approval row it leaves behind — `approvals` has
no DELETE policy by design (it is an audit trail), so that cleanup needs a privileged user.

### Known open item

The `requests` UPDATE policies declare no `WITH CHECK`, so Postgres reuses `USING` as the check.
`requestor update own` is `requestor_id = auth.uid()`, which stays true after a requestor rewrites
their own `status` to `'approved'` — **a requestor can self-approve via the public anon key, and
can edit `payload` after approval.** This is the same bug class that `guard_profile_role` fixes
for roles; the fix is a `guard_request_transitions` BEFORE UPDATE trigger. Not yet done.
