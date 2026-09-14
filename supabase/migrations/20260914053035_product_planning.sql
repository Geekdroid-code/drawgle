-- ============================================================
-- PRODUCT PLANNING STATE
-- Safe to re-run if some/all objects already exist.
-- ============================================================

-- Nullable: existing projects keep normal canvas routing
-- and generation behavior.
--
-- Uses projects' existing owner RLS and realtime publication;
-- no second chat store.

alter table public.projects
  add column if not exists product_planning jsonb;


-- PostgreSQL does not reliably support:
--   ADD CONSTRAINT IF NOT EXISTS
-- so check pg_constraint explicitly.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_product_planning_shape'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_product_planning_shape
      check (
        product_planning is null
        or coalesce(
          (
            jsonb_typeof(product_planning) = 'object'
            and product_planning->>'version' = '1'
            and jsonb_typeof(product_planning->'revision') = 'number'
            and product_planning->>'phase' in ('discovery', 'canvas')
            and jsonb_typeof(product_planning->'blueprint') = 'object'
          ),
          false
        )
      );
  end if;
end;
$$;


comment on column public.projects.product_planning is
  'Versioned product facts and supersession history, separate current design scope, explicit planning phase and turn lease. Server writes use revision compare-and-swap.';


-- ============================================================
-- PROTECT PRODUCT PLANNING STATE
-- ============================================================
--
-- Owners can still edit their usual project fields.
-- Approval/phase/reference state must pass the server validators
-- rather than be forged through the Data API.

create or replace function public.protect_product_planning_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if (
      tg_op = 'INSERT'
      and new.product_planning is not null
    )
    or (
      tg_op = 'UPDATE'
      and new.product_planning is distinct from old.product_planning
    ) then
      raise exception
        'Product planning state is managed by the project agent'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


revoke all
on function public.protect_product_planning_state()
from public, anon, authenticated;


-- Recreate trigger safely in case it already exists.

drop trigger if exists projects_protect_product_planning
on public.projects;

create trigger projects_protect_product_planning
before insert or update
on public.projects
for each row
execute function public.protect_product_planning_state();


-- ============================================================
-- CREATE PLANNING PROJECT
-- ============================================================
--
-- Create the real project and its first message together.
-- A dropped HTTP response can be retried with the same UUID
-- without creating a second project/conversation.

create or replace function public.create_planning_project(
  input_project_id uuid,
  input_owner_id uuid,
  input_name text,
  input_prompt text,
  input_product_planning jsonb,
  input_message_metadata jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_id uuid;
begin
  insert into public.projects (
    id,
    owner_id,
    name,
    prompt,
    status,
    product_planning
  )
  values (
    input_project_id,
    input_owner_id,
    input_name,
    input_prompt,
    'draft',
    input_product_planning
  )
  on conflict (id) do nothing
  returning id into created_id;


  -- The project already exists.
  --
  -- Treat this as an idempotent retry only when the UUID still
  -- belongs to the same owner.
  if created_id is null then
    if not exists (
      select 1
      from public.projects
      where id = input_project_id
        and owner_id = input_owner_id
    ) then
      raise exception 'Project request already used';
    end if;

    return input_project_id;
  end if;


  insert into public.project_messages (
    project_id,
    owner_id,
    role,
    content,
    message_type,
    metadata
  )
  values (
    created_id,
    input_owner_id,
    'user',
    coalesce(
      nullif(input_prompt, ''),
      'Recreate the supplied reference.'
    ),
    'chat',
    input_message_metadata
  );

  return created_id;
end;
$$;


revoke all
on function public.create_planning_project(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.create_planning_project(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  jsonb
)
to service_role;