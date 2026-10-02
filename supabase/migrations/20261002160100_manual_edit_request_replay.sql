-- A deterministic edit retry must be acknowledged before rebuilding operations
-- against the already-edited source (especially deletion and duplication).
create function public.read_design_request_replay(
  input_project_id uuid, input_owner_id uuid, input_context text, input_target_id uuid,
  input_expected_revision bigint, input_request_id uuid, input_origin text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare live jsonb; head public.design_history_heads;
begin
  live := public.read_design_target(input_project_id,input_owner_id,input_context,input_target_id);
  select * into head from public.design_history_heads
    where project_id=input_project_id and context=input_context and target_id=input_target_id;
  if head.last_request_id is distinct from input_request_id then return null; end if;
  if head.last_expected_revision=input_expected_revision
    and head.last_request->>'action'='commit' and head.last_request->>'origin'=input_origin
    and head.revision=(live->>'revision')::bigint and head.live_snapshot=live->'payload' then
    return jsonb_build_object('status','success','revision',head.revision,'replayed',true);
  end if;
  return jsonb_build_object('status','stale_revision');
end $$;
revoke all on function public.read_design_request_replay(uuid,uuid,text,uuid,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.read_design_request_replay(uuid,uuid,text,uuid,bigint,uuid,text) to service_role;
