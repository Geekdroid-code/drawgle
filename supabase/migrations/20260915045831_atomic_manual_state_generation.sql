-- Server-only transaction: approval, output identity and run are committed once.
-- Dispatch happens outside the transaction with a run-bound idempotency key.
create or replace function public.claim_screen_state_generation(
  input_project_id uuid, input_owner_id uuid, input_message_id uuid, input_parent_hash text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  msg project_messages; proposal jsonb; parent screens; parent_item project_screen_roadmap;
  state_item project_screen_roadmap; run_id uuid; queued_id uuid; actual_hash text; stable text;
begin
  perform 1 from projects where id = input_project_id and owner_id = input_owner_id for update;
  if not found then raise exception 'Project not found' using errcode = '42501'; end if;
  select * into msg from project_messages where id = input_message_id
    and project_id = input_project_id and owner_id = input_owner_id for update;
  if not found then raise exception 'State request not found' using errcode = '42501'; end if;
  proposal := msg.metadata->'screenStateProposal';
  if proposal->>'approvedGenerationRunId' is not null then
    select id into run_id from generation_runs where id = (proposal->>'approvedGenerationRunId')::uuid
      and project_id = input_project_id and owner_id = input_owner_id;
    if not found then raise exception 'Approved run unavailable'; end if;
    return jsonb_build_object('generationRunId',run_id);
  end if;
  if proposal is null or coalesce(proposal->>'status','pending') <> 'pending'
    or (proposal->>'expiresAt')::timestamptz < now() then raise exception 'State request expired or unavailable' using errcode = '40001'; end if;
  if exists(select 1 from generation_runs where project_id = input_project_id and status in ('queued','planning','building')) then
    raise exception 'Another generation is running. Your state request is saved; retry after it finishes.' using errcode = '40001';
  end if;
  select * into parent from screens where id = (proposal->>'parentScreenId')::uuid
    and project_id = input_project_id and owner_id = input_owner_id for update;
  if not found or parent.status <> 'ready' or parent.code is null or parent.parent_screen_id is not null then
    raise exception 'A ready main screen is required' using errcode = '40001';
  end if;
  actual_hash := encode(sha256(convert_to(parent.code,'UTF8')),'hex');
  if actual_hash <> input_parent_hash or (msg.metadata->>'parentRevisionHash' is not null and msg.metadata->>'parentRevisionHash' <> actual_hash) then
    raise exception 'The parent changed. Reopen Create state to use its latest design.' using errcode = '40001';
  end if;
  select * into parent_item from project_screen_roadmap where id = (proposal->>'parentRoadmapItemId')::uuid
    and project_id = input_project_id and owner_id = input_owner_id for update;
  if not found or parent_item.kind <> 'screen' or parent_item.status <> 'ready'
    or parent_item.generated_screen_id is distinct from parent.id or parent.roadmap_item_id is distinct from parent_item.id then
    raise exception 'Parent roadmap link changed' using errcode = '40001';
  end if;
  if nullif(proposal->>'existingRoadmapItemId','') is not null then
    select * into state_item from project_screen_roadmap where id = (proposal->>'existingRoadmapItemId')::uuid
      and project_id = input_project_id and owner_id = input_owner_id and kind = 'state' and parent_item_id = parent_item.id for update;
    if not found then raise exception 'Planned state no longer belongs to this parent'; end if;
  else
    stable := 'state:manual:' || input_message_id::text;
    insert into project_screen_roadmap(project_id, owner_id, parent_item_id, stable_key, kind, name, description,
      priority, status, source, explicitly_requested, sequence, tranche, dependency_keys, state_key, state_label, state_role, trigger_label, metadata)
    values(input_project_id,input_owner_id,parent_item.id,stable,'state',left(parent_item.name || ' - ' || (proposal->'state'->>'stateLabel'),100),
      proposal->'state'->>'description','required','planned','prompt',true,parent_item.sequence+1,parent_item.tranche,array[parent_item.stable_key],
      proposal->'state'->>'stateKey',proposal->'state'->>'stateLabel',proposal->'state'->>'stateRole',proposal->'state'->>'triggerLabel',
      jsonb_build_object('editInstruction',proposal->'state'->>'editInstruction','defaultSelected',true,'rendering','derived_state')) returning * into state_item;
  end if;
  if state_item.status in ('ready','queued','building') or state_item.generated_screen_id is not null then raise exception 'That state already exists or is building' using errcode = '40001'; end if;
  run_id := gen_random_uuid(); queued_id := gen_random_uuid();
  insert into generation_runs(id,project_id,owner_id,prompt,image_path,requested_screen_count,status,metadata)
    values(run_id,input_project_id,input_owner_id,proposal->>'prompt',null,1,'queued'::public.generation_status,
      jsonb_build_object('requestedFrom','agent-screen-state-approval','proposalMessageId',input_message_id,
        'stateRoadmapItemId',state_item.id,'parentScreenId',parent.id,'queuedMessageId',queued_id,
        'parentRevisionHash',actual_hash,'manualStateDispatchPending',true));
  update project_messages set metadata = jsonb_set(metadata,'{screenStateProposal}',
    proposal || jsonb_build_object('status','approved','approvedGenerationRunId',run_id)) where id = input_message_id;
  insert into project_messages(id,project_id,owner_id,screen_id,role,content,message_type,metadata)
    values(queued_id,input_project_id,input_owner_id,parent.id,'system',
      'Queued ' || (proposal->'state'->>'stateLabel') || ' as a state of ' || parent.name,
      'generation_started',jsonb_build_object('action','generation_queued','generationRunId',run_id,'proposalMessageId',input_message_id,
        'activityKey','run:' || run_id::text || ':summary','ui',jsonb_build_object('variant','action_card')));
  update projects set status = 'queued'::public.project_status, updated_at = now() where id = input_project_id;
  return jsonb_build_object('generationRunId',run_id);
end $$;
revoke all on function public.claim_screen_state_generation(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_screen_state_generation(uuid,uuid,uuid,text) to service_role;

-- A short row lock merges prepared plans without sending a giant metadata
-- equality filter through PostgREST or overwriting concurrent progress updates.
create or replace function public.save_product_prepared_plan(
  input_approval_id uuid, input_owner_id uuid, input_attempt integer, input_key text, input_plan jsonb
) returns boolean language plpgsql security invoker set search_path = public as $$
declare approval generation_runs; cache jsonb;
begin
  select * into approval from generation_runs where id=input_approval_id and owner_id=input_owner_id for update;
  if not found or approval.status = 'canceled' or coalesce((approval.metadata->>'productAttempt')::integer,0) <> input_attempt then return false; end if;
  if input_key !~ '^[a-f0-9]{64}$' or jsonb_typeof(input_plan->'screens') is distinct from 'array'
    or jsonb_typeof(input_plan->'charter') is distinct from 'object' then raise exception 'Invalid prepared plan'; end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into cache from (
    select key,value from jsonb_each(coalesce(approval.metadata->'preparedPlans','{}'::jsonb))
    where key <> input_key order by value->>'preparedAt' desc limit 3
  ) recent;
  update generation_runs set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('preparedPlans',
    cache || jsonb_build_object(input_key,jsonb_build_object('version',1,'plan',input_plan,'preparedAt',clock_timestamp())))
    where id=input_approval_id;
  return true;
end $$;
revoke all on function public.save_product_prepared_plan(uuid,uuid,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.save_product_prepared_plan(uuid,uuid,integer,text,jsonb) to service_role;
