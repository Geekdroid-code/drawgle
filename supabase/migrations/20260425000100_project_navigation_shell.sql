create table if not exists public.project_navigation (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  shell_code text not null default '',
  block_index jsonb,
  status public.screen_status not null default 'queued',
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.screens
  add column if not exists chrome_policy jsonb,
  add column if not exists navigation_item_id text;

create index if not exists project_navigation_owner_project_idx
  on public.project_navigation (owner_id, project_id);

create trigger set_project_navigation_updated_at
before update on public.project_navigation
for each row execute procedure public.handle_updated_at();

alter table public.project_navigation enable row level security;

create policy "Project navigation is owner-scoped"
on public.project_navigation
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

alter publication supabase_realtime add table public.project_navigation;
