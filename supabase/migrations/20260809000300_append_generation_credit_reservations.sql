-- Progressive planners discover optional state outputs after parent-screen credits
-- are already reserved. Append only new, immutable output keys atomically.
create or replace function public.append_generation_credit_reservations(
  input_owner_id uuid,
  input_project_id uuid,
  input_generation_run_id uuid,
  input_outputs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_count integer;
  existing_count integer;
  new_count integer;
  incremental_total numeric(10, 2);
  available_balance numeric(10, 2);
begin
  if jsonb_typeof(input_outputs) <> 'array' or jsonb_array_length(input_outputs) = 0 then
    raise exception 'At least one incremental credit reservation output is required.' using errcode = '22023';
  end if;

  perform 1
  from public.generation_runs
  where id = input_generation_run_id
    and project_id = input_project_id
    and owner_id = input_owner_id
  for update;
  if not found then
    raise exception 'Generation run ownership mismatch.' using errcode = '42501';
  end if;

  select count(*) into requested_count from jsonb_array_elements(input_outputs);
  if requested_count <> (
    select count(distinct entry ->> 'outputKey') from jsonb_array_elements(input_outputs) as entry
  ) or exists (
    select 1 from jsonb_array_elements(input_outputs) as entry
    where nullif(btrim(entry ->> 'outputKey'), '') is null
      or entry ->> 'outputKind' not in ('screen', 'state', 'edit')
      or entry ->> 'amount' is null
      or (entry ->> 'amount')::numeric <= 0
  ) then
    raise exception 'Incremental credit reservation manifest is invalid.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(input_outputs) as entry
    where nullif(entry ->> 'roadmapItemId', '') is not null
      and not exists (
        select 1 from public.project_screen_roadmap as item
        where item.id = (entry ->> 'roadmapItemId')::uuid
          and item.project_id = input_project_id
          and item.owner_id = input_owner_id
      )
  ) then
    raise exception 'Roadmap reservation ownership mismatch.' using errcode = '42501';
  end if;

  perform 1 from public.credit_reservations
  where generation_run_id = input_generation_run_id
  for update;

  if exists (
    select 1
    from jsonb_array_elements(input_outputs) as entry
    join public.credit_reservations as reservation
      on reservation.generation_run_id = input_generation_run_id
     and reservation.output_key = entry ->> 'outputKey'
    where reservation.owner_id <> input_owner_id
       or reservation.project_id <> input_project_id
       or reservation.output_kind <> entry ->> 'outputKind'
       or reservation.amount <> (entry ->> 'amount')::numeric
       or reservation.roadmap_item_id is distinct from nullif(entry ->> 'roadmapItemId', '')::uuid
  ) then
    raise exception 'An existing reservation key has changed immutable fields.' using errcode = '23505';
  end if;

  select count(*) into existing_count
  from public.credit_reservations
  where generation_run_id = input_generation_run_id;

  select count(*), coalesce(sum((entry ->> 'amount')::numeric), 0)
  into new_count, incremental_total
  from jsonb_array_elements(input_outputs) as entry
  where not exists (
    select 1 from public.credit_reservations as reservation
    where reservation.generation_run_id = input_generation_run_id
      and reservation.output_key = entry ->> 'outputKey'
  );

  if existing_count + new_count > 8 then
    raise exception 'Generation run output limit exceeded.' using errcode = '22023';
  end if;

  if new_count = 0 then
    return jsonb_build_object(
      'reservedCredits', 0,
      'outputCount', 0,
      'idempotent', true,
      'availableBalance', (select credits from public.credits where user_id = input_owner_id)
    );
  end if;

  insert into public.credits(user_id, credits)
  values (input_owner_id, 0)
  on conflict (user_id) do nothing;

  select credits into available_balance
  from public.credits
  where user_id = input_owner_id
  for update;
  if available_balance < incremental_total then
    raise exception 'Insufficient credits. Available: %, Required: %', available_balance, incremental_total
      using errcode = 'P0001';
  end if;

  update public.credits set credits = credits - incremental_total where user_id = input_owner_id;

  insert into public.credit_reservations (
    owner_id, project_id, generation_run_id, roadmap_item_id,
    output_key, output_kind, amount, metadata
  )
  select
    input_owner_id,
    input_project_id,
    input_generation_run_id,
    nullif(entry ->> 'roadmapItemId', '')::uuid,
    entry ->> 'outputKey',
    entry ->> 'outputKind',
    (entry ->> 'amount')::numeric,
    coalesce(entry -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(input_outputs) as entry
  where not exists (
    select 1 from public.credit_reservations as reservation
    where reservation.generation_run_id = input_generation_run_id
      and reservation.output_key = entry ->> 'outputKey'
  );

  return jsonb_build_object(
    'reservedCredits', incremental_total,
    'outputCount', new_count,
    'idempotent', false,
    'availableBalance', available_balance - incremental_total
  );
end;
$$;

revoke all on function public.append_generation_credit_reservations(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.append_generation_credit_reservations(uuid, uuid, uuid, jsonb) to service_role;
