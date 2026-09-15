// Isolated PostgreSQL test of the actual product-designer migration, never production.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { checkManualStateDatabase } from "./lib/check-manual-state-database.mjs";
const { PGlite } = createRequire(resolve(process.argv[2] || "package.json"))("@electric-sql/pglite");
const db = new PGlite();
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const project = "11111111-1111-4111-8111-111111111111";
const root = "22222222-2222-4222-8222-222222222222";
const item = { stableKey: "screen:welcome", kind: "screen", name: "Welcome", description: "Start shopping", sequence: 0, dependencyKeys: [], stateKey: null, parentStableKey: null };
try {
  const initialSchema = await readFile("supabase/migrations/20260417000100_initial_drawgle.sql", "utf8");
  for (const name of ["project_status", "generation_status", "screen_status"]) {
    await db.exec(initialSchema.match(new RegExp(`create type public\\.${name} as enum \\([\\s\\S]*?\\);`))[0]);
  }
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create table profiles(id uuid primary key);
    create table projects(id uuid primary key, owner_id uuid references profiles(id), product_planning jsonb, updated_at timestamptz, status public.project_status);
    create table generation_runs(id uuid primary key default gen_random_uuid(), project_id uuid references projects(id), owner_id uuid references profiles(id), prompt text,
      status public.generation_status, metadata jsonb default '{}', error text, completed_at timestamptz);
    create table screens(id uuid primary key default gen_random_uuid(), generation_run_id uuid references generation_runs(id), status public.screen_status, roadmap_item_id uuid, project_id uuid);
    insert into auth.users values ('${owner}');
    insert into profiles values ('${owner}');
    insert into projects values ('${project}','${owner}','{"version":1,"revision":0,"phase":"discovery","blueprint":{}}', now(), 'draft');
  `);
  const roadmapMigration = await readFile("supabase/migrations/20260714000200_project_roadmap_atomic_credits.sql", "utf8");
  await db.exec(roadmapMigration.match(/create table if not exists public.project_screen_roadmap[\s\S]*?\n\);/)[0]);
  const identityMigration = await readFile("supabase/migrations/20260715000100_roadmap_identity_integrity.sql", "utf8");
  await db.exec(identityMigration.slice(0, identityMigration.indexOf("create or replace function public.reconcile_project_roadmap_manifest")));
  for (const table of ["credits", "credit_reservations"]) await db.exec(roadmapMigration.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`))[0]);
  await db.exec("create unique index credits_user_id_unique_idx on public.credits(user_id)");
  for (const name of ["reserve_generation_credits", "capture_generation_credit", "release_generation_credit"]) {
    await db.exec(roadmapMigration.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`))[0]);
  }
  await db.exec(await readFile("supabase/migrations/20260418000100_single_active_generation_run.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20260914104053_product_designer_execution.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20260914233000_fix_product_generation_progress_coalesce.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20260915030014_product_functional_state_parents.sql", "utf8"));
  await db.exec("grant all on all tables in schema public to service_role; set role service_role;");
  await db.query("insert into credits(user_id,credits) values($1,100)", [owner]);
  const next = { version: 1, revision: 1, phase: "discovery", blueprint: {}, scope: {} };
  const update = "select update_product_functional_plan($1,$2,$3,$4,$5,$6)";
  await db.query(update, [project, owner, 0, JSON.stringify(next), JSON.stringify([item]), []]);
  assert.equal((await db.query("select metadata->'functional' as item from project_screen_roadmap")).rows[0].item.stableKey, item.stableKey);
  await assert.rejects(db.query(update, [project, owner, 0, JSON.stringify(next), "[]", []]), /revision changed/);
  await assert.rejects(db.query(update, [project, owner, 1, JSON.stringify({ ...next, revision: 2 }), JSON.stringify([{ ...item, name: "X".repeat(101) }]), []]), /check constraint/);
  assert.equal((await db.query("select product_planning->>'revision' as revision from projects")).rows[0].revision, "1");
  // Same state name on different parents is valid. Run the real identity trigger.
  await db.exec("begin");
  const otherParent = { ...item, stableKey: "screen:availability", name: "Availability" };
  const states = [item, otherParent].map(parent => ({ ...item, stableKey: `state:${parent.stableKey}:empty`,
    kind: "state", name: "Empty", stateKey: "empty", parentStableKey: parent.stableKey,
    triggerLabel: "No results", editInstruction: "Explain the empty result and how to continue" }));
  await db.query(update, [project, owner, 1, JSON.stringify({ ...next, revision: 2 }), JSON.stringify([...states, otherParent]), []]);
  const linkedStates = (await db.query("select child.stable_key, parent.stable_key as parent from project_screen_roadmap child join project_screen_roadmap parent on parent.id=child.parent_item_id where child.kind='state' order by child.stable_key")).rows;
  assert.equal(linkedStates.length, 2);
  for (const state of states) assert.equal(linkedStates.find(row => row.stable_key === state.stableKey).parent, state.parentStableKey);
  await db.query(update, [project, owner, 2, JSON.stringify({ ...next, revision: 3 }), JSON.stringify([{ ...states[0], description: "Updated empty result" }]), []]);
  assert.equal((await db.query("select parent_item_id from project_screen_roadmap where stable_key=$1", [states[0].stableKey])).rows[0].parent_item_id != null, true);
  await db.exec("savepoint invalid_state");
  await assert.rejects(db.query(update, [project, owner, 3, JSON.stringify({ ...next, revision: 4 }), JSON.stringify([
    { ...states[0], stableKey: "state:missing-parent:empty", parentStableKey: "screen:missing" },
  ]), []]), /requires active parent/);
  await db.exec("rollback to savepoint invalid_state");
  assert.equal((await db.query("select product_planning->>'revision' as revision from projects")).rows[0].revision, "3");
  await assert.rejects(db.query(update, [project, owner, 3, JSON.stringify({ ...next, revision: 4 }), JSON.stringify([
    { ...states[0], stableKey: "state:duplicate:empty" },
  ]), []]), /Roadmap identity already exists/);
  await db.exec("rollback to savepoint invalid_state");
  await db.exec("rollback");
  await db.query("insert into generation_runs(id,project_id,owner_id,prompt,status,metadata) values($1,$2,$3,'Generate','queued',$4)", [root, project, owner, JSON.stringify({ productPlanning: { scope: { manifest: [item, { ...item, stableKey: "screen:next" }] } } })]);
  const claim = "select claim_product_generation_batch($1,$2,$3,coalesce((select (metadata->>'productAttempt')::integer from generation_runs where id=$1),0)) as id";
  const batch = (await db.query(claim, [root, owner, [item.stableKey]])).rows[0].id;
  const reserve = async (runId) => db.query("select reserve_generation_credits($1,$2,$3,$4)", [owner, project, runId, JSON.stringify([{ outputKey: `${runId}:screen:${item.stableKey}`, outputKind: "screen", amount: 20 }])]);
  await reserve(batch); await reserve(batch);
  assert.equal(Number((await db.query("select credits from credits")).rows[0].credits), 80, "Duplicate reservation must not debit twice");
  assert.equal((await db.query(claim, [root, owner, [item.stableKey]])).rows[0].id, batch);
  await assert.rejects(db.query(claim, [root, owner, [item.stableKey, "screen:next"]]), /Conflicting/);
  await assert.rejects(db.query(claim, [root, owner, ["unapproved"]]), /not approved/);
  await assert.rejects(db.query(claim, [root, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", [item.stableKey]]), /unavailable/);
  await db.query("update generation_runs set status='failed' where id=$1", [root]);
  const resume = "select resume_product_generation($1,$2,$3) as attempt";
  const request = "33333333-3333-4333-8333-333333333333";
  await db.query("update generation_runs set status='building' where id=$1", [batch]);
  await assert.rejects(db.query(resume, [root, owner, request]), /still running/);
  await db.query("update generation_runs set status='failed' where id=$1", [batch]);
  await assert.rejects(db.query(resume, [root, owner, request]), /still settling/);
  await db.query("select release_generation_credit($1,$2,$3,'failed')", [owner, batch, `${batch}:screen:${item.stableKey}`]);
  assert.equal(Number((await db.query("select credits from credits")).rows[0].credits), 100);
  await db.query("update product_output_fulfillments set status='failed' where generation_run_id=$1", [batch]);
  assert.equal((await db.query(resume, [root, owner, request])).rows[0].attempt, 1);
  assert.equal((await db.query(resume, [root, owner, request])).rows[0].attempt, 1);
  const retry = (await db.query(claim, [root, owner, [item.stableKey]])).rows[0].id;
  assert.notEqual(retry, batch);
  await reserve(retry);
  const capture = "select capture_generation_credit($1,$2,$3) as captured";
  assert.equal((await db.query(capture, [owner, retry, `${retry}:screen:${item.stableKey}`])).rows[0].captured, true);
  assert.equal((await db.query(capture, [owner, retry, `${retry}:screen:${item.stableKey}`])).rows[0].captured, false);
  await db.query("update product_output_fulfillments set status='ready' where generation_run_id=$1", [retry]);
  await db.query("update generation_runs set status='completed' where id=$1", [retry]);
  await db.query("update generation_runs set status='failed' where id=$1", [root]);
  await db.query(resume, [root, owner, "44444444-4444-4444-8444-444444444444"]);
  assert.equal((await db.query(claim, [root, owner, [item.stableKey]])).rows[0].id, retry);
  await assert.rejects(db.query("select claim_product_generation_batch($1,$2,$3,0)", [root, owner, ["screen:next"]]), /superseded/);
  assert.equal((await db.query("select set_product_generation_progress($1,$2,0,'failed',null,'old coordinator') as changed", [root, owner])).rows[0].changed, false);
  const queued = (await db.query(claim, [root, owner, ["screen:next"]])).rows[0].id;
  await db.query("update generation_runs set status='failed' where id=$1", [root]);
  await db.query(resume, [root, owner, "55555555-5555-4555-8555-555555555555"]);
  assert.equal((await db.query(claim, [root, owner, ["screen:next"]])).rows[0].id, queued, "Recover uncertain dispatch using the same queued claim");
  assert.equal(Number((await db.query("select credits from credits")).rows[0].credits), 80, "Only the successfully delivered retry is charged");
  const cancel = "select cancel_product_generation($1,$2,$3) as canceled";
  assert.equal((await db.query(cancel, [root, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", project])).rows[0].canceled, false);
  assert.equal((await db.query(cancel, [root, owner, project])).rows[0].canceled, true);
  await assert.rejects(db.query(claim, [root, owner, ["screen:next"]]), /unavailable/);
  await checkManualStateDatabase(db, { owner, project });
  await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${owner}';`);
  assert.equal((await db.query("select * from product_output_fulfillments")).rows.length, 2);
  await assert.rejects(db.query(claim, [root, owner, [item.stableKey]]), /permission denied/);
  await assert.rejects(db.query(update, [project, owner, 1, JSON.stringify({ ...next, revision: 2 }), "[]", []]), /permission denied/);
  await db.exec("set request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';");
  assert.equal((await db.query("select * from product_output_fulfillments")).rows.length, 0);
  console.log("PASS: atomic roadmap/revision updates, real identity trigger, parent-linked state insert/update, missing-parent rollback, duplicate-state rejection, enum progress, owner isolation, approved membership, idempotent batch claims, resume safety, completed-output preservation, and reserve/capture/release accounting across retry.");
} finally { await db.close(); }
