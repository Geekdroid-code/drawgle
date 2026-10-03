-- Where a design's history starts. Generation creates a project's first design system, and its first navigation,
-- as a saved change whose "before" is nothing: no design tokens, or no navigation bar. Undoing it, or restoring what
-- came before it, emptied the project's styles on every screen (or removed its bar), and only Redo, if nothing else
-- had changed since, could bring them back. A screen's first generated version is already a baseline that is never
-- an undo destination; this gives the design system and the navigation the same rule.
--
-- No history is deleted. Such an entry stays in Recent changes, marked as where history starts: it can be restored
-- as it was created, but not undone or restored to before. Existing ones are renamed to say what they were.

create or replace function public.design_history_starting_point(input_context text, input_before jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case input_context
    when 'tokens' then coalesce(jsonb_typeof(input_before->'tokens'->'tokens'), 'missing') <> 'object'
      or input_before->'tokens'->'tokens' = '{}'::jsonb
    when 'navigation' then coalesce(input_before->>'shellCode', '') = ''
    else false
  end
$$;
revoke all on function public.design_history_starting_point(text,jsonb) from public,anon,authenticated;
grant execute on function public.design_history_starting_point(text,jsonb) to service_role;

create or replace function public.apply_design_history(
  input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid,
  input_expected_revision bigint, input_request_id uuid, input_action text,
  input_payload jsonb default null, input_entry_id uuid default null,
  input_label text default 'Saved change', input_origin text default 'manual',
  input_block_index jsonb default null, input_generation_run_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  live jsonb; payload jsonb; request jsonb; head public.design_history_heads;
  entry public.design_history_changes; next_cursor bigint; result_revision bigint; was_ready boolean;
begin
  -- Serialize multi-row navigation updates with other commits, then lock target rows.
  perform 1 from public.projects where id = input_project_id and owner_id = input_owner_id for update;
  if not found then raise exception 'unavailable' using errcode = 'P0002'; end if;
  if input_context = 'screen' then
    perform 1 from public.screens where id = input_target_id and project_id = input_project_id and owner_id = input_owner_id for update;
    if input_generation_run_id is not null and not exists(select 1 from public.screens where id = input_target_id and generation_run_id = input_generation_run_id) then
      return jsonb_build_object('status','stale_revision');
    end if;
  elsif input_context = 'navigation' then
    perform 1 from public.project_navigation where project_id = input_project_id for update;
    perform 1 from public.screens where project_id = input_project_id order by id for update;
  end if;
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  was_ready := (live->>'acceptedBaseline')::boolean;
  request := jsonb_build_object('action',input_action,'payload',input_payload,'entryId',input_entry_id,'label',input_label,'origin',input_origin);
  select * into head from public.design_history_heads where project_id = input_project_id and context = input_context and target_id = input_target_id for update;
  if head.last_request_id = input_request_id then
    if head.last_request = request and head.last_expected_revision = input_expected_revision and head.revision = (live->>'revision')::bigint and head.live_snapshot = live->'payload' then
      return jsonb_build_object('status','success','revision',head.revision,'replayed',true);
    end if;
    return jsonb_build_object('status','stale_revision');
  end if;
  if input_expected_revision <> (live->>'revision')::bigint or input_expected_revision is null then
    return jsonb_build_object('status','stale_revision');
  end if;
  if exists(select 1 from public.design_history_changes where head_id = head.id and request_id = input_request_id) then
    return jsonb_build_object('status','stale_revision');
  end if;
  if input_action not in ('commit','undo','redo','restore','restore-before') or input_request_id is null then raise exception 'Invalid history operation'; end if;
  if input_action <> 'commit' and (
    exists(select 1 from public.generation_runs where project_id = input_project_id and status in ('queued','planning','building'))
    or exists(select 1 from public.project_messages where project_id = input_project_id and created_at > now() - interval '30 minutes'
      and metadata->'editJob'->>'status' in ('queued','running','building','editing'))
  ) then return jsonb_build_object('status','busy_target'); end if;
  if input_context = 'navigation' and input_action <> 'commit' and head.id is not null and
    (select jsonb_agg(value - array['chromePolicy','navigationItemId'] order by value->>'screenId') from jsonb_array_elements(head.live_snapshot->'assignments')) is distinct from
    (select jsonb_agg(value - array['chromePolicy','navigationItemId'] order by value->>'screenId') from jsonb_array_elements(live->'payload'->'assignments')) then
    return jsonb_build_object('status','incompatible_navigation');
  end if;
  -- Direct/old-version writes invalidate the cursor. Reconcile as a fresh baseline, never expose stale undo.
  if head.id is null then
    insert into public.design_history_heads(project_id,screen_id,context,target_id,revision,live_snapshot)
      values(input_project_id,case when input_context = 'screen' then input_target_id else null end,input_context,input_target_id,(live->>'revision')::bigint,live->'payload') returning * into head;
  elsif head.revision <> (live->>'revision')::bigint or head.live_snapshot <> live->'payload' then
    delete from public.design_history_changes where head_id = head.id;
    update public.design_history_heads set cursor = 0, revision = (live->>'revision')::bigint, live_snapshot = live->'payload', last_request_id = null, last_request = null where id = head.id returning * into head;
  end if;
  next_cursor := head.cursor;
  if input_action = 'commit' then payload := input_payload;
  else
    if input_action = 'undo' then
      select * into entry from public.design_history_changes where head_id = head.id and sequence = head.cursor;
      payload := entry.before_snapshot; next_cursor := head.cursor - 1;
    elsif input_action = 'redo' then
      select * into entry from public.design_history_changes where head_id = head.id and sequence = head.cursor + 1;
      payload := entry.after_snapshot; next_cursor := head.cursor + 1;
    else
      select * into entry from public.design_history_changes where head_id = head.id and id = input_entry_id;
      payload := case when input_action = 'restore-before' then entry.before_snapshot else entry.after_snapshot end;
    end if;
    if entry.id is null then return jsonb_build_object('status','unavailable_entry'); end if;
    -- Where history starts (the design system or navigation generation created) has nothing before it to return to.
    if input_action in ('undo','restore-before') and public.design_history_starting_point(input_context,entry.before_snapshot) then
      return jsonb_build_object('status','unavailable_entry');
    end if;
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid design payload'; end if;
  if input_context = 'screen' then
    if jsonb_typeof(payload->'code') <> 'string' or not (payload ? 'code') or length(payload->>'code') = 0 or payload - 'code' <> '{}'::jsonb then raise exception 'Invalid screen payload'; end if;
  elsif input_context = 'tokens' then
    if not (payload ? 'tokens') or jsonb_typeof(payload->'tokens') not in ('object','null') or payload - 'tokens' <> '{}'::jsonb then raise exception 'Invalid token payload'; end if;
  else
    if jsonb_typeof(payload->'plan') <> 'object' or jsonb_typeof(payload->'shellCode') <> 'string' or jsonb_typeof(payload->'assignments') <> 'array' or not (payload ?& array['plan','shellCode','assignments']) or payload - array['plan','shellCode','assignments'] <> '{}'::jsonb then raise exception 'Invalid navigation payload'; end if;
    -- Membership and stable structure must exactly match. Never restore a subset.
    if (select jsonb_agg(value - array['chromePolicy','navigationItemId'] order by value->>'screenId') from jsonb_array_elements(payload->'assignments')) is distinct from
       (select jsonb_agg(value - array['chromePolicy','navigationItemId'] order by value->>'screenId') from jsonb_array_elements(live->'payload'->'assignments')) then
      return jsonb_build_object('status','incompatible_navigation');
    end if;
  end if;
  if payload = live->'payload' then
    update public.design_history_heads set last_request_id = input_request_id,last_request = request,last_expected_revision = input_expected_revision where id = head.id;
    return jsonb_build_object('status','success','revision',head.revision,'unchanged',true);
  end if;
  if input_context = 'screen' then
    update public.screens set code = payload->>'code', block_index = input_block_index, summary = null, embedding = null,
      status = 'ready'::public.screen_status, error = null where id = input_target_id;
  elsif input_context = 'tokens' then
    update public.projects set design_tokens = nullif(payload->'tokens','null'::jsonb) where id = input_project_id;
  else
    update public.project_navigation set plan = payload->'plan',shell_code = payload->>'shellCode',block_index = input_block_index,status = 'ready'::public.screen_status,error = null where project_id = input_project_id;
    update public.screens s set chrome_policy = nullif(a.value->'chromePolicy','null'::jsonb), navigation_item_id = a.value->>'navigationItemId'
      from jsonb_array_elements(payload->'assignments') a where s.id = (a.value->>'screenId')::uuid and s.project_id = input_project_id;
  end if;
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  result_revision := (live->>'revision')::bigint;
  if input_action in ('commit','restore','restore-before') then
    delete from public.design_history_changes where head_id = head.id and sequence > head.cursor;
    -- Initial accepted output is a baseline, never an undo destination containing a placeholder.
    if input_action in ('restore','restore-before') or input_context <> 'screen' or was_ready then
      next_cursor := head.cursor + 1;
      insert into public.design_history_changes(head_id,sequence,before_snapshot,after_snapshot,request_id,label,origin)
        values(head.id,next_cursor,head.live_snapshot,payload,input_request_id,input_label,input_origin);
      delete from public.design_history_changes where head_id = head.id and sequence <= next_cursor - 20;
    end if;
  end if;
  update public.design_history_heads set cursor = next_cursor,revision = result_revision,live_snapshot = payload,
    last_request_id = input_request_id,last_request = request,last_expected_revision = input_expected_revision where id = head.id;
  return jsonb_build_object('status','success','revision',result_revision);
end;
$$;

create or replace function public.list_design_history(input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare live jsonb; head public.design_history_heads; fresh boolean;
begin
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  select * into head from public.design_history_heads
    where project_id = input_project_id and context = input_context and target_id = input_target_id;
  fresh := head.id is not null and head.revision = (live->>'revision')::bigint and head.live_snapshot = live->'payload';
  return jsonb_build_object('target',input_context,'revision',(live->>'revision')::bigint,
    'canUndo',fresh and exists(select 1 from public.design_history_changes where head_id = head.id and sequence = head.cursor
      and not public.design_history_starting_point(input_context,before_snapshot)),
    'canRedo',fresh and exists(select 1 from public.design_history_changes where head_id = head.id and sequence = head.cursor + 1),
    'entries',case when fresh then coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'sequence',c.sequence,'label',c.label,'origin',c.origin,'createdAt',c.created_at,'isCurrent',c.sequence = head.cursor,
      'startingPoint',public.design_history_starting_point(input_context,c.before_snapshot))
      order by c.sequence desc) from public.design_history_changes c where c.head_id = head.id),'[]'::jsonb) else '[]'::jsonb end);
end;
$$;

create or replace function public.read_design_history_entry(input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid, input_entry_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare live jsonb; head public.design_history_heads; result jsonb;
begin
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  select * into head from public.design_history_heads where project_id = input_project_id and context = input_context and target_id = input_target_id;
  if head.id is null or head.revision <> (live->>'revision')::bigint or head.live_snapshot <> live->'payload' then return null; end if;
  select jsonb_build_object('id',c.id,'label',c.label,'createdAt',c.created_at,'payload',c.after_snapshot,'beforePayload',c.before_snapshot,'startingPoint',public.design_history_starting_point(input_context,c.before_snapshot)) into result
    from public.design_history_changes c where c.id = input_entry_id and c.head_id = head.id;
  return result;
end;
$$;

update public.design_history_changes c set label = 'Created the design system'
  from public.design_history_heads h
  where h.id = c.head_id and h.context = 'tokens' and c.label in ('Updated generated design tokens','Saved generation design tokens')
    and public.design_history_starting_point('tokens',c.before_snapshot);
update public.design_history_changes c set label = 'Created the navigation'
  from public.design_history_heads h
  where h.id = c.head_id and h.context = 'navigation' and c.label = 'Updated shared navigation'
    and public.design_history_starting_point('navigation',c.before_snapshot);
