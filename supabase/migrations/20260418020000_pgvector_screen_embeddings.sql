create extension if not exists vector with schema extensions;

alter table public.screens
add column if not exists summary text,
add column if not exists embedding extensions.vector(768);

create index if not exists screens_embedding_hnsw_idx
on public.screens
using hnsw (embedding extensions.vector_cosine_ops)
where embedding is not null;

create or replace function public.match_screens(
  query_embedding extensions.vector(768),
  p_project_id uuid,
  match_threshold float default 0.55,
  match_count int default 5
)
returns table (
  screen_id uuid,
  name text,
  summary text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id as screen_id,
    s.name,
    s.summary,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.screens as s
  where s.project_id = p_project_id
    and s.summary is not null
    and s.embedding is not null
    and 1 - (s.embedding <=> query_embedding) >= coalesce(match_threshold, 0.55)
  order by s.embedding <=> query_embedding asc
  limit least(greatest(coalesce(match_count, 5), 1), 20);
$$;

revoke all on function public.match_screens(extensions.vector, uuid, float, int) from public;
revoke all on function public.match_screens(extensions.vector, uuid, float, int) from anon;
revoke all on function public.match_screens(extensions.vector, uuid, float, int) from authenticated;
grant execute on function public.match_screens(extensions.vector, uuid, float, int) to service_role;