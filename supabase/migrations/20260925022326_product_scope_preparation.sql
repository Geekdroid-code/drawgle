-- Service-only speculative work for a reviewable product scope. It is never
-- source truth and cannot create screens or charge credits.
create table public.product_scope_preparations (
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  preparation_key text not null check (preparation_key ~ '^[a-f0-9]{64}$'),
  design_tokens jsonb not null,
  reference_analysis jsonb,
  plan jsonb not null,
  asset_requirements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (project_id, preparation_key)
);

create index product_scope_preparations_expiry_idx on public.product_scope_preparations (expires_at);
alter table public.product_scope_preparations enable row level security;
revoke all on public.product_scope_preparations from public, anon, authenticated;
grant select, insert, update, delete on public.product_scope_preparations to service_role;
