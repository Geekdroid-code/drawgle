-- Canonical roadmap identity. Stable keys remain public references, while the
-- fingerprint prevents a second row from representing the same logical item.

alter table public.project_screen_roadmap
  add column if not exists identity_fingerprint text,
  add column if not exists identity_exception boolean not null default false;

create or replace function public.roadmap_identity_fingerprint(
  input_kind text,
  input_name text,
  input_state_key text,
  input_state_label text
)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(
      case
        when input_kind = 'state' then coalesce(nullif(input_state_key, ''), nullif(input_state_label, ''), input_name, '')
        else coalesce(input_name, '')
      end
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

update public.project_screen_roadmap
set identity_fingerprint = public.roadmap_identity_fingerprint(kind, name, state_key, state_label)
where identity_fingerprint is distinct from public.roadmap_identity_fingerprint(kind, name, state_key, state_label);

-- Preserve historical groups that already own multiple real screens. They are
-- legitimate ambiguity and must be reviewed, never silently merged.
with generated_conflicts as (
  select project_id, kind, parent_item_id, identity_fingerprint
  from public.project_screen_roadmap
  where generated_screen_id is not null
  group by project_id, kind, parent_item_id, identity_fingerprint
  having count(*) > 1
)
update public.project_screen_roadmap as item
set identity_exception = true
from generated_conflicts as conflict
where item.project_id = conflict.project_id
  and item.kind = conflict.kind
  and item.parent_item_id is not distinct from conflict.parent_item_id
  and item.identity_fingerprint = conflict.identity_fingerprint;

create index if not exists project_screen_roadmap_identity_audit_idx
  on public.project_screen_roadmap(project_id, kind, parent_item_id, identity_fingerprint);

create or replace function public.enforce_project_screen_roadmap_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conflicting_key text;
begin
  new.identity_fingerprint := public.roadmap_identity_fingerprint(
    new.kind,
    new.name,
    new.state_key,
    new.state_label
  );

  if new.identity_fingerprint = '' then
    raise exception 'Roadmap items require a meaningful identity.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and new.project_id = old.project_id
    and new.kind = old.kind
    and new.parent_item_id is not distinct from old.parent_item_id
    and new.identity_fingerprint = old.identity_fingerprint
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    new.project_id::text || ':' || new.kind || ':' || coalesce(new.parent_item_id::text, '') || ':' || new.identity_fingerprint,
    0
  ));

  select item.stable_key
  into conflicting_key
  from public.project_screen_roadmap as item
  where item.project_id = new.project_id
    and item.kind = new.kind
    and item.parent_item_id is not distinct from new.parent_item_id
    and item.identity_fingerprint = new.identity_fingerprint
    and item.id is distinct from new.id
    and item.stable_key <> new.stable_key
  limit 1;

  if conflicting_key is not null then
    raise exception 'Roadmap identity already exists as stable key %.', conflicting_key
      using errcode = '23505', hint = 'Resolve and reuse the canonical roadmap row instead of inserting an alias.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_project_screen_roadmap_identity on public.project_screen_roadmap;
create trigger enforce_project_screen_roadmap_identity
before insert or update of project_id, kind, parent_item_id, name, state_key, state_label, stable_key
on public.project_screen_roadmap
for each row execute function public.enforce_project_screen_roadmap_identity();

comment on column public.project_screen_roadmap.identity_exception is
  'True only for preserved historical identity conflicts with multiple generated screens.';

create or replace function public.reconcile_project_roadmap_manifest(
  input_owner_id uuid,
  input_project_id uuid,
  input_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  current_item public.project_screen_roadmap%rowtype;
  parent_item public.project_screen_roadmap%rowtype;
  proposed_key text;
  canonical_parent_key text;
  item_identity text;
  aliases jsonb := '{}'::jsonb;
  dependencies text[];
begin
  if auth.uid() is not null and auth.uid() <> input_owner_id then
    raise exception 'Owner mismatch.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects
    where id = input_project_id and owner_id = input_owner_id
  ) then
    raise exception 'Project not found.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(input_items) <> 'array' then
    raise exception 'Roadmap manifest must be an array.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('roadmap:' || input_project_id::text, 0));

  for item in select value from jsonb_array_elements(input_items)
  loop
    continue when item->>'kind' <> 'screen';
    proposed_key := item->>'stable_key';
    item_identity := public.roadmap_identity_fingerprint('screen', item->>'name', null, null);
    current_item := null;
    select row_item.* into current_item
    from public.project_screen_roadmap as row_item
    where row_item.project_id = input_project_id
      and row_item.owner_id = input_owner_id
      and row_item.kind = 'screen'
      and (
        row_item.stable_key = proposed_key
        or (not row_item.identity_exception and row_item.identity_fingerprint = item_identity)
      )
    order by (row_item.generated_screen_id is not null) desc, (row_item.stable_key = proposed_key) desc, row_item.created_at asc
    limit 1;

    if current_item.id is null then
      insert into public.project_screen_roadmap (
        project_id, owner_id, stable_key, kind, screen_type, name, description,
        priority, status, source, explicitly_requested, sequence, tranche,
        dependency_keys, metadata
      ) values (
        input_project_id, input_owner_id, proposed_key, 'screen', nullif(item->>'screen_type', ''),
        item->>'name', coalesce(item->>'description', ''), coalesce(item->>'priority', 'recommended'),
        coalesce(item->>'status', 'planned'), coalesce(item->>'source', 'planner'),
        coalesce((item->>'explicitly_requested')::boolean, false), coalesce((item->>'sequence')::integer, 0),
        coalesce((item->>'tranche')::integer, 1), array[]::text[], coalesce(item->'metadata', '{}'::jsonb)
      ) returning * into current_item;
    else
      update public.project_screen_roadmap
      set screen_type = coalesce(nullif(item->>'screen_type', ''), screen_type),
          name = coalesce(nullif(item->>'name', ''), name),
          description = coalesce(nullif(item->>'description', ''), description),
          priority = coalesce(nullif(item->>'priority', ''), priority),
          status = case when status in ('ready', 'queued', 'building') then status else coalesce(nullif(item->>'status', ''), status) end,
          source = coalesce(nullif(item->>'source', ''), source),
          explicitly_requested = explicitly_requested or coalesce((item->>'explicitly_requested')::boolean, false),
          sequence = coalesce((item->>'sequence')::integer, sequence),
          tranche = coalesce((item->>'tranche')::integer, tranche),
          metadata = metadata || coalesce(item->'metadata', '{}'::jsonb)
      where id = current_item.id
      returning * into current_item;
    end if;
    aliases := aliases || jsonb_build_object(proposed_key, current_item.stable_key);
  end loop;

  for item in select value from jsonb_array_elements(input_items)
  loop
    continue when item->>'kind' <> 'state';
    proposed_key := item->>'stable_key';
    canonical_parent_key := coalesce(aliases->>(item->>'parent_stable_key'), item->>'parent_stable_key');
    select row_item.* into parent_item
    from public.project_screen_roadmap as row_item
    where row_item.project_id = input_project_id
      and row_item.owner_id = input_owner_id
      and row_item.kind = 'screen'
      and row_item.stable_key = canonical_parent_key
    limit 1;
    if parent_item.id is null then
      raise exception 'State parent % is missing.', canonical_parent_key using errcode = '23503';
    end if;

    item_identity := public.roadmap_identity_fingerprint('state', item->>'name', item->>'state_key', item->>'state_label');
    current_item := null;
    select row_item.* into current_item
    from public.project_screen_roadmap as row_item
    where row_item.project_id = input_project_id
      and row_item.owner_id = input_owner_id
      and row_item.kind = 'state'
      and row_item.parent_item_id = parent_item.id
      and (
        row_item.stable_key = proposed_key
        or (not row_item.identity_exception and row_item.identity_fingerprint = item_identity)
      )
    order by (row_item.generated_screen_id is not null) desc, (row_item.stable_key = proposed_key) desc, row_item.created_at asc
    limit 1;

    select coalesce(array_agg(coalesce(aliases->>dependency, dependency)), array[]::text[])
    into dependencies
    from jsonb_array_elements_text(coalesce(item->'dependency_keys', '[]'::jsonb)) as dependency_values(dependency);

    if current_item.id is null then
      insert into public.project_screen_roadmap (
        project_id, owner_id, parent_item_id, stable_key, kind, name, description,
        priority, status, source, explicitly_requested, sequence, tranche,
        dependency_keys, state_key, state_label, state_role, trigger_label, metadata
      ) values (
        input_project_id, input_owner_id, parent_item.id, proposed_key, 'state', item->>'name',
        coalesce(item->>'description', ''), coalesce(item->>'priority', 'recommended'),
        coalesce(item->>'status', 'planned'), coalesce(item->>'source', 'planner'),
        coalesce((item->>'explicitly_requested')::boolean, false), coalesce((item->>'sequence')::integer, 0),
        coalesce((item->>'tranche')::integer, 1), dependencies, item->>'state_key', item->>'state_label',
        item->>'state_role', item->>'trigger_label', coalesce(item->'metadata', '{}'::jsonb)
      ) returning * into current_item;
    else
      update public.project_screen_roadmap
      set parent_item_id = parent_item.id,
          name = coalesce(nullif(item->>'name', ''), name),
          description = coalesce(nullif(item->>'description', ''), description),
          priority = coalesce(nullif(item->>'priority', ''), priority),
          status = case when status in ('ready', 'queued', 'building') then status else coalesce(nullif(item->>'status', ''), status) end,
          source = coalesce(nullif(item->>'source', ''), source),
          explicitly_requested = explicitly_requested or coalesce((item->>'explicitly_requested')::boolean, false),
          sequence = coalesce((item->>'sequence')::integer, sequence),
          tranche = coalesce((item->>'tranche')::integer, tranche),
          dependency_keys = dependencies,
          state_key = coalesce(nullif(item->>'state_key', ''), state_key),
          state_label = coalesce(nullif(item->>'state_label', ''), state_label),
          state_role = coalesce(nullif(item->>'state_role', ''), state_role),
          trigger_label = coalesce(nullif(item->>'trigger_label', ''), trigger_label),
          metadata = metadata || coalesce(item->'metadata', '{}'::jsonb)
      where id = current_item.id
      returning * into current_item;
    end if;
    aliases := aliases || jsonb_build_object(proposed_key, current_item.stable_key);
  end loop;

  return (
    select coalesce(jsonb_agg(to_jsonb(row_item) order by row_item.tranche, row_item.sequence), '[]'::jsonb)
    from public.project_screen_roadmap as row_item
    where row_item.project_id = input_project_id and row_item.owner_id = input_owner_id
  );
end;
$$;

revoke all on function public.reconcile_project_roadmap_manifest(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_project_roadmap_manifest(uuid, uuid, jsonb) to service_role;
