create extension if not exists pgcrypto;

create type public.project_status as enum (
  'draft',
  'active',
  'queued',
  'generating',
  'failed',
  'completed',
  'archived'
);

create type public.generation_status as enum (
  'queued',
  'planning',
  'building',
  'completed',
  'failed',
  'canceled'
);

create type public.screen_status as enum (
  'queued',
  'building',
  'ready',
  'failed'
);

create type public.message_role as enum (
  'user',
  'model',
  'system'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  prompt text not null default '',
  status public.project_status not null default 'draft',
  design_tokens jsonb,
  next_screen_x integer not null default 4800,
  screen_origin_y integer not null default 4600,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  image_path text,
  requested_screen_count integer,
  status public.generation_status not null default 'queued',
  trigger_run_id text,
  requires_bottom_nav boolean not null default false,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  generation_run_id uuid references public.generation_runs(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  prompt text not null default '',
  code text not null default '',
  status public.screen_status not null default 'queued',
  position_x integer not null,
  position_y integer not null,
  sort_index integer not null,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.screen_messages (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  role public.message_role not null,
  content text not null check (char_length(content) <= 100000),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index screens_project_sort_index_idx on public.screens (project_id, sort_index);
create index projects_owner_created_idx on public.projects (owner_id, created_at desc);
create index generation_runs_owner_created_idx on public.generation_runs (owner_id, created_at desc);
create index generation_runs_project_created_idx on public.generation_runs (project_id, created_at desc);
create index screens_project_status_idx on public.screens (project_id, status, sort_index);
create index screens_owner_project_idx on public.screens (owner_id, project_id);
create index screen_messages_screen_created_idx on public.screen_messages (screen_id, created_at asc);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute procedure public.handle_updated_at();

create trigger set_generation_runs_updated_at
before update on public.generation_runs
for each row execute procedure public.handle_updated_at();

create trigger set_screens_updated_at
before update on public.screens
for each row execute procedure public.handle_updated_at();

create or replace function public.reserve_screen_slots(input_project_id uuid, input_slot_count integer)
returns table (
  sort_index integer,
  position_x integer,
  position_y integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  base_x integer;
  base_y integer;
  next_sort_index integer;
begin
  if input_slot_count is null or input_slot_count <= 0 then
    raise exception 'input_slot_count must be greater than 0';
  end if;

  update public.projects
  set next_screen_x = next_screen_x + (450 * input_slot_count),
      updated_at = timezone('utc', now())
  where id = input_project_id
  returning next_screen_x - (450 * input_slot_count), screen_origin_y
  into base_x, base_y;

  if base_x is null then
    raise exception 'project % not found', input_project_id;
  end if;

  select coalesce(max(s.sort_index), -1) + 1
  into next_sort_index
  from public.screens as s
  where s.project_id = input_project_id;

  return query
  select
    next_sort_index + series.slot,
    base_x + (450 * series.slot),
    base_y
  from generate_series(0, input_slot_count - 1) as series(slot);
end;
$$;

revoke all on function public.reserve_screen_slots(uuid, integer) from public;
revoke all on function public.reserve_screen_slots(uuid, integer) from anon;
revoke all on function public.reserve_screen_slots(uuid, integer) from authenticated;
grant execute on function public.reserve_screen_slots(uuid, integer) to service_role;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.generation_runs enable row level security;
alter table public.screens enable row level security;
alter table public.screen_messages enable row level security;

create policy "Profiles are readable by the owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Profiles are insertable by the owner"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Profiles are updateable by the owner"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Projects are owner-scoped"
on public.projects
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Generation runs are owner-scoped"
on public.generation_runs
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Screens are owner-scoped"
on public.screens
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Screen messages are owner-scoped"
on public.screen_messages
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generation-assets',
  'generation-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Users can read their generation assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'generation-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can upload their generation assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'generation-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their generation assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'generation-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);