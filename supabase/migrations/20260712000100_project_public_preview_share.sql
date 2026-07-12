alter table public.projects
  add column if not exists public_preview_token uuid,
  add column if not exists public_preview_enabled boolean not null default false,
  add column if not exists public_preview_created_at timestamptz;

create unique index if not exists projects_public_preview_token_idx
  on public.projects (public_preview_token)
  where public_preview_token is not null;
