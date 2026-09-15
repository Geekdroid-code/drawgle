-- Keep functional state writes compatible with the existing canonical identity trigger.
-- Replaces only the server-owned delta RPC; preserves atomic revisions and approval guards.
create or replace function public.update_product_functional_plan(
  input_project_id uuid, input_owner_id uuid, input_revision integer,
  input_state jsonb, input_items jsonb, input_remove_keys text[]
) returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb; parent_id uuid;
begin
  perform 1 from projects where id = input_project_id and owner_id = input_owner_id
    and (product_planning->>'revision')::integer = input_revision for update;
  if not found then raise exception 'Product revision changed' using errcode = '40001'; end if;
  if (input_state->>'revision')::integer <> input_revision + 1 then raise exception 'Invalid next revision'; end if;
  if exists(select 1 from generation_runs r cross join lateral jsonb_array_elements(r.metadata->'productPlanning'->'scope'->'manifest') approved
    where r.project_id = input_project_id and r.owner_id = input_owner_id and approved->>'stableKey' = any(input_remove_keys)) then
    raise exception 'Approved output identities are historical; keep them and create new keys for revised work';
  end if;
  if exists (select 1 from project_screen_roadmap where project_id = input_project_id
    and stable_key = any(input_remove_keys) and status in ('queued','building','ready')) then
    raise exception 'Built or running outputs cannot be removed by product planning';
  end if;
  update project_screen_roadmap set status = 'dismissed' where project_id = input_project_id and owner_id = input_owner_id and stable_key = any(input_remove_keys);
  -- Parent identity is part of the canonical state identity. Never insert states
  -- under a temporary NULL parent, where unrelated parents' states collide.
  for item in select value from jsonb_array_elements(input_items)
    order by case when value->>'kind' = 'screen' then 0 else 1 end loop
    parent_id := null;
    if item->>'kind' = 'state' then
      select id into parent_id from project_screen_roadmap
        where project_id = input_project_id and owner_id = input_owner_id
          and stable_key = item->>'parentStableKey' and kind = 'screen' and status <> 'dismissed';
      if parent_id is null then
        raise exception 'State % requires active parent %', item->>'stableKey', item->>'parentStableKey' using errcode = '23514';
      end if;
    end if;
    if exists(select 1 from generation_runs r cross join lateral jsonb_array_elements(r.metadata->'productPlanning'->'scope'->'manifest') approved
      where r.project_id = input_project_id and r.owner_id = input_owner_id and approved->>'stableKey' = item->>'stableKey' and approved is distinct from item) then
      raise exception 'Use a new output key to revise an approved identity';
    end if;
    if exists (select 1 from project_screen_roadmap where project_id = input_project_id and stable_key = item->>'stableKey'
      and status in ('queued','building','ready') and metadata->'functional' is distinct from item) then
      raise exception 'Use a new output key to redesign an existing or running output';
    end if;
    insert into project_screen_roadmap (project_id, owner_id, parent_item_id, stable_key, kind, name, description, screen_type, priority, source,
      explicitly_requested, sequence, dependency_keys, state_key, state_label, state_role, trigger_label, metadata)
    values (input_project_id, input_owner_id, parent_id, item->>'stableKey', item->>'kind', item->>'name', item->>'description', 'detail', 'required', 'planner', true,
      (item->>'sequence')::integer, array(select jsonb_array_elements_text(item->'dependencyKeys')), item->>'stateKey',
      case when item->>'kind' = 'state' then item->>'name' else null end, 'functional', item->>'triggerLabel', jsonb_build_object('functional',item))
    on conflict (project_id, stable_key) do update set name = excluded.name, description = excluded.description, kind = excluded.kind,
      parent_item_id = excluded.parent_item_id, state_role = excluded.state_role,
      dependency_keys = excluded.dependency_keys, sequence = excluded.sequence, state_key = excluded.state_key, state_label = excluded.state_label,
      trigger_label = excluded.trigger_label, metadata = project_screen_roadmap.metadata || excluded.metadata,
      status = case when project_screen_roadmap.status = 'dismissed' then 'planned' else project_screen_roadmap.status end;
  end loop;
  update projects set product_planning = input_state, updated_at = now() where id = input_project_id and owner_id = input_owner_id;
end $$;
revoke all on function public.update_product_functional_plan(uuid,uuid,integer,jsonb,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.update_product_functional_plan(uuid,uuid,integer,jsonb,jsonb,text[]) to service_role;
