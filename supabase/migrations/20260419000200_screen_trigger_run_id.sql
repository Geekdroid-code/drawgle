-- Add columns to track per-screen Trigger.dev child-run IDs and
-- short-lived public access tokens so the frontend can subscribe to
-- the live code stream via useRealtimeRunWithStreams.

alter table public.screens
  add column if not exists trigger_run_id text,
  add column if not exists stream_public_token text;
