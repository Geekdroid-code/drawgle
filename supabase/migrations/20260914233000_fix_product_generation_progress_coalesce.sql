-- Fix COALESCE type mismatch between input_status (text) and generation_runs.status (public.generation_status enum)
create or replace function public.set_product_generation_progress(
  input_approval_id uuid,
  input_owner_id uuid,
  input_attempt integer,
  input_status text,
  input_progress jsonb,
  input_error text
)
returns boolean language plpgsql security invoker set search_path = public as $$
declare changed_project uuid;
begin
  if input_status is not null and input_status not in ('building','completed','failed') then
    raise exception 'Invalid coordinator status';
  end if;

  update generation_runs
  set status = coalesce(input_status::public.generation_status, status),
      error = input_error,
      completed_at = case when input_status in ('completed','failed') then now() else completed_at end,
      metadata = metadata || case when input_progress is null then '{}'::jsonb else jsonb_build_object('productProgress', input_progress) end
  where id = input_approval_id
    and owner_id = input_owner_id
    and status <> 'canceled'
    and coalesce((metadata->>'productAttempt')::integer, 0) = input_attempt
  returning project_id into changed_project;

  if changed_project is null then
    return false;
  end if;

  if input_status is not null then
    update projects
    set status = case
      when input_status = 'building' then 'generating'::public.project_status
      when input_status = 'completed' or exists(select 1 from screens where project_id = changed_project and status = 'ready') then 'completed'::public.project_status
      else 'failed'::public.project_status
    end,
    updated_at = now()
    where id = changed_project and owner_id = input_owner_id;
  end if;

  return true;
end $$;

revoke all on function public.set_product_generation_progress(uuid,uuid,integer,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.set_product_generation_progress(uuid,uuid,integer,text,jsonb,text) to service_role;
