# TokenTrim Backend (API Service)

Serverless backend for **TokenTrim** hosting both Extension APIs (Auth, Document Cloud Sync, Telemetry Outbox) and Admin Management APIs. Designed for 1-click deployment on **Vercel**.

---

## Architecture & Endpoints

| Group | Path | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /api/health` | Service uptime and diagnostic check | Public |
| **Auth** | `POST /api/auth/signup` | Extension & Admin user registration | Public |
| **Auth** | `POST /api/auth/signin` | Sign in (returns token for extension, sets cookie for browser) | Public |
| **Auth** | `POST /api/auth/signout`| Invalidate current session | Authenticated |
| **Auth** | `GET /api/auth/me` | Fetch currently logged in user profile | Bearer / Cookie |
| **Auth** | `POST /api/auth/forgot` | Initiate password reset | Public |
| **Auth** | `POST /api/auth/reset` | Complete PIN-based reset | Public |
| **Documents** | `POST /api/documents` | Save document from extension (cloud sync) | Bearer |
| **Documents** | `GET /api/documents` | List stored documents for active user | Bearer |
| **Documents** | `GET /api/documents/:id`| Retrieve single document with chunks | Bearer |
| **Documents** | `DELETE /api/documents/:id` | Delete document from cloud storage | Bearer |
| **Telemetry** | `POST /api/events` | Flush client analytics & telemetry events | Public / Bearer |
| **Admin** | `GET /api/admin/metrics` | Real-time aggregate performance & usage metrics | Admin Cookie |
| **Admin** | `GET /api/admin/users` | List accounts, conversion stats, usage breakdown | Admin Cookie |
| **Admin** | `GET /api/admin/events` | Chronological event stream | Admin Cookie |
| **Admin** | `GET /api/admin/security/summary` | Live sessions, anomalies, brute force flags | Admin Cookie |
| **Admin** | `POST /api/admin/reauth`| Force user session revocation & re-authentication | Admin Cookie |

---

## Deploying to Vercel

### Option 1: Vercel Dashboard (GitHub integration)
1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), select **Import Project**.
3. Set **Root Directory** to `backend`.
4. Framework Preset will automatically detect **Next.js**.
5. Add Environment Variables (from `.env.example`):
   - `SESSION_SECRET`: Random 32+ character string.
   - `ADMIN_ORIGIN`: Your Netlify Admin Frontend URL (e.g. `https://tokentrim-admin.netlify.app`).
   - `SUPABASE_URL`: (Optional) Your Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: (Optional) Your Supabase service role key.
   - `ADMIN_EMAIL`: Initial admin account email.
   - `ADMIN_PASSWORD`: Initial admin password.
   - `ADMIN_PIN`: 6-digit PIN.
6. Click **Deploy**. Your API will be live at `https://<your-project>.vercel.app`.

### Option 2: Vercel CLI
```bash
cd backend
npm install -g vercel
vercel
# Follow the interactive prompts to link and deploy
```

---

## Local Development
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:3100
```
