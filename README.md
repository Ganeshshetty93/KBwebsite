# Kannada Bharati Website

React multipage website with a Node.js API backend and Supabase database.

## Run Locally

1. Install packages:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in Supabase, Google, PayPal, SMTP, Twilio, and optional Azure values:

```bash
cp .env.example .env
```

Add `AZURE_STORAGE_CONNECTION_STRING` when profile, class, event, and fundraising images should upload to Azure Blob Storage. Without it, the app keeps the existing inline image fallback for local testing.

3. In Supabase SQL Editor, run:

```sql
-- Use the contents of server/schema.sql
```

4. Start frontend and backend together:

```bash
npm run dev:full
```

Frontend: `http://127.0.0.1:5173`  
Backend: `http://localhost:4000/api`

## Admin

Use `ganeshshetty93@gmail.com` as the admin email. Admin can view dashboard data and add classes/events with photo uploads.

## Backend Features

- Member registration and login
- Admin dashboard data
- Donations
- Volunteer submissions
- Contact messages
- Admin-created classes
- Admin-created events
- Azure Blob Storage image upload when configured
- Supabase-backed persistence with local demo fallback

## Deployment Environment

Set secrets in the hosting dashboard or CLI. Do not commit real keys to this repository.

Required for Google login:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `VITE_GOOGLE_CLIENT_ID`

Required for reCAPTCHA:

- `GOOGLE_RECAPTCHA_SECRET`
- `VITE_GOOGLE_RECAPTCHA_SITE_KEY`

Required for PayPal payments:

- `PAYPAL_ENV` (`live` or `sandbox`)
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `KB_PAYPAL_DONATE_URL`
- `KB_PAYPAL_HOSTED_BUTTON_ID`

Required for SMTP email:

- `EMAIL_SMTP_HOST`
- `EMAIL_SMTP_PORT`
- `EMAIL_SMTP_USER`
- `EMAIL_SMTP_PASS`
- `EMAIL_FROM_ADDRESS`

Required for SMS/phone verification:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_PHONE`

Required app URLs:

- `CLIENT_ORIGIN=https://k-bwebsite-two.vercel.app`
- `APP_BASE_URL=https://k-bwebsite-two.vercel.app`
- `CORS_ALLOWED_ORIGINS=https://k-bwebsite-two.vercel.app,https://k-bwebsite-5is9qdymr-ganesh-shettys-projects.vercel.app`

The server also accepts old ASP.NET-style aliases such as `Google__ClientId`, `PayPal__ClientId`, `PayPal__ClientSecret`, `GoogleReCaptcha__ClientSecret`, and `ConnectionStrings__StorageAccount`, but the plain names above are preferred.

For Vercel, add the variables with:

```bash
vercel env add PAYPAL_CLIENT_ID production
vercel env add PAYPAL_CLIENT_SECRET production
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add VITE_GOOGLE_CLIENT_ID production
vercel env add EMAIL_SMTP_PASS production
vercel env add TWILIO_ACCOUNT_SID production
vercel env add TWILIO_AUTH_TOKEN production
vercel env add TWILIO_FROM_PHONE production
```

After setting Google OAuth, add these authorized origins and redirect/callback URLs in Google Cloud:

- `https://k-bwebsite-two.vercel.app`
- `https://k-bwebsite-5is9qdymr-ganesh-shettys-projects.vercel.app`
- `http://localhost:5173`
