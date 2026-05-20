create table if not exists public.user_image_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  screen_id uuid null references public.screens(id) on delete set null,
  r2_key text not null unique,
  public_url text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  width integer null,
  height integer null,
  original_filename text null,
  target_drawgle_id text null,
  target_kind text null check (target_kind is null or target_kind in ('img', 'background')),
  created_at timestamptz not null default now()
);

create index if not exists user_image_assets_owner_lookup_idx
on public.user_image_assets(owner_id, created_at desc);

create index if not exists user_image_assets_project_lookup_idx
on public.user_image_assets(project_id, created_at desc);

alter table public.user_image_assets enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_image_assets'
      and policyname = 'user_image_assets_select_own'
  ) then
    create policy user_image_assets_select_own
    on public.user_image_assets
    for select
    using (owner_id = auth.uid());
  end if;
end $$;
