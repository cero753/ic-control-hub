# IC Control Hub

A web app for managing **Internal Control (IC) framework** requests and approvals across four finance processes — **FSCR** (Financial Statement Closing & Reporting), **Fixed Assets**, **P2P** (Procure to Pay), and **R2R** (Record to Report).

Users raise requests against any of the **36 documented controls** (e.g. *"create a new ledger in Tally"* under Chart of Account Management). A finance approver reviews and approves/rejects. Once approved, the requestor can download a **Tally-ready XML** for ledger requests and create the ledger in Tally.

## Features

- **Controls Library** — all 36 controls with full detail (objective, risk, description, 6 financial-statement assertions, frequency, preventive/detective, key-control flag), filterable by framework and searchable.
- **Two roles** — *Requestor* (raises requests) and *Approver* (finance head/supervisor who approves). Roles live on a `profiles` table and are enforced with Postgres **Row Level Security**.
- **Generic request engine** — a request can be raised against any control; the Chart-of-Accounts control has a rich typed ledger form.
- **Approvals inbox** — approvers review pending requests with full control context and approve/reject with a comment.
- **Tally XML export** — approved ledger requests generate a Tally `ENVELOPE` import file (ledger name, parent group, opening balance, Dr/Cr).

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

### Roles

New sign-ups are **Requestors** by default. To promote a user to **Approver**:

```sql
update public.profiles set role = 'approver' where email = 'someone@example.com';
```

## Demo accounts

| Role      | Email                 | Password   |
|-----------|-----------------------|------------|
| Requestor | requestor@ichub.com   | Passw0rd!  |
| Approver  | approver@ichub.com    | Passw0rd!  |

## Scripts

- `scripts/extract_controls.py` — parse the 4 xlsx frameworks → `src/data/controls.json`
- `scripts/e2e_test.mjs` — end-to-end workflow + RLS test against the live project
