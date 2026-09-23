-- A single SQL statement gives every exported screen the same MVCC snapshot.
-- Internal records are returned only to the server, which whitelists the public export.
create or replace function public.read_export_context(input_project_id uuid, input_owner_id uuid, input_screen_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'project', to_jsonb(p),
    'screens', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_index, s.id)
      from public.screens s where s.project_id = p.id and s.owner_id = input_owner_id and s.id = any(input_screen_ids)), '[]'::jsonb),
    'navigation', (select to_jsonb(n) from public.project_navigation n where n.project_id = p.id and n.owner_id = input_owner_id),
    'specificationSources', coalesce((select jsonb_agg(jsonb_build_object(
      'screenId', s.id, 'name', s.name, 'outputKey', rm.stable_key,
      'parentScreenId', s.parent_screen_id, 'stateKey', s.state_key,
      'approvalId', approval.id, 'approvedPlanning', approval.metadata->'productPlanning') order by s.sort_index, s.id)
      from public.screens s
      left join public.project_screen_roadmap rm on rm.id = s.roadmap_item_id and rm.project_id = p.id and rm.owner_id = input_owner_id
      left join public.generation_runs run on run.id = s.generation_run_id and run.project_id = p.id and run.owner_id = input_owner_id
      left join public.generation_runs approval on approval.id::text = coalesce(run.metadata->>'productApprovalId', run.id::text)
        and approval.project_id = p.id and approval.owner_id = input_owner_id
      where s.project_id = p.id and s.owner_id = input_owner_id and s.id = any(input_screen_ids)), '[]'::jsonb)
  ) from public.projects p where p.id = input_project_id and p.owner_id = input_owner_id;
$$;
revoke all on function public.read_export_context(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.read_export_context(uuid, uuid, uuid[]) to service_role;
