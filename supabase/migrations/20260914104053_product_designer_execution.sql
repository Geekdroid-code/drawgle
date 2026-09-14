-- Server-only atomic functional roadmap edits and approved-output fulfillment.
-- The approval coordinator stays active while its one execution child runs.
-- Retain one active top-level generation and one active child per project.
drop index if exists public.generation_runs_project_single_active_idx;
create unique index if not exists generation_runs_project_single_active_idx on public.generation_runs(project_id)
  where status in ('queued','planning','building') and metadata->>'productApprovalId' is null;

drop index if exists public.generation_runs_product_batch_single_active_idx;
create unique index if not exists generation_runs_product_batch_single_active_idx on public.generation_runs(project_id)
  where status in ('queued','planning','building') and metadata->>'productApprovalId' is not null;

create or replace function public.update_product_functional_plan(
  input_project_id uuid, input_owner_id uuid, input_revision integer,
  input_state jsonb, input_items jsonb, input_remove_keys text[]
) returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb;
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
  for item in select value from jsonb_array_elements(input_items) loop
    if exists(select 1 from generation_runs r cross join lateral jsonb_array_elements(r.metadata->'productPlanning'->'scope'->'manifest') approved
      where r.project_id = input_project_id and r.owner_id = input_owner_id and approved->>'stableKey' = item->>'stableKey' and approved is distinct from item) then
      raise exception 'Use a new output key to revise an approved identity';
    end if;
    if exists (select 1 from project_screen_roadmap where project_id = input_project_id and stable_key = item->>'stableKey'
      and status in ('queued','building','ready') and metadata->'functional' is distinct from item) then
      raise exception 'Use a new output key to redesign an existing or running output';
    end if;
    insert into project_screen_roadmap (project_id, owner_id, stable_key, kind, name, description, screen_type, priority, source,
      explicitly_requested, sequence, dependency_keys, state_key, state_label, state_role, trigger_label, metadata)
    values (input_project_id, input_owner_id, item->>'stableKey', item->>'kind', item->>'name', item->>'description', 'detail', 'required', 'planner', true,
      (item->>'sequence')::integer, array(select jsonb_array_elements_text(item->'dependencyKeys')), item->>'stateKey',
      case when item->>'kind' = 'state' then item->>'name' else null end, 'functional', item->>'triggerLabel', jsonb_build_object('functional',item))
    on conflict (project_id, stable_key) do update set name = excluded.name, description = excluded.description, kind = excluded.kind,
      parent_item_id = null, state_role = excluded.state_role,
      dependency_keys = excluded.dependency_keys, sequence = excluded.sequence, state_key = excluded.state_key, state_label = excluded.state_label,
      trigger_label = excluded.trigger_label, metadata = project_screen_roadmap.metadata || excluded.metadata,
      status = case when project_screen_roadmap.status = 'dismissed' then 'planned' else project_screen_roadmap.status end;
  end loop;
  update project_screen_roadmap child set parent_item_id = parent.id
    from project_screen_roadmap parent where child.project_id = input_project_id and parent.project_id = input_project_id
    and parent.stable_key = child.metadata->'functional'->>'parentStableKey';
  update projects set product_planning = input_state, updated_at = now() where id = input_project_id and owner_id = input_owner_id;
end $$;
revoke all on function public.update_product_functional_plan(uuid,uuid,integer,jsonb,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.update_product_functional_plan(uuid,uuid,integer,jsonb,jsonb,text[]) to service_role;

create table if not exists public.product_output_fulfillments (
  approval_id uuid not null references public.generation_runs(id) on delete cascade,
  output_key text not null,
  owner_id uuid not null references public.profiles(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  generation_run_id uuid not null references public.generation_runs(id),
  screen_id uuid null references public.screens(id) on delete set null,
  status text not null default 'claimed' check (status in ('claimed','ready','failed','blocked')),
  primary key (approval_id, output_key)
);
alter table public.product_output_fulfillments enable row level security;
grant select on public.product_output_fulfillments to authenticated;
grant all on public.product_output_fulfillments to service_role;
drop policy if exists "Owners read product fulfillment" on public.product_output_fulfillments;
create policy "Owners read product fulfillment" on public.product_output_fulfillments for select to authenticated using ((select auth.uid()) = owner_id);
create index if not exists product_fulfillment_run_idx on public.product_output_fulfillments(generation_run_id);

create or replace function public.claim_product_generation_batch(input_approval_id uuid, input_owner_id uuid, input_keys text[], input_attempt integer default 0)
returns uuid language plpgsql security invoker set search_path = public as $$
declare approval generation_runs; batch_id uuid; existing_run uuid;
begin
  select * into approval from generation_runs where id = input_approval_id and owner_id = input_owner_id for update;
  if not found or approval.status = 'canceled' then raise exception 'Approval unavailable'; end if;
  if coalesce((approval.metadata->>'productAttempt')::integer,0) <> input_attempt then raise exception 'Coordinator attempt superseded'; end if;
  if cardinality(input_keys) < 1 or cardinality(input_keys) > 8 then raise exception 'Invalid batch size'; end if;
  if exists (select 1 from unnest(input_keys) k where not exists (
    select 1 from jsonb_array_elements(approval.metadata->'productPlanning'->'scope'->'manifest') item where item->>'stableKey' = k
  )) then raise exception 'Output not approved'; end if;
  select generation_run_id into existing_run from product_output_fulfillments
    where approval_id = input_approval_id and output_key = any(input_keys) limit 1;
  if existing_run is not null then
    if exists (select 1 from unnest(input_keys) k where not exists (select 1 from product_output_fulfillments
      where approval_id = input_approval_id and output_key = k and generation_run_id = existing_run)) then raise exception 'Conflicting batch claim'; end if;
    return existing_run;
  end if;
  insert into generation_runs(project_id, owner_id, prompt, status, metadata)
    values (approval.project_id, input_owner_id, approval.prompt, 'queued', jsonb_build_object('productApprovalId', input_approval_id, 'productOutputKeys', to_jsonb(input_keys))) returning id into batch_id;
  insert into product_output_fulfillments(approval_id, output_key, owner_id, project_id, generation_run_id)
    select input_approval_id, k, input_owner_id, approval.project_id, batch_id from unnest(input_keys) k;
  return batch_id;
end $$;
revoke all on function public.claim_product_generation_batch(uuid,uuid,text[],integer) from public, anon, authenticated;
grant execute on function public.claim_product_generation_batch(uuid,uuid,text[],integer) to service_role;

-- Update only this coordinator attempt. A canceled/resumed approval cannot be
-- overwritten by an older task returning from its child run.
create or replace function public.set_product_generation_progress(input_approval_id uuid, input_owner_id uuid,
  input_attempt integer, input_status text, input_progress jsonb, input_error text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare changed_project uuid;
begin
  if input_status is not null and input_status not in ('building','completed','failed') then raise exception 'Invalid coordinator status'; end if;
  update generation_runs set status = coalesce(input_status::public.generation_status,status), error = input_error,
    completed_at = case when input_status in ('completed','failed') then now() else completed_at end,
    metadata = metadata || case when input_progress is null then '{}'::jsonb else jsonb_build_object('productProgress',input_progress) end
    where id = input_approval_id and owner_id = input_owner_id and status <> 'canceled'
      and coalesce((metadata->>'productAttempt')::integer,0) = input_attempt returning project_id into changed_project;
  if changed_project is null then return false; end if;
  if input_status is not null then
    update projects set status = case when input_status = 'building' then 'generating'::public.project_status
      when input_status = 'completed' or exists(select 1 from screens where project_id = changed_project and status = 'ready') then 'completed'::public.project_status else 'failed'::public.project_status end,
      updated_at = now() where id = changed_project and owner_id = input_owner_id;
  end if;
  return true;
end $$;
revoke all on function public.set_product_generation_progress(uuid,uuid,integer,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.set_product_generation_progress(uuid,uuid,integer,text,jsonb,text) to service_role;

create or replace function public.resume_product_generation(input_approval_id uuid, input_owner_id uuid, input_request_id uuid)
returns integer language plpgsql security invoker set search_path = public as $$
declare approval generation_runs; attempt integer;
begin
  select * into approval from generation_runs where id = input_approval_id and owner_id = input_owner_id for update;
  if not found or approval.metadata->'productPlanning'->'scope'->'manifest' is null then raise exception 'Product approval unavailable'; end if;
  if approval.metadata->>'productResumeRequest' = input_request_id::text then return coalesce((approval.metadata->>'productAttempt')::integer,0); end if;
  if approval.status not in ('failed','canceled') then raise exception 'Product generation is not paused'; end if;
  if exists (select 1 from product_output_fulfillments f join generation_runs r on r.id = f.generation_run_id
    where f.approval_id = input_approval_id and r.status in ('planning','building')) then raise exception 'A batch is still running'; end if;
  if exists (select 1 from credit_reservations c join product_output_fulfillments f on f.generation_run_id = c.generation_run_id
    where f.approval_id = input_approval_id and c.status = 'reserved') then raise exception 'Batch credits are still settling'; end if;
  -- Reconcile completed outputs before releasing only failed claims for new attempts.
  update product_output_fulfillments f set status = 'ready', screen_id = s.id
    from screens s join project_screen_roadmap r on r.id = s.roadmap_item_id
    where f.approval_id = input_approval_id and s.generation_run_id = f.generation_run_id and s.status = 'ready' and r.stable_key = f.output_key;
  -- A queued claim may be between database commit and dispatch. Preserve it:
  -- continuation replays the same Trigger idempotency key, including when the
  -- service accepted the task but the original coordinator lost its response.
  delete from product_output_fulfillments f using generation_runs r
    where f.approval_id = input_approval_id and f.status <> 'ready'
      and r.id = f.generation_run_id and r.status in ('failed','canceled','completed');
  attempt = coalesce((approval.metadata->>'productAttempt')::integer,0) + 1;
  update generation_runs set status = 'queued', error = null, completed_at = null,
    metadata = metadata || jsonb_build_object('productAttempt',attempt,'productResumeRequest',input_request_id)
    where id = input_approval_id;
  return attempt;
end $$;
revoke all on function public.resume_product_generation(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.resume_product_generation(uuid,uuid,uuid) to service_role;

create or replace function public.cancel_product_generation(input_approval_id uuid, input_owner_id uuid, input_project_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  update generation_runs set status = 'canceled', completed_at = now()
    where id = input_approval_id and owner_id = input_owner_id and project_id = input_project_id
      and metadata->'productPlanning'->'scope'->'manifest' is not null and metadata->>'productApprovalId' is null
      and status in ('queued','planning','building','failed');
  if not found then return false; end if;
  if not exists(select 1 from generation_runs where project_id = input_project_id and status in ('queued','planning','building')) then
    update projects set status = case when exists(select 1 from screens where project_id = input_project_id and status = 'ready') then 'completed'::public.project_status else 'draft'::public.project_status end,
      updated_at = now() where id = input_project_id and owner_id = input_owner_id;
  end if;
  return true;
end $$;
revoke all on function public.cancel_product_generation(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.cancel_product_generation(uuid,uuid,uuid) to service_role;
