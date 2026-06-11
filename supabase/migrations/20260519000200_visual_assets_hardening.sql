alter table public.visual_assets
  add column if not exists visibility text not null default 'owner_private',
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_score numeric null,
  add column if not exists verification_notes text null,
  add column if not exists content_hash text null,
  add column if not exists mime_type text null,
  add column if not exists byte_size integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'visual_assets_visibility_check'
  ) then
    alter table public.visual_assets
      add constraint visual_assets_visibility_check
      check (visibility in ('public_reusable', 'owner_private', 'project_private'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'visual_assets_verification_status_check'
  ) then
    alter table public.visual_assets
      add constraint visual_assets_verification_status_check
      check (verification_status in ('pending', 'verified', 'rejected', 'skipped'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'visual_assets_verification_score_check'
  ) then
    alter table public.visual_assets
      add constraint visual_assets_verification_score_check
      check (verification_score is null or (verification_score >= 0 and verification_score <= 1));
  end if;
end $$;

update public.visual_assets
set
  visibility = coalesce(visibility, 'owner_private'),
  verification_status = coalesce(verification_status, 'pending')
where visibility is null or verification_status is null;

create index if not exists visual_assets_visibility_lookup_idx
on public.visual_assets(visibility, owner_id, created_by_project_id, asset_type, has_alpha, quality_score desc);

create index if not exists visual_assets_content_hash_idx
on public.visual_assets(content_hash)
where content_hash is not null;

create unique index if not exists visual_assets_public_content_dedupe_idx
on public.visual_assets(content_hash, visibility, asset_type, has_alpha)
where content_hash is not null
  and visibility = 'public_reusable'
  and verification_status in ('verified', 'skipped');

create or replace function public.match_visual_assets(
  query_embedding extensions.vector(768),
  p_asset_type text default null,
  p_role text default null,
  p_has_alpha boolean default null,
  p_owner_id uuid default null,
  p_project_id uuid default null,
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
    and a.verification_status in ('verified', 'skipped')
    and (
      a.visibility = 'public_reusable'
      or (p_owner_id is not null and a.visibility = 'owner_private' and a.owner_id = p_owner_id)
      or (p_project_id is not null and a.visibility = 'project_private' and a.created_by_project_id = p_project_id)
    )
    and (p_asset_type is null or a.asset_type = p_asset_type)
    and (p_role is null or a.role = p_role)
    and (p_has_alpha is null or a.has_alpha = p_has_alpha)
    and 1 - (a.embedding <=> query_embedding) >= coalesce(match_threshold, 0.58)
  order by a.embedding <=> query_embedding asc, a.quality_score desc
  limit least(greatest(coalesce(match_count, 8), 1), 20);
$$;

revoke all on function public.match_visual_assets(extensions.vector, text, text, boolean, uuid, uuid, float, int) from public;
revoke all on function public.match_visual_assets(extensions.vector, text, text, boolean, uuid, uuid, float, int) from anon;
revoke all on function public.match_visual_assets(extensions.vector, text, text, boolean, uuid, uuid, float, int) from authenticated;
grant execute on function public.match_visual_assets(extensions.vector, text, text, boolean, uuid, uuid, float, int) to service_role;
