create table if not exists public.visual_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references public.profiles(id) on delete set null,
  created_by_project_id uuid null references public.projects(id) on delete set null,
  subject text not null,
  role text not null,
  asset_type text not null,
  source text not null,
  provider text not null,
  license text null,
  r2_key text not null unique,
  public_url text not null,
  width integer not null,
  height integer not null,
  has_alpha boolean not null default false,
  dominant_colors jsonb not null default '[]'::jsonb,
  safe_area jsonb null,
  tags text[] not null default '{}',
  reuse_key text not null,
  embedding extensions.vector(768) null,
  quality_score numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visual_assets_quality_score_check check (quality_score >= 0 and quality_score <= 1)
);

create index if not exists visual_assets_reuse_key_idx on public.visual_assets(reuse_key);
create index if not exists visual_assets_tags_idx on public.visual_assets using gin(tags);
create index if not exists visual_assets_lookup_idx on public.visual_assets(asset_type, role, has_alpha, quality_score desc);
create index if not exists visual_assets_embedding_hnsw_idx
on public.visual_assets
using hnsw (embedding extensions.vector_cosine_ops)
where embedding is not null;

create table if not exists public.visual_asset_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.visual_assets(id) on delete cascade,
  variant text not null,
  r2_key text not null unique,
  public_url text not null,
  width integer not null,
  height integer not null,
  mime_type text not null,
  byte_size integer null,
  created_at timestamptz not null default now(),
  unique(asset_id, variant)
);

create table if not exists public.asset_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  requirement_id text not null,
  reuse_key text not null,
  provider text not null,
  model text not null,
  fal_request_id text unique,
  status text not null default 'queued',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb null,
  asset_id uuid null references public.visual_assets(id) on delete set null,
  attempts integer not null default 0,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint asset_generation_jobs_status_check check (status in ('queued', 'submitted', 'processing', 'completed', 'failed'))
);

create index if not exists asset_generation_jobs_fal_request_idx on public.asset_generation_jobs(fal_request_id);
create index if not exists asset_generation_jobs_project_idx on public.asset_generation_jobs(project_id, created_at desc);
create index if not exists asset_generation_jobs_status_idx on public.asset_generation_jobs(status, updated_at);

create table if not exists public.project_asset_usages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  screen_id uuid null references public.screens(id) on delete set null,
  generation_run_id uuid null references public.generation_runs(id) on delete set null,
  asset_id uuid not null references public.visual_assets(id) on delete cascade,
  requirement_id text not null,
  screen_name text not null,
  placement_hint text not null,
  created_at timestamptz not null default now(),
  unique(project_id, generation_run_id, requirement_id, asset_id)
);

create index if not exists project_asset_usages_project_idx on public.project_asset_usages(project_id, created_at desc);
create index if not exists project_asset_usages_asset_idx on public.project_asset_usages(asset_id, created_at desc);

alter table public.visual_assets enable row level security;
alter table public.visual_asset_variants enable row level security;
alter table public.asset_generation_jobs enable row level security;
alter table public.project_asset_usages enable row level security;

create policy "Visual assets are readable by owner or public library"
on public.visual_assets
for select
to authenticated
using (owner_id = auth.uid() or owner_id is null);

create policy "Visual asset variants are readable by asset owner or public library"
on public.visual_asset_variants
for select
to authenticated
using (
  exists (
    select 1
    from public.visual_assets as asset
    where asset.id = visual_asset_variants.asset_id
      and (asset.owner_id = auth.uid() or asset.owner_id is null)
  )
);

create policy "Asset generation jobs are owner-scoped"
on public.asset_generation_jobs
for select
to authenticated
using (owner_id = auth.uid());

create policy "Project asset usages are project-owner-scoped"
on public.project_asset_usages
for select
to authenticated
using (
  exists (
    select 1
    from public.projects as project
    where project.id = project_asset_usages.project_id
      and project.owner_id = auth.uid()
  )
);

create or replace function public.match_visual_assets(
  query_embedding extensions.vector(768),
  p_asset_type text default null,
  p_role text default null,
  p_has_alpha boolean default null,
  match_threshold float default 0.58,
  match_count int default 8
)
returns table (
  asset_id uuid,
  public_url text,
  subject text,
  role text,
  asset_type text,
  source text,
  provider text,
  width integer,
  height integer,
  has_alpha boolean,
  tags text[],
  similarity double precision,
  quality_score numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    a.id as asset_id,
    a.public_url,
    a.subject,
    a.role,
    a.asset_type,
    a.source,
    a.provider,
    a.width,
    a.height,
    a.has_alpha,
    a.tags,
    1 - (a.embedding <=> query_embedding) as similarity,
    a.quality_score
  from public.visual_assets as a
  where a.embedding is not null
    and (p_asset_type is null or a.asset_type = p_asset_type)
    and (p_role is null or a.role = p_role)
    and (p_has_alpha is null or a.has_alpha = p_has_alpha)
    and 1 - (a.embedding <=> query_embedding) >= coalesce(match_threshold, 0.58)
  order by a.embedding <=> query_embedding asc, a.quality_score desc
  limit least(greatest(coalesce(match_count, 8), 1), 20);
$$;

revoke all on function public.match_visual_assets(extensions.vector, text, text, boolean, float, int) from public;
revoke all on function public.match_visual_assets(extensions.vector, text, text, boolean, float, int) from anon;
revoke all on function public.match_visual_assets(extensions.vector, text, text, boolean, float, int) from authenticated;
grant execute on function public.match_visual_assets(extensions.vector, text, text, boolean, float, int) to service_role;
