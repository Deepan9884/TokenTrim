# TokenTrim Admin Frontend (Netlify)

Web application dashboard for creator analytics, user tracking, event explorer, and security auditing. Designed for deployment on **Netlify**.

---

## Features
- **Live Metrics Dashboard**: Real-time conversion counters, token savings, 30-day growth, document type breakdown, retention cohorts.
- **User Activity Explorer**: User list with aggregate uploads, conversions, tokens saved, and per-user detail drawer.
- **Security Console**: Single-browser enforcement monitor, detected anomalies (brute force, IP changes), force re-auth button.
- **Zero-CORS Backend Proxy**: Netlify automatically proxies `/api/*` to your Vercel backend (`https://<your-backend>.vercel.app/api/*`).

---

## Deploying to Netlify

### Option 1: Netlify Dashboard (Git integration)
1. Push your repository to GitHub.
2. In the [Netlify App](https://app.netlify.com/), click **Add new site** > **Import an existing project**.
3. Select your repository.
4. Set **Base directory**: `admin-frontend`
5. Set **Build command**: `npm run build`
6. Set **Publish directory**: `.next`
7. In `netlify.toml`, update the destination URL with your deployed Vercel backend URL:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-vercel-backend.vercel.app/api/:splat"
     status = 200
     force = true
   ```
8. Set Environment Variables:
   - `BACKEND_URL`: `https://your-vercel-backend.vercel.app`
   - `SUPABASE_URL`: (Optional) Your Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: (Optional) Your Supabase service key.
9. Click **Deploy Site**.

### Option 2: Netlify CLI
```bash
cd admin-frontend
npm install -g netlify-cli
netlify init
netlify deploy --build --prod
```

---

## Local Development
```bash
cd admin-frontend
npm install
npm run dev
# Running on http://localhost:3000
# Proxies /api/* to http://localhost:3100 (where backend is running)
```
