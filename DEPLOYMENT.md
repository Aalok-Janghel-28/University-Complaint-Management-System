# Deploy UCMS (Render + Vercel + Supabase)

This repository is configured for a free demo deployment:

- **Vercel** serves the React/Vite frontend and proxies `/api/*` to Render.
- **Render** runs Django with Gunicorn and applies database migrations at startup.
- **Supabase** provides PostgreSQL and private S3-compatible file storage.

Free hosting is suitable for a demonstration, not important production records. Render's free web service sleeps when idle and has an ephemeral filesystem; Supabase Free can pause an inactive project and does not include automatic backups. Keep uploaded complaint evidence in Supabase Storage, not Render's local filesystem.

## 1. Push the repository to GitHub

Keep the repository private if practical. Never commit `Backend/.env`, database credentials, S3 keys, or a production secret key. `.gitignore` already ignores `.env` files.

## 2. Create Supabase database and storage

1. Create a Supabase project and save its database password.
2. In **Connect**, select **Session pooler** and copy the host, port, database name, and username. Do not construct the pooler hostname or username yourself.
3. In **Storage**, create a **private** bucket named `ucms-uploads`.
4. Enable S3 access for Storage and copy the S3 endpoint, access key, and secret key. Keep the secret key private.

Use the actual values shown in the Supabase dashboard when you configure Render.

## 3. Deploy the frontend to Vercel

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `FrontEnd`.
3. Use the Vite defaults or set build command to `npm run build` and output directory to `dist`.
4. Deploy and record the Vercel URL, for example `https://your-ucms.vercel.app`.

`FrontEnd/vercel.json` routes API traffic to `https://ucms-api.onrender.com`. The Render service in the next step must keep the name `ucms-api` for that URL. If Render requires a different available service name, change the destination in `FrontEnd/vercel.json`, push the change, and redeploy Vercel.

## 4. Create the Render service from the Blueprint

1. In Render, choose **New → Blueprint** and connect the GitHub repository.
2. Render reads the root-level `render.yaml` and creates the `ucms-api` Python web service.
3. When prompted for Blueprint values, use the Supabase and Vercel values from earlier steps:

| Variable | Value |
|---|---|
| `DJANGO_ALLOWED_HOSTS` | `ucms-api.onrender.com,your-ucms.vercel.app` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://ucms-api.onrender.com,https://your-ucms.vercel.app` |
| `FRONTEND_URL` | `https://your-ucms.vercel.app` |
| `DB_NAME` | Database name from Supabase Session pooler |
| `DB_USER` | Username from Supabase Session pooler |
| `DB_PASSWORD` | Supabase database password |
| `DB_HOST` | Host from Supabase Session pooler |
| `DB_PORT` | Port from Supabase Session pooler |
| `AWS_STORAGE_BUCKET_NAME` | `ucms-uploads` |
| `AWS_S3_ENDPOINT_URL` | Supabase Storage S3 endpoint |
| `AWS_ACCESS_KEY_ID` | Supabase Storage S3 access key |
| `AWS_SECRET_ACCESS_KEY` | Supabase Storage S3 secret key |

The Blueprint generates `DJANGO_SECRET_KEY`, sets `DJANGO_DEBUG=False`, uses PostgreSQL SSL, collects Django static files, and starts the app with Gunicorn. It also runs migrations during service startup.

## 5. Create the first super-admin account

The free Render service does not provide a shell. Create the first super-admin from your own computer, connecting Django to the hosted Supabase database:

1. In `Backend/.env`, temporarily put the Supabase database values and a private `DJANGO_SECRET_KEY`. Keep this file local; do not commit it.
2. In PowerShell:

   ```powershell
   cd Backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python manage.py createsuperuser
   ```

3. Enter the admin email, name, and a strong password. The custom user manager assigns this Django superuser the `super_admin` application role.
4. Remove the production database values from the local `.env` when you are done.

Sign in to the website and use its admin page to create departments, officers, and SLA configurations. Avoid running `seed_complaints` on a public deployment: it creates demo accounts with the known password `password123` and resets those passwords when rerun.

## 6. Verify the deployment

1. Open the Vercel URL and register a citizen account.
2. Submit a complaint, try AI analysis, and verify the ticket appears on the dashboard.
3. Upload a small image or PDF, then verify it downloads through the authenticated complaint endpoint.
4. Sign in as super-admin, create a department and officer, assign a complaint, and test resolution, feedback, and closure.
5. Reload the page after sign-in to confirm the refresh-cookie session works.
6. If a request fails, check the Render service logs and confirm the Vercel API rewrite hostname exactly matches the Render service URL.

## Known free-tier constraints

- The Render service sleeps when idle, so the first request can be slow.
- Supabase Free has storage quotas and may pause inactive projects. Keep independent backups before relying on the data.
- Password-reset mail is not configured by the Blueprint. Render blocks outbound SMTP on ports 25, 465, and 587, so use an HTTPS email provider integration or a host that allows your mail provider's connection method.
- The SLA processor is not scheduled by this setup. It runs during certain staff queue/analytics requests; continuous unattended checks need a scheduler.
- AI training writes model artifacts to the service filesystem. On a free Render service those changes are temporary; train locally and deploy the model files, or configure persistent model storage before using hosted retraining.
