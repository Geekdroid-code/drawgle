alter table public.screens
  add column if not exists parent_screen_id uuid references public.screens(id) on delete set null,
  add column if not exists state_key text,
  add column if not exists state_label text,
  add column if not exists state_role text;

create index if not exists screens_project_parent_screen_idx
  on public.screens (project_id, parent_screen_id);

create index if not exists screens_project_state_key_idx
  on public.screens (project_id, state_key)
  where state_key is not null;
