# PROJECT TRIBELY — OFFICIAL PRODUCTION DEPLOYMENT GUIDE

This document is the definitive, step-by-step production runbook for deploying **Tribely** to a free-tier cloud architecture.

---

## Target Deployment Architecture

```
                               ┌────────────────────────────────┐
                               │       GoDaddy DNS              │
                               │   tribely.mayurkpatil.in       │
                               └──────────────┬─────────────────┘
                                              │
                                              ▼
                               ┌────────────────────────────────┐
                               │       Vercel (Frontend)        │
                               │   Next.js 16 + React 19        │
                               └──────────────┬─────────────────┘
                                              │ HTTP / WSS
                                              ▼
                               ┌────────────────────────────────┐
                               │       Render (Backend)         │
                               │   FastAPI Web Service          │
                               └───┬──────────┬─────────────┬───┘
                                   │          │             │
                PostgreSQL Queries │          │ Pub/Sub     │ File Uploads
                                   ▼          ▼             ▼
  ┌──────────────────────────────────┐ ┌─────────────┐ ┌───────────────────────┐
  │         Supabase Database        │ │   Upstash   │ │   Supabase Storage    │
  │   PostgreSQL 15+ (Pooled 6543)   │ │    Redis    │ │   `tribely-proofs`    │
  └──────────────────────────────────┘ └─────────────┘ └───────────────────────┘
```

---

## Summary Checklist of Required Accounts (All Free-Tier)

| Service | Purpose | Free Tier Allowance |
| :--- | :--- | :--- |
| **GitHub** | Code repository & CI/CD trigger | Unlimited public/private repos |
| **Supabase** | PostgreSQL database + Object storage | 500 MB database, 1 GB storage |
| **Upstash** | Redis Pub/Sub & caching | 10,000 commands/day |
| **Render** | FastAPI web service hosting | 750 free instance hours/month |
| **Vercel** | Next.js frontend hosting + SSL | 100 GB bandwidth, unlimited domains |
| **GoDaddy** | DNS domain registrar (`mayurkpatil.in`) | Existing domain management |

---

## STAGE 1: Git Commit & Push to GitHub

### 1.1 Verify Git Status
Ensure all local secrets are untracked and `.gitignore` is active:
```bash
git status
```
*Verify that `backend/.env` is marked as deleted/untracked.*

### 1.2 Stage and Commit All Pre-Deployment Hardening
```bash
git add -A
git commit -m "chore: pre-deployment cloud configuration and security hardening"
```

### 1.3 Push to GitHub
```bash
git push origin main
```

> [!WARNING]
> **Credential Rotation**: Any third-party keys or database credentials previously committed to Git history must be revoked and regenerated before deploying to production.

---

## STAGE 2: Supabase Database & Storage Provisioning

### 2.1 Create Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **New Project**.
2. **Project Name**: `tribely-prod`
3. **Database Password**: Generate and securely record a strong password.
4. **Region**: Choose a region closest to your target audience (e.g., `South Asia (Mumbai)` or `Southeast Asia (Singapore)`).
5. Click **Create new project** and wait 1–2 minutes for provisioning.

### 2.2 Retrieve Database Connection Strings
1. Navigate to **Project Settings** (gear icon) → **Database**.
2. Scroll to **Connection String** and select the **URI** tab.
3. Switch mode to **Transaction** (Port `6543`) or **Session** (Port `5432`):
   ```text
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your actual database password.
5. Save this URI for the Render `DATABASE_URL` setting.

### 2.3 Create Media Storage Bucket
1. In the Supabase sidebar, click **Storage**.
2. Click **New Bucket**.
3. **Bucket Name**: `tribely-proofs` *(must match exactly)*.
4. Toggle **Public Bucket** to **ON** (allows public viewing of habit proofs and user avatars via Supabase CDN).
5. Click **Save**.

### 2.4 Retrieve Storage API Credentials
1. Navigate to **Project Settings** → **API**.
2. Under **Project URL**, copy the URL:
   ```text
   https://[PROJECT-REF].supabase.co
   ```
3. Under **Project API Keys**, copy the **`service_role` (secret)** key.
   *(Never share this key or expose it to frontend clients; it is used only server-side by Render).*

---

## STAGE 3: Upstash Serverless Redis Provisioning

### 3.1 Create Redis Instance
1. Log in to [upstash.com](https://upstash.com).
2. Click **Create Database**.
3. **Name**: `tribely-redis`
4. **Type**: Regional
5. **Region**: Select the region matching your Supabase/Render services.
6. **TLS (SSL)**: Enabled (default).
7. Click **Create**.

### 3.2 Retrieve Connection URI
1. Scroll down to the **Connect** section.
2. Select the **`rediss://`** (Python/ioredis) tab.
3. Copy the full connection string:
   ```text
   rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379
   ```
4. Save this string for the Render `REDIS_URL` setting.

---

## STAGE 4: Backend Web Service Deployment (Render)

### 4.1 Create Web Service
1. Log in to [render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and choose your `Tribely` repo.
4. Configure service settings:
   - **Name**: `tribely-backend`
   - **Region**: Match your Supabase region (e.g., `Singapore` or `Frankfurt`).
   - **Branch**: `main`
   - **Root Directory**: *(Leave empty)*
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2`
   - **Instance Type**: `Free`

### 4.2 Configure Environment Variables
In the **Environment Variables** section, add the following key-value pairs:

| Key | Value | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `production` | Enables production mode and shields error traces |
| `PYTHON_VERSION` | `3.11.8` | Enforces compatible Python runtime |
| `SECRET_KEY` | *(Click "Generate" or 64-char random string)* | Signs JWT session tokens |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres` | Supabase connection string |
| `REDIS_URL` | `rediss://default:[pass]@[endpoint].upstash.io:6379` | Upstash Redis connection string |
| `FRONTEND_URL` | `https://tribely.mayurkpatil.in` | Whitelisted frontend web URL |
| `BACKEND_PUBLIC_URL` | `https://tribely-backend.onrender.com` | Public Render service URL |
| `STORAGE_PROVIDER` | `supabase` | Activates Supabase Object Storage engine |
| `SUPABASE_URL` | `https://[PROJECT-REF].supabase.co` | Supabase project API base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Supabase service-role secret key |
| `SUPABASE_STORAGE_BUCKET` | `tribely-proofs` | Target storage bucket |
| `ALLOWED_ORIGINS` | `https://tribely.mayurkpatil.in,https://tribely-backend.onrender.com` | Whitelisted CORS origins |

### 4.3 Deploy and Verify
1. Click **Create Web Service**.
2. Monitor deployment logs:
   - Dependencies will install.
   - On startup, FastAPI lifespan executes `Base.metadata.create_all`, automatically creating all tables and composite indexes in Supabase.
3. Test backend health:
   ```bash
   curl https://tribely-backend.onrender.com/api/health
   ```
   *Expected Response:* `{"status":"healthy","service":"Tribely","environment":"production","database":"connected","redis":"connected"}`

---

## STAGE 5: Frontend Deployment (Vercel)

### 5.1 Import Project
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import the `Tribely` repository.
4. In project configuration:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and choose `frontend`.

### 5.2 Configure Environment Variables
Expand **Environment Variables** and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://tribely-backend.onrender.com` | Render backend API endpoint |
| `NEXT_PUBLIC_WS_URL` | `wss://tribely-backend.onrender.com` | Render WebSocket endpoint |
| `NEXT_PUBLIC_APP_URL` | `https://tribely.mayurkpatil.in` | Canonical frontend domain |

### 5.3 Deploy
1. Click **Deploy**.
2. Vercel will compile the Next.js production build using Turbopack.
3. Verify that the build succeeds and generates a live preview URL (e.g., `tribely-xyz.vercel.app`).

---

## STAGE 6: Custom Domain & DNS Setup (GoDaddy)

### 6.1 Add Domain to Vercel
1. In your Vercel Project Dashboard, navigate to **Settings** → **Domains**.
2. Enter `tribely.mayurkpatil.in` and click **Add**.
3. Vercel will indicate that a DNS record is required:
   - **Type**: `CNAME`
   - **Name**: `tribely`
   - **Value**: `cname.vercel-dns.com`

### 6.2 Configure DNS in GoDaddy
1. Log in to your [GoDaddy Account](https://dcc.godaddy.com/manage/portfolio).
2. Click on domain **mayurkpatil.in** → **Manage DNS**.
3. Under **DNS Records**, click **Add New Record**:
   - **Type**: `CNAME`
   - **Name**: `tribely`
   - **Value**: `cname.vercel-dns.com`
   - **TTL**: `1/2 Hour` (or Default)
4. Save the record.

### 6.3 Verify SSL Activation
1. Return to the Vercel **Domains** tab.
2. Within 5–15 minutes, Vercel will verify DNS propagation and issue a free Let's Encrypt SSL certificate.
3. A green checkmark will appear next to `tribely.mayurkpatil.in`.

---

## STAGE 7: End-to-End Live Verification & Smoke Testing

Perform the following smoke tests on the live production site `https://tribely.mayurkpatil.in`:

1. **Authentication Flow**:
   - Visit `https://tribely.mayurkpatil.in/register` and create an account.
   - Verify immediate redirect to dashboard.
   - Log out and log back in at `/login`.
2. **Arena Creation & Staking**:
   - Create a new accountability arena with a daily penalty (e.g., 50 Kudos).
   - Check that the arena appears on your dashboard.
3. **Invite Link Verification**:
   - Click **Invite Members** and copy the invite link.
   - Verify the link is formatted as:
     `https://tribely.mayurkpatil.in/arenas/{id}?code={code}`
4. **Media Proof Upload (Supabase Storage Check)**:
   - Open the arena and click **Submit Proof**.
   - Capture a photo using your camera or upload an image.
   - Verify the proof appears in the feed.
   - Inspect the image URL: verify that it points to your Supabase Storage CDN URL (`https://[ref].supabase.co/storage/v1/object/public/tribely-proofs/...`).
5. **Real-time Synchronization**:
   - Send a chat message in the arena drawer.
   - Confirm real-time delivery over the WebSocket connection without page refresh.
6. **Streak & Consistency Grid**:
   - Check your profile at `/profile` to confirm that the consistency grid reflects your submission.

---

## Troubleshooting & FAQ

### 1. Render Free Tier Cold Starts
- **Symptom**: The first request after 15 minutes of inactivity takes 30–50 seconds to respond.
- **Cause**: Render spins down free web services after 15 minutes of inactivity.
- **Remedy**: The frontend displays animated skeleton loaders while the backend wakes up. Subsequent requests respond in milliseconds.

### 2. Database Connection Pooling / SSL
- **Symptom**: `TypeError: connect() got an unexpected keyword argument 'sslmode'`.
- **Resolution**: Tribely's `backend/app/core/config.py` automatically converts `sslmode=require` to `ssl=require` for `asyncpg`. Always use the URI connection string from Supabase.

### 3. Media Upload Size Errors (HTTP 413)
- **Symptom**: Upload fails with `HTTP 413 Request Entity Too Large`.
- **Resolution**: Media uploads are limited to 10 MB per file to comply with Supabase Free plan constraints. Optimize or compress images before uploading.

---

*Project Tribely is now ready for production deployment.*
