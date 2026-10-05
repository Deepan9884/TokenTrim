# TokenTrim Creator Panel

Separate Next.js web app: creator login, user-trend charts, user list, event
explorer. Backed by Supabase Postgres in production, or a zero-setup local
JSON store in demo mode. Full details: [`../ADMIN_PANEL.md`](../ADMIN_PANEL.md).

## Quick start (demo mode, no credentials)

```bash
cd admin
npm install
npm run dev -- --port 3100
```

Open http://localhost:3100/login and sign in. The panel is sign-in
only (no public sign-up page) — accounts are created from the TokenTrim
extension via `POST /api/auth/signup`. The address in
`ADMIN_EMAIL` (default `admin@tokentrim.local`) becomes the creator admin.

Demo admin login: `admin@tokentrim.local` / `admin123` / key `1234`
(change via `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`).

## Production (Supabase)

```bash
# 1. Create a Supabase project, run supabase/migrations/0001_schema.sql
# 2. Set env vars and restart:
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_EMAIL=you@yourdomain.com
npm run build && npm run start -- --port 3100
```

## Test

```bash
# from repo root
npm run test:admin   # Playwright: auth (9) + dashboard (7) + extension↔panel (3)
```

Test endpoints (`POST /api/test-utils/reset|seed`) only exist when
`ALLOW_TEST_ENDPOINTS=true` **and** the demo store is active.
