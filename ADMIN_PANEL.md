# TokenTrim Creator Panel — Implementation Record

Standalone admin web app (`admin/`, Next.js 14) + Supabase Postgres schema
(`supabase/migrations/`) + extension integration (`lib/admin-api.js` + Account
section in popup settings). No email is sent anywhere: password recovery uses
the 4-digit key chosen at signup.

## Architecture

```
Extension popup ──HTTPS/Bearer──▶ Next.js API (/api/*) ──▶ Supabase Postgres
Admin dashboard ──server────────▶ same store layer ──────▶ (or demo JSON store)
```

The Next.js app **is** the backend (API routes); Supabase is used as Postgres
via the service-role key. Auth (email + scrypt-hashed password + hashed
4-digit PIN) is implemented server-side so demo and Supabase modes behave
identically. The extension never touches Supabase directly — it talks to the
panel API with a Bearer session token (cookies don't cross
`chrome-extension://` origins).

## Auth flows

- **Sign up**: name (optional) + email + password (≥8) + 4-digit key.
  The `ADMIN_EMAIL` address is promoted to creator admin.
- **Sign in**: email + password. Admin UI rejects non-admins with an
  explicit message (they can still use the extension).
- **Forgot password**: email → (always ok, no account probing) → enter
  4-digit key + new password → auto sign-in. Wrong keys: uniform
  "Incorrect email or key", 5 attempts / 15 min per email, then 429.
- Sessions: 32-byte opaque tokens (SHA-256 in store), 30-day expiry,
  httpOnly `tt_session` cookie for browsers, Bearer for the extension.

## Extension integration

- `lib/admin-api.js`: base-URL + token in `chrome.storage.local`, offline
  event outbox (cap 200, flushes opportunistically, never throws).
- Popup settings → Account section: panel URL connect, sign in/up/out,
  forgot-password with key, signed-in card (email, plan, creator flag).
- Every conversion fires `convert_success` (tokens saved, pages, preset,
  mode, ms) or `convert_error`; fully inert when no panel URL is set,
  so all 60 existing extension E2E tests pass unchanged.
- Manifest: `host_permissions: ["http://localhost/*"]` (dev; no store
  warning) + `connect-src` extended for Supabase/localhost. Production
  deployments add their panel domain to both.

## Dashboard

- `/dashboard`: headline cards (users, 7d signups/active, 30d conversions
  and tokens saved) + user-growth area, conversions bar, tokens line charts.
- `/users`: searchable/sortable table (short ID, plan/admin pills,
  conversions, tokens, signup, last seen) with expandable recent activity.
- `/events`: filterable explorer (name, text search, per-user).
- `/api/documents`: cloud document backup and sync (`GET` list, `POST` save/sync, `[id]` get/delete).
- Route guard: middleware checks cookie presence; layouts re-validate the
  session and require `is_admin`.

## Environment

| Var | Purpose | Default |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | production Postgres (both required) | unset → demo store |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_PIN` | seeded/demo creator | `admin@tokentrim.local` / `admin123` / `1234` |
| `ALLOW_TEST_ENDPOINTS` | enable `/api/test-utils/*` (demo only) | unset (endpoints 404) |
| `DEMO_DB_PATH` | demo JSON location | `admin/data/demo-db.json` |
| `SEED_ADMIN` | auto-create creator on first run | `true` |

## Supabase Setup & Diagnostics

Run the standalone verification script to test connection to Supabase and verify all required tables exist:
```bash
node supabase/setup-db.mjs
```

Migrations to apply in Supabase SQL editor:
1. `supabase/migrations/0001_schema.sql` (`profiles`, `sessions`, `analytics_events`)
2. `supabase/migrations/0002_documents.sql` (`user_documents`)

## Verification (20 passed, 0 failed)

- `npm run test:admin` — **20 passed, 0 failed**: auth A01–A09 (signup API,
  duplicate, signin right/wrong, admin stay, forgot wrong/right key,
  password rotation, validation, signout guard, no public signup page),
  dashboard D01–D07 (cards, SVG charts, user table + search + row detail,
  event filters, non-admin 403), connection X01–X04 (popup signup → panel row,
  popup conversion → tracked event + aggregates, popup forgot→reset, and
  document cloud sync API save/list/get/delete).
- Root vitest: 10 test files, 46 passed. Includes `tests/documents-sync.test.js`
  and `tests/admin-helpers.test.js`.
