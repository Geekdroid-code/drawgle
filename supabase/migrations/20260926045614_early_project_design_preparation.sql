-- Speculative project-wide design work. Only service workers can access it;
-- accepting a scope never commits these tokens until generation starts.
create table public.product_design_preparations (
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  preparation_key text not null check (preparation_key ~ '^[a-f0-9]{64}$'),
  design_tokens jsonb not null,
  reference_analysis jsonb,
  requirements_key text not null,
  queued_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (project_id, preparation_key)
);

create index product_design_preparations_expiry_idx on public.product_design_preparations (expires_at);
alter table public.product_design_preparations enable row level security;
revoke all on public.product_design_preparations from public, anon, authenticated;
grant select, insert, update, delete on public.product_design_preparations to service_role;

-- Old complete preparations remain complete. New plans can be saved before
-- asset planning; [] alone cannot distinguish pending work from no assets.
alter table public.product_scope_preparations
  add column assets_ready boolean not null default true,
  add column assets_ready_at timestamptz,
  add column queued_at timestamptz;
