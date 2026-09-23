# Kannada Bharati Website

React multipage website with a Node.js API backend and Supabase database.

## Run Locally

1. Install packages:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in Supabase values:

```bash
cp .env.example .env
```

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

Use `test@gmail.com` as the admin email. Admin can view dashboard data and add classes/events with photo uploads.

## Backend Features

- Member registration and login
- Admin dashboard data
- Donations
- Volunteer submissions
- Contact messages
- Admin-created classes
- Admin-created events
- Supabase-backed persistence with local demo fallback
