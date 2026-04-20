-- Project-level unified chat messages (replaces per-screen screen_messages for the new ChatPanel).

create type public.project_message_type as enum (
  'chat',
  'edit_applied',
  'screen_created',
  'generation_started',
  'generation_completed',
  'error'
);

create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  screen_id uuid references public.screens(id) on delete set null,
  role public.message_role not null,
  content text not null check (char_length(content) <= 100000),
  message_type public.project_message_type not null default 'chat',
  metadata jsonb not null default '{}'::jsonb,
  summary text,
  embedding extensions.vector(768),
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index project_messages_project_created_idx
  on public.project_messages (project_id, created_at asc);

create index project_messages_screen_created_idx
  on public.project_messages (screen_id, created_at asc)
  where screen_id is not null;

create index project_messages_embedding_hnsw_idx
  on public.project_messages
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

-- RLS
alter table public.project_messages enable row level security;

create policy "Project messages are owner-scoped"
  on public.project_messages
  for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Realtime
alter publication supabase_realtime add table public.project_messages;

-- Semantic search RPC (mirrors match_screens)
create or replace function public.match_project_messages(
  query_embedding extensions.vector(768),
  p_project_id uuid,
  match_threshold float default 0.50,
  match_count int default 5
)
returns table (
  message_id uuid,
  role public.message_role,
  content text,
  message_type public.project_message_type,
  screen_id uuid,
  created_at timestamptz,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    pm.id as message_id,
    pm.role,
    pm.content,
    pm.message_type,
    pm.screen_id,
    pm.created_at,
    1 - (pm.embedding <=> query_embedding) as similarity
  from public.project_messages as pm
  where pm.project_id = p_project_id
    and pm.embedding is not null
    and 1 - (pm.embedding <=> query_embedding) >= coalesce(match_threshold, 0.50)
  order by pm.embedding <=> query_embedding asc
  limit least(greatest(coalesce(match_count, 5), 1), 20);
$$;

revoke all on function public.match_project_messages(extensions.vector, uuid, float, int) from public;
revoke all on function public.match_project_messages(extensions.vector, uuid, float, int) from anon;
revoke all on function public.match_project_messages(extensions.vector, uuid, float, int) from authenticated;
grant execute on function public.match_project_messages(extensions.vector, uuid, float, int) to service_role;
