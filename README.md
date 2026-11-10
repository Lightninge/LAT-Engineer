# Werkvoorbereiding checklist platform

React (Vite) + Supabase. Base checklist, switchable extra modules (boomcheck, boringen, ...), per-phase progress, final check (eindcontrole), activity log, realtime sync and roles enforced with Row Level Security.

## Setup
1. Create a project at supabase.com. In the SQL Editor run `supabase/schema.sql`.
2. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project Settings -> API).
3. `npm install && npm run dev`
4. Register the first account: it automatically becomes **beheerder**. Change other users' roles in Table Editor -> `profiles`.

## Deploy
Push to GitHub, then import the repo in Vercel/Netlify and add the two `VITE_SUPABASE_*` env vars. (GitHub Pages works too: `npm run build`, serve `dist`.)

## Not yet built
Checklistbeheer UI (edit rules in Table Editor -> `rules` meanwhile), checklist versioning, user management UI, document upload, import/export, "my tasks" page.
