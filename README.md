<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Drawgle

Drawgle is being migrated from a Firebase-first prototype into a production-grade Next.js architecture built around:

- Supabase Auth, Postgres, Storage, and Realtime
- Trigger.dev v4 for durable background AI orchestration
- Gemini for planning, design-token generation, screen building, and edits

The live app path now runs through Supabase-backed data, Trigger.dev generation queues, and server-authenticated Next.js routes.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure [.env.local](.env.local):
   `GEMINI_API_KEY`
   `NEXT_PUBLIC_SUPABASE_URL`
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   `SUPABASE_SERVICE_ROLE_KEY`
   `TRIGGER_SECRET_KEY`
   `TRIGGER_PROJECT_REF`
3. Run the app:
   `npm run dev`

## Auth Setup

- Email/password auth is supported through Supabase Auth and works with the login page in this repo.
- Google sign-in stays available, but you must enable the Google provider and configure its Google Cloud credentials in your Supabase project before the OAuth button will work.
- If you use Google OAuth or Supabase email confirmation, add your app URL plus the auth redirect paths to Supabase Auth allowed redirects, including `/auth/callback` and `/auth/confirm`.

## Trigger.dev

- Run the Trigger.dev worker locally with `npm run trigger:dev`
- Deploy tasks with `npm run trigger:deploy`
- GitHub Actions auto-deploys Trigger.dev tasks from `.github/workflows/deploy-trigger.yml` whenever `main` is pushed.
- Add `TRIGGER_ACCESS_TOKEN` and `TRIGGER_PROJECT_REF` as repository secrets before enabling the workflow. The access token must be a Trigger.dev Personal Access Token that starts with `tr_pat_`.
- If you self-host Trigger.dev, also add `TRIGGER_API_URL` as a repository secret so the CLI points at your instance instead of Trigger.dev Cloud.

## Database

- The initial Supabase schema lives in [supabase/migrations/20260417000100_initial_drawgle.sql](supabase/migrations/20260417000100_initial_drawgle.sql)
- The schema includes owner-scoped RLS, generation run tracking, and transactional screen slot reservation
