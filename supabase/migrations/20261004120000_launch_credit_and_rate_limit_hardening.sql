-- Launch hardening.
--   1. Per-user rate limits for the model calls Drawgle offers without charging credits.
--   2. Credit reservations for AI edits, so an edit can no longer pass a balance check
--      that a parallel edit has already spent.
--   3. No direct client access to credit deductions.
-- Apply this before deploying the code that calls these functions.

-- 1. Rate limits ------------------------------------------------------------

create table if not exists public.api_rate_limits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (owner_id, bucket, window_start)
);

create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits(window_start);

-- No policies: only the service role, which bypasses RLS, reads or writes counters.
alter table public.api_rate_limits enable row level security;

-- Fixed-window counter. A request inside the limit increments the counter and is
-- allowed; a request over the limit leaves the counter alone and is refused.
create or replace function public.consume_rate_limit(
  input_owner_id uuid,
  input_bucket text,
  input_limit integer,
  input_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
begin
  if input_limit < 1
    or input_window_seconds < 1
    or input_window_seconds > 86400
    or nullif(btrim(input_bucket), '') is null then
    raise exception 'Invalid rate limit parameters.' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / input_window_seconds) * input_window_seconds
  );
  v_window_end := v_window_start + make_interval(secs => input_window_seconds);

  insert into public.api_rate_limits as counter (owner_id, bucket, window_start, request_count)
  values (input_owner_id, input_bucket, v_window_start, 1)
  on conflict (owner_id, bucket, window_start)
  do update set request_count = counter.request_count + 1
    where counter.request_count < input_limit
  returning counter.request_count into v_count;

  if v_count is null then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_window_end - clock_timestamp())))::integer)
    );
  end if;

  -- Old windows are dead weight; sweep them now and then instead of running a cron job.
  if random() < 0.01 then
    delete from public.api_rate_limits
    where window_start < clock_timestamp() - interval '2 days';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', input_limit - v_count,
    'retryAfterSeconds', 0
  );
end;
$$;

-- 2. Edit credit reservations ------------------------------------------------
-- Edits reuse public.credit_reservations (output_kind 'edit', no generation run),
-- keyed by the user message that asked for them.

create or replace function public.reserve_edit_credits(
  input_owner_id uuid,
  input_project_id uuid,
  input_output_key text,
  input_amount numeric,
  input_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_balance numeric(10, 2);
begin
  if nullif(btrim(input_output_key), '') is null
    or input_amount is null
    or input_amount <= 0 then
    raise exception 'Invalid edit credit reservation.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.projects
    where id = input_project_id and owner_id = input_owner_id
  ) then
    raise exception 'Edit project ownership mismatch.' using errcode = '42501';
  end if;

  insert into public.credits(user_id, credits)
  values (input_owner_id, 0)
  on conflict (user_id) do nothing;

  -- The balance row lock serialises every reservation for this user, so two edits
  -- started together can never both be funded by the same credits.
  select credits into v_balance
  from public.credits
  where user_id = input_owner_id
  for update;

  select status, amount into v_existing
  from public.credit_reservations
  where owner_id = input_owner_id
    and output_key = input_output_key;

  if found then
    if v_existing.status = 'reserved' then
      return jsonb_build_object(
        'reservedCredits', v_existing.amount,
        'idempotent', true,
        'availableBalance', v_balance
      );
    end if;
    raise exception 'Edit credit reservation was already settled.' using errcode = '55000';
  end if;

  if v_balance < input_amount then
    raise exception 'Insufficient credits. Available: %, Required: %', v_balance, input_amount
      using errcode = 'P0001';
  end if;

  update public.credits
  set credits = credits - input_amount
  where user_id = input_owner_id;

  insert into public.credit_reservations (
    owner_id, project_id, output_key, output_kind, amount, metadata
  )
  values (
    input_owner_id,
    input_project_id,
    input_output_key,
    'edit',
    input_amount,
    coalesce(input_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'reservedCredits', input_amount,
    'idempotent', false,
    'availableBalance', v_balance - input_amount
  );
end;
$$;

create or replace function public.capture_edit_credit(
  input_owner_id uuid,
  input_output_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.credit_reservations
  where owner_id = input_owner_id
    and output_key = input_output_key
    and output_kind = 'edit'
  for update;

  if not found then
    raise exception 'Credit reservation not found.' using errcode = 'P0002';
  end if;
  if v_status = 'captured' then
    return false;
  end if;
  if v_status = 'released' then
    raise exception 'Released credit reservation cannot be captured.' using errcode = '55000';
  end if;

  update public.credit_reservations
  set status = 'captured',
      settled_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where owner_id = input_owner_id
    and output_key = input_output_key;
  return true;
end;
$$;

create or replace function public.release_edit_credit(
  input_owner_id uuid,
  input_output_key text,
  input_reason text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(10, 2);
  v_status text;
begin
  select amount, status into v_amount, v_status
  from public.credit_reservations
  where owner_id = input_owner_id
    and output_key = input_output_key
    and output_kind = 'edit'
  for update;

  if not found or v_status <> 'reserved' then
    return 0;
  end if;

  update public.credits
  set credits = credits + v_amount
  where user_id = input_owner_id;

  update public.credit_reservations
  set status = 'released',
      release_reason = left(input_reason, 500),
      settled_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where owner_id = input_owner_id
    and output_key = input_output_key;
  return v_amount;
end;
$$;

-- An edit worker that dies without settling leaves a reservation behind. Refund it
-- once it expires; generation reservations have their own sweep.
create or replace function public.release_stale_edit_credits(
  input_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_released integer := 0;
begin
  for v_row in
    select owner_id, output_key
    from public.credit_reservations
    where status = 'reserved'
      and output_kind = 'edit'
      and generation_run_id is null
      and expires_at < timezone('utc', now())
    order by expires_at
    limit greatest(input_limit, 1)
    for update skip locked
  loop
    perform public.release_edit_credit(
      v_row.owner_id,
      v_row.output_key,
      'Stale edit reservation expired before it settled.'
    );
    v_released := v_released + 1;
  end loop;
  return v_released;
end;
$$;

-- 3. Grants -------------------------------------------------------------------
-- A signed-in browser could call adjust_user_credits directly with a negative delta
-- and drain its own balance. Only the service role changes credits.

revoke execute on function public.adjust_user_credits(uuid, numeric) from authenticated;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.reserve_edit_credits(uuid, uuid, text, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.capture_edit_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.release_edit_credit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_stale_edit_credits(integer) from public, anon, authenticated;

grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to service_role;
grant execute on function public.reserve_edit_credits(uuid, uuid, text, numeric, jsonb) to service_role;
grant execute on function public.capture_edit_credit(uuid, text) to service_role;
grant execute on function public.release_edit_credit(uuid, text, text) to service_role;
grant execute on function public.release_stale_edit_credits(integer) to service_role;
