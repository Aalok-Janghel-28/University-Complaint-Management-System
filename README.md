# University Complaint Management System

UCMS combines a React application with a Django REST API for campus complaint reporting, triage, assignment, service levels, staff updates, citizen feedback, and analytics.

## Run locally

1. Create `Backend/.env` from `Backend/.env.example` and set a private `DJANGO_SECRET_KEY`.
2. Install backend packages from `Backend/requirements.txt` in a Python virtual environment.
3. From `Backend/`, run `python manage.py migrate`, then `python manage.py seed_complaints`.
4. Start the API with `python manage.py runserver`.
5. From `FrontEnd/`, run `npm install` and `npm run dev`.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Render, Vercel, and Supabase deployment setup. The repository includes a Render Blueprint and Vercel routing config; platform accounts, database/storage credentials, and the first admin account still need to be configured once.

Demo accounts created by the seed command use `citizen@example.com`, `officer@example.com`, and `admin@example.com`; each is assigned the development password `password123`. Change or remove these accounts before using a deployed system.

## SLA escalation

Department SLA response and resolution targets can be configured in the Admin dashboard. Active overdue complaints are escalated once when the SLA processor runs. The staff queue and analytics also process overdue records when opened. For reliable scheduled processing when no one is using the app, schedule this command to run every five minutes:

```powershell
python manage.py process_sla_escalations
```

Configure a real SMTP provider in `Backend/.env` to deliver password reset links. In local development the default email backend writes reset emails to the Django server console.

## Complaint evidence

Reports accept up to five image or PDF attachments, each limited to 10 MB. Downloads require an authenticated user who can view that complaint. Production deployments should serve uploads from private object storage or an authenticated media service and configure HTTPS, allowed hosts, secrets, and SMTP credentials.

## AI model notes

The bundled classifier and generated training corpus support local triage. Training registry accuracy is measured on training batches and should not be treated as an independent validation score. Use a held-out evaluation corpus before relying on these metrics operationally.
