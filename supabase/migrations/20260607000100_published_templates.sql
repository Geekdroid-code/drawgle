create table public.published_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version integer not null check (version > 0),
  source_project_id uuid not null references public.projects(id) on delete restrict,
  title text not null,
  description text not null default '',
  prompt text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_current boolean not null default false,
  design_tokens jsonb,
  project_charter jsonb,
  next_screen_x integer not null default 4800,
  screen_origin_y integer not null default 4600,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  content_hash text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (slug, version),
  unique (slug, content_hash)
);

create unique index published_templates_current_slug_idx
  on public.published_templates (slug)
  where is_current;

create table public.published_template_screens (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.published_templates(id) on delete cascade,
  source_screen_id uuid not null,
  name text not null,
  prompt text not null default '',
  code text not null default '',
  position_x integer not null,
  position_y integer not null,
  sort_index integer not null,
  summary text,
  block_index jsonb,
  chrome_policy jsonb,
  navigation_item_id text,
  created_at timestamptz not null default now(),
  unique (template_id, source_screen_id),
  unique (template_id, sort_index)
);

create table public.published_template_navigation (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null unique references public.published_templates(id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  shell_code text not null default '',
  block_index jsonb,
  status public.screen_status not null default 'ready',
  created_at timestamptz not null default now()
);

create table public.published_template_asset_usages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.published_templates(id) on delete cascade,
  template_screen_id uuid references public.published_template_screens(id) on delete cascade,
  asset_id uuid not null references public.visual_assets(id) on delete restrict,
  requirement_id text not null,
  screen_name text not null,
  placement_hint text not null default '',
  created_at timestamptz not null default now(),
  unique (template_id, template_screen_id, requirement_id, asset_id)
);

create table public.published_style_presets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null unique references public.published_templates(id) on delete cascade,
  slug text not null,
  version integer not null check (version > 0),
  title text not null,
  description text not null default '',
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  is_current boolean not null default false,
  style_pack jsonb not null,
  token_seed jsonb,
  creative_direction_seed jsonb,
  design_system_signals jsonb,
  reference_analysis jsonb,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (slug, version)
);

create unique index published_style_presets_current_slug_idx
  on public.published_style_presets (slug)
  where is_current;

create table public.template_instantiations (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.published_templates(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (template_id, owner_id, idempotency_key)
);

create index published_template_screens_template_idx
  on public.published_template_screens (template_id, sort_index);
create index published_template_asset_usages_template_idx
  on public.published_template_asset_usages (template_id);
create index template_instantiations_owner_idx
  on public.template_instantiations (owner_id, created_at desc);

alter table public.published_templates enable row level security;
alter table public.published_template_screens enable row level security;
alter table public.published_template_navigation enable row level security;
alter table public.published_template_asset_usages enable row level security;
alter table public.published_style_presets enable row level security;
alter table public.template_instantiations enable row level security;

create or replace function public.instantiate_published_template(
  p_slug text,
  p_idempotency_key text
)
returns table (
  project_id uuid,
  template_slug text,
  template_version integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_template public.published_templates%rowtype;
  v_project_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;

  select *
  into v_template
  from public.published_templates
  where slug = p_slug
    and is_current
    and status = 'published'
  for share;

  if v_template.id is null then
    raise exception 'Published template not found';
  end if;

  select ti.project_id
  into v_project_id
  from public.template_instantiations ti
  where ti.template_id = v_template.id
    and ti.owner_id = v_owner_id
    and ti.idempotency_key = p_idempotency_key;

  if v_project_id is not null then
    return query select v_project_id, v_template.slug, v_template.version;
    return;
  end if;

  insert into public.projects (
    owner_id, name, prompt, status, design_tokens, project_charter,
    next_screen_x, screen_origin_y
  )
  values (
    v_owner_id,
    left(v_template.title || ' Copy', 100),
    v_template.prompt,
    'completed',
    v_template.design_tokens,
    v_template.project_charter,
    v_template.next_screen_x,
    v_template.screen_origin_y
  )
  returning id into v_project_id;

  insert into public.screens (
    project_id, owner_id, name, prompt, code, status,
    position_x, position_y, sort_index, summary, block_index,
    chrome_policy, navigation_item_id
  )
  select
    v_project_id, v_owner_id, s.name, s.prompt, s.code, 'ready',
    s.position_x, s.position_y, s.sort_index, s.summary, s.block_index,
    s.chrome_policy, s.navigation_item_id
  from public.published_template_screens s
  where s.template_id = v_template.id
  order by s.sort_index;

  insert into public.project_navigation (
    project_id, owner_id, plan, shell_code, block_index, status
  )
  select
    v_project_id, v_owner_id, n.plan, n.shell_code, n.block_index, n.status
  from public.published_template_navigation n
  where n.template_id = v_template.id;

  insert into public.project_asset_usages (
    project_id, screen_id, generation_run_id, asset_id,
    requirement_id, screen_name, placement_hint
  )
  select
    v_project_id,
    cloned.id,
    null,
    u.asset_id,
    u.requirement_id,
    u.screen_name,
    u.placement_hint
  from public.published_template_asset_usages u
  left join public.published_template_screens source_screen
    on source_screen.id = u.template_screen_id
  left join public.screens cloned
    on cloned.project_id = v_project_id
   and cloned.sort_index = source_screen.sort_index
  where u.template_id = v_template.id;

  insert into public.project_messages (
    project_id, owner_id, role, content, message_type, metadata
  )
  values (
    v_project_id,
    v_owner_id,
    'system',
    format('Started from the curated design "%s" (version %s).', v_template.title, v_template.version),
    'chat',
    jsonb_build_object(
      'templateSlug', v_template.slug,
      'templateVersion', v_template.version,
      'freeInstantiation', true
    )
  );

  insert into public.template_instantiations (
    template_id, owner_id, project_id, idempotency_key
  )
  values (
    v_template.id, v_owner_id, v_project_id, p_idempotency_key
  );

  return query select v_project_id, v_template.slug, v_template.version;
exception
  when unique_violation then
    select ti.project_id
    into v_project_id
    from public.template_instantiations ti
    where ti.template_id = v_template.id
      and ti.owner_id = v_owner_id
      and ti.idempotency_key = p_idempotency_key;

    if v_project_id is null then
      raise;
    end if;

    return query select v_project_id, v_template.slug, v_template.version;
end;
$$;

revoke all on table public.published_templates from public, anon, authenticated;
revoke all on table public.published_template_screens from public, anon, authenticated;
revoke all on table public.published_template_navigation from public, anon, authenticated;
revoke all on table public.published_template_asset_usages from public, anon, authenticated;
revoke all on table public.published_style_presets from public, anon, authenticated;
revoke all on table public.template_instantiations from public, anon, authenticated;
revoke all on function public.instantiate_published_template(text, text) from public, anon;
grant execute on function public.instantiate_published_template(text, text) to authenticated;
