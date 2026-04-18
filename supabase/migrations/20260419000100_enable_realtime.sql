-- Enable Supabase Realtime for the core tables.
-- Without this, postgres_changes subscriptions in the frontend hooks
-- will never receive any events because the tables are not part of the
-- supabase_realtime publication.

alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.screens;
alter publication supabase_realtime add table public.generation_runs;
alter publication supabase_realtime add table public.screen_messages;
