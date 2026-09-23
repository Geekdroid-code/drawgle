-- Additive foundation. Recovery remains gated until every source writer uses CAS.
alter table public.screens add column if not exists design_revision bigint not null default 0;
alter table public.screens add column if not exists last_accepted_code text;
alter table public.projects add column if not exists token_revision bigint not null default 0;
alter table public.project_navigation add column if not exists design_revision bigint not null default 0;

create table public.design_history_heads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  screen_id uuid references public.screens(id) on delete cascade,
  context text not null check (context in ('screen','tokens','navigation')),
  target_id uuid not null,
  cursor bigint not null default 0,
  revision bigint not null,
  live_snapshot jsonb not null,
  last_request_id uuid,
  last_request jsonb,
  last_expected_revision bigint,
  check ((context = 'screen' and screen_id = target_id) or (context <> 'screen' and screen_id is null and target_id = project_id)),
  unique(project_id, context, target_id)
);
create table public.design_history_changes (
  id uuid primary key default gen_random_uuid(),
  head_id uuid not null references public.design_history_heads(id) on delete cascade,
  sequence bigint not null,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  request_id uuid not null,
  label text not null check (length(label) between 1 and 160),
  origin text not null check (length(origin) between 1 and 80),
  created_at timestamptz not null default now(),
  unique(head_id, sequence), unique(head_id, request_id)
);
alter table public.design_history_heads enable row level security;
alter table public.design_history_changes enable row level security;
revoke all on public.design_history_heads, public.design_history_changes from public, anon, authenticated;
grant all on public.design_history_heads, public.design_history_changes to service_role;

create function public.advance_design_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'screens' then
    if old.status = 'ready'::public.screen_status and nullif(old.code,'') is not null then
      new.last_accepted_code := coalesce(old.last_accepted_code,old.code);
    else
      new.last_accepted_code := old.last_accepted_code;
    end if;
    if new.status <> 'ready'::public.screen_status and new.last_accepted_code is not null and new.code is distinct from old.code then
      new.code := old.code;
      new.block_index := old.block_index;
      new.summary := old.summary;
      new.embedding := old.embedding;
    elsif new.status = 'ready'::public.screen_status and new.code is distinct from old.code then
      new.last_accepted_code := new.code;
    end if;
    new.design_revision := old.design_revision + case when new.code is distinct from old.code then 1 else 0 end;
  elsif tg_table_name = 'projects' then
    new.token_revision := old.token_revision + case when new.design_tokens is distinct from old.design_tokens then 1 else 0 end;
  else
    new.design_revision := old.design_revision + case when (new.plan,new.shell_code) is distinct from (old.plan,old.shell_code) or new.design_revision > old.design_revision then 1 else 0 end;
  end if;
  return new;
end;
$$;
create trigger screen_design_revision before update on public.screens for each row execute function public.advance_design_revision();
create trigger token_design_revision before update on public.projects for each row execute function public.advance_design_revision();
create trigger navigation_design_revision before update on public.project_navigation for each row execute function public.advance_design_revision();

create function public.advance_navigation_assignment_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (new.chrome_policy,new.navigation_item_id) is distinct from (old.chrome_policy,old.navigation_item_id) then
    update public.project_navigation set design_revision = design_revision + 1 where project_id = new.project_id;
  end if;
  return new;
end;
$$;
create trigger navigation_assignment_revision after update on public.screens for each row execute function public.advance_navigation_assignment_revision();

-- All entry points use this owner-scoped reader; no arbitrary project fields enter snapshots.
create function public.read_design_target(input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.projects where id = input_project_id and owner_id = input_owner_id) then
    raise exception 'unavailable' using errcode = 'P0002';
  end if;
  if input_context = 'screen' then
    select jsonb_build_object('revision',s.design_revision,'payload',jsonb_build_object('code',s.code),
      'ready',s.status = 'ready'::public.screen_status,
      'acceptedBaseline',s.status = 'ready'::public.screen_status or s.last_accepted_code is not null)
      into result from public.screens s where s.id = input_target_id and s.project_id = input_project_id and s.owner_id = input_owner_id;
  elsif input_target_id <> input_project_id then
    raise exception 'unavailable' using errcode = 'P0002';
  elsif input_context = 'tokens' then
    select jsonb_build_object('revision',p.token_revision,'payload',jsonb_build_object('tokens',p.design_tokens),'ready',true)
      into result from public.projects p where p.id = input_project_id;
  elsif input_context = 'navigation' then
    select jsonb_build_object('revision',n.design_revision,'ready',n.status = 'ready'::public.screen_status,'payload',jsonb_build_object(
      'plan',n.plan,'shellCode',n.shell_code,'assignments',coalesce((select jsonb_agg(jsonb_build_object(
        'screenId',s.id,'chromePolicy',s.chrome_policy,'navigationItemId',s.navigation_item_id,
        'parentScreenId',s.parent_screen_id,'stateKey',s.state_key,'roadmapItemId',s.roadmap_item_id) order by s.id)
        from public.screens s where s.project_id = input_project_id), '[]'::jsonb))) into result
      from public.project_navigation n where n.project_id = input_project_id and n.owner_id = input_owner_id;
  end if;
  if result is null then raise exception 'unavailable' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create function public.apply_design_history(
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
  if input_action not in ('commit','undo','redo','restore') or input_request_id is null then raise exception 'Invalid history operation'; end if;
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
      payload := entry.after_snapshot;
    end if;
    if entry.id is null then return jsonb_build_object('status','unavailable_entry'); end if;
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
  if input_action in ('commit','restore') then
    delete from public.design_history_changes where head_id = head.id and sequence > head.cursor;
    -- Initial accepted output is a baseline, never an undo destination containing a placeholder.
    if input_action = 'restore' or input_context <> 'screen' or was_ready then
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
revoke all on function public.advance_design_revision(), public.advance_navigation_assignment_revision(), public.read_design_target(uuid,uuid,text,uuid), public.apply_design_history(uuid,uuid,text,uuid,bigint,uuid,text,jsonb,uuid,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.advance_design_revision(), public.advance_navigation_assignment_revision(), public.read_design_target(uuid,uuid,text,uuid), public.apply_design_history(uuid,uuid,text,uuid,bigint,uuid,text,jsonb,uuid,text,text,jsonb,uuid) to service_role;

-- Initial shared navigation creation has no previous accepted version. This
-- transaction also handles repair of an existing shell through the history RPC.
create function public.apply_navigation_repair(
  input_project_id uuid, input_owner_id uuid, input_expected_revision bigint,
  input_request_id uuid, input_payload jsonb, input_block_index jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare live_revision bigint; result jsonb;
begin
  perform 1 from public.projects where id = input_project_id and owner_id = input_owner_id for update;
  if not found then raise exception 'unavailable' using errcode = 'P0002'; end if;
  select design_revision into live_revision from public.project_navigation where project_id = input_project_id for update;
  if input_payload is null or jsonb_typeof(input_payload->'plan') <> 'object' or
    jsonb_typeof(input_payload->'shellCode') <> 'string' or jsonb_typeof(input_payload->'assignments') <> 'array' then
    raise exception 'Invalid navigation repair payload';
  end if;
  if (select count(*) from jsonb_array_elements(input_payload->'assignments')) <>
     (select count(*) from public.screens where project_id = input_project_id and owner_id = input_owner_id) or
     exists(select 1 from jsonb_array_elements(input_payload->'assignments') a
       where not exists(select 1 from public.screens s where s.id = (a.value->>'screenId')::uuid
         and s.project_id = input_project_id and s.owner_id = input_owner_id)) or
     (select count(distinct a.value->>'screenId') from jsonb_array_elements(input_payload->'assignments') a) <>
     (select count(*) from public.screens where project_id = input_project_id and owner_id = input_owner_id) then
    return jsonb_build_object('status','incompatible_navigation');
  end if;
  if live_revision is not null then
    return public.apply_design_history(input_project_id,input_owner_id,'navigation',input_project_id,
      input_expected_revision,input_request_id,'commit',input_payload,null,'Repaired shared navigation','repair',input_block_index);
  end if;
  if input_expected_revision is not null then return jsonb_build_object('status','stale_revision'); end if;
  insert into public.project_navigation(project_id,owner_id,plan,shell_code,block_index,status,error)
    values(input_project_id,input_owner_id,input_payload->'plan',input_payload->>'shellCode',input_block_index,'ready'::public.screen_status,null);
  update public.screens s set chrome_policy = nullif(a.value->'chromePolicy','null'::jsonb),
    navigation_item_id = a.value->>'navigationItemId'
    from jsonb_array_elements(input_payload->'assignments') a
    where s.id = (a.value->>'screenId')::uuid and s.project_id = input_project_id;
  result := public.read_design_target(input_project_id,input_owner_id,'navigation',input_project_id);
  return jsonb_build_object('status','success','revision',(result->>'revision')::bigint);
end;
$$;
revoke all on function public.apply_navigation_repair(uuid,uuid,bigint,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_navigation_repair(uuid,uuid,bigint,uuid,jsonb,jsonb) to service_role;

create function public.list_design_history(input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare live jsonb; head public.design_history_heads; fresh boolean;
begin
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  select * into head from public.design_history_heads
    where project_id = input_project_id and context = input_context and target_id = input_target_id;
  fresh := head.id is not null and head.revision = (live->>'revision')::bigint and head.live_snapshot = live->'payload';
  return jsonb_build_object('target',input_context,'revision',(live->>'revision')::bigint,
    'canUndo',fresh and exists(select 1 from public.design_history_changes where head_id = head.id and sequence = head.cursor),
    'canRedo',fresh and exists(select 1 from public.design_history_changes where head_id = head.id and sequence = head.cursor + 1),
    'entries',case when fresh then coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'sequence',c.sequence,'label',c.label,'origin',c.origin,'createdAt',c.created_at,'isCurrent',c.sequence = head.cursor)
      order by c.sequence desc) from public.design_history_changes c where c.head_id = head.id),'[]'::jsonb) else '[]'::jsonb end);
end;
$$;
create function public.read_design_history_entry(input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid, input_entry_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare live jsonb; head public.design_history_heads; result jsonb;
begin
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  select * into head from public.design_history_heads where project_id = input_project_id and context = input_context and target_id = input_target_id;
  if head.id is null or head.revision <> (live->>'revision')::bigint or head.live_snapshot <> live->'payload' then return null; end if;
  select jsonb_build_object('id',c.id,'label',c.label,'createdAt',c.created_at,'payload',c.after_snapshot) into result
    from public.design_history_changes c where c.id = input_entry_id and c.head_id = head.id;
  return result;
end;
$$;
create function public.read_design_history_operation(input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid, input_action text, input_entry_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare live jsonb; head public.design_history_heads; payload jsonb;
begin
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  select * into head from public.design_history_heads where project_id = input_project_id and context = input_context and target_id = input_target_id;
  if head.id is null or head.revision <> (live->>'revision')::bigint or head.live_snapshot <> live->'payload' then return null; end if;
  if input_action = 'undo' then
    select before_snapshot into payload from public.design_history_changes where head_id = head.id and sequence = head.cursor;
  elsif input_action = 'redo' then
    select after_snapshot into payload from public.design_history_changes where head_id = head.id and sequence = head.cursor + 1;
  elsif input_action = 'restore' then
    select after_snapshot into payload from public.design_history_changes where head_id = head.id and id = input_entry_id;
  end if;
  return payload;
end;
$$;
revoke all on function public.list_design_history(uuid,uuid,text,uuid),
  public.read_design_history_entry(uuid,uuid,text,uuid,uuid),
  public.read_design_history_operation(uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.list_design_history(uuid,uuid,text,uuid),
  public.read_design_history_entry(uuid,uuid,text,uuid,uuid),
  public.read_design_history_operation(uuid,uuid,text,uuid,text,uuid) to service_role;

create function public.restore_last_good_screen(input_project_id uuid, input_owner_id uuid,
  input_screen_id uuid, input_expected_revision bigint, input_request_id uuid, input_block_index jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare target public.screens; result_revision bigint;
begin
  perform 1 from public.projects where id = input_project_id and owner_id = input_owner_id for update;
  if not found then raise exception 'unavailable' using errcode = 'P0002'; end if;
  select * into target from public.screens where id = input_screen_id and project_id = input_project_id and owner_id = input_owner_id for update;
  if target.id is null then raise exception 'unavailable' using errcode = 'P0002'; end if;
  if target.design_revision <> input_expected_revision then return jsonb_build_object('status','stale_revision'); end if;
  if exists(select 1 from public.generation_runs where project_id = input_project_id and status in ('queued','planning','building')) then
    return jsonb_build_object('status','busy_target');
  end if;
  if target.status = 'ready'::public.screen_status and target.code = target.last_accepted_code then
    return jsonb_build_object('status','success','revision',target.design_revision,'unchanged',true);
  end if;
  if target.last_accepted_code is null or target.status <> 'failed'::public.screen_status then
    return jsonb_build_object('status','unavailable_entry');
  end if;
  update public.screens set code = target.last_accepted_code, block_index = input_block_index,
    status = 'ready'::public.screen_status,error = null,summary = null,embedding = null
    where id = input_screen_id returning design_revision into result_revision;
  -- The failed transient result is never stored as a redo destination.
  return jsonb_build_object('status','success','revision',result_revision);
end;
$$;
revoke all on function public.restore_last_good_screen(uuid,uuid,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.restore_last_good_screen(uuid,uuid,uuid,bigint,uuid,jsonb) to service_role;
