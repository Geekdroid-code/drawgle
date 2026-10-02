// Isolated PostgreSQL engine tests. Pass the package.json path of a temporary PGlite installation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const realPostgres = process.argv.includes("--postgres");
const db = realPostgres
  ? await (await import("./design-history/postgres-test-client.mjs")).createPostgresTestClient(process.argv[2])
  : new (createRequire(resolve(process.argv[2] || "package.json"))("@electric-sql/pglite").PGlite)();
const owner = randomUUID(), project = randomUUID(), screen = randomUUID();
try {
  await db.exec(`
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
    end $$;
    create type public.screen_status as enum ('queued','building','ready','failed');
    create table public.projects(id uuid primary key, owner_id uuid, design_tokens jsonb, product_planning jsonb);
    create table public.generation_runs(id uuid primary key, project_id uuid, owner_id uuid, status text, metadata jsonb);
    create table public.screens(id uuid primary key, project_id uuid references projects(id) on delete cascade, owner_id uuid,
      generation_run_id uuid, roadmap_item_id uuid, name text, code text, status public.screen_status, sort_index integer default 0,
      chrome_policy jsonb, navigation_item_id text, parent_screen_id uuid, state_key text, block_index jsonb, summary text, embedding real[],error text);
    create table public.project_navigation(id uuid primary key, project_id uuid unique references projects(id) on delete cascade, owner_id uuid,
      plan jsonb,shell_code text,status public.screen_status,block_index jsonb,error text);
    create table public.project_screen_roadmap(id uuid primary key,project_id uuid,owner_id uuid,stable_key text);
    create table public.project_messages(project_id uuid,metadata jsonb,created_at timestamptz default now());
  `);
  await db.exec(await readFile("supabase/migrations/20260922120107_developer_export_context.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20260922120546_contextual_design_history.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261002160100_manual_edit_request_replay.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261002164500_history_before_snapshot_restore.sql", "utf8"));
  await db.exec("grant all on all tables in schema public to service_role;");
  await db.query("insert into projects(id,owner_id,design_tokens) values($1,$2,'{}')", [project,owner]);
  await db.query("insert into screens(id,project_id,owner_id,name,code,status) values($1,$2,$3,'One','A','ready')", [screen,project,owner]);
  await db.exec("set role service_role");
  const read = async (context = "screen", target = screen) => (await db.query("select read_design_target($1,$2,$3,$4) as value", [project,owner,context,target])).rows[0].value;
  const op = async (action, payload = null, options = {}) => (await db.query("select apply_design_history($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as value",
    [project, options.owner ?? owner, options.context ?? "screen", options.target ?? screen, options.revision ?? (await read(options.context,options.target)).revision,
      options.requestId ?? randomUUID(), action, payload && JSON.stringify(payload), options.entryId ?? null, "Test change", "test"])).rows[0].value;
  const first = randomUUID();
  assert.equal((await op("commit",{code:"B"},{revision:0,requestId:first})).revision,1);
  assert.equal((await op("commit",{code:"B"},{revision:0,requestId:first})).replayed,true);
  const replay = async (requestId, revision, origin = "test", claimant = owner) => (await db.query("select read_design_request_replay($1,$2,'screen',$3,$4,$5,$6) as value",[project,claimant,screen,revision,requestId,origin])).rows[0].value;
  assert.equal((await replay(first,0)).replayed,true);
  assert.equal((await replay(first,0,"different-body")).status,"stale_revision");
  assert.equal(await replay(randomUUID(),0),null);
  await assert.rejects(replay(first,0,"test",randomUUID()),/unavailable/);
  assert.equal((await op("commit",{code:"stale"},{revision:0})).status,"stale_revision");
  await op("commit",{code:"C"});
  assert.equal(await replay(first,0),null);
  assert.equal((await op("commit",{code:"B"},{revision:0,requestId:first})).status,"stale_revision");
  const undoRequest = randomUUID();
  await op("undo",null,{revision:2,requestId:undoRequest});
  assert.equal((await read()).payload.code,"B");
  assert.equal((await op("undo",null,{revision:2,requestId:undoRequest})).replayed,true);
  await op("undo"); assert.equal((await read()).payload.code,"A");
  await op("redo"); assert.equal((await read()).payload.code,"B");
  await op("commit",{code:"D"}); assert.equal((await op("redo")).status,"unavailable_entry");
  const entryId = (await db.query("select id from design_history_changes order by sequence limit 1")).rows[0].id;
  await op("restore",null,{entryId}); assert.equal((await read()).payload.code,"B");
  await op("undo"); assert.equal((await read()).payload.code,"D");
  // Reproduce the reported deletion: selecting its history entry must restore BEFORE.
  const deletionScreen = randomUUID();
  const originalCard = '<main><span data-drawgle-id="small">Restore me</span><p>Keep</p></main>';
  const deletedCard = '<main><p>Keep</p></main>';
  await db.query("insert into screens(id,project_id,owner_id,name,code,status) values($1,$2,$3,'Deletion fixture',$4,'ready')",[deletionScreen,project,owner,originalCard]);
  await op("commit",{code:deletedCard},{target:deletionScreen});
  const deletionEntry = (await db.query("select (list_design_history($1,$2,'screen',$3)->'entries'->0->>'id')::uuid as id",[project,owner,deletionScreen])).rows[0].id;
  const deletionPreview = (await db.query("select read_design_history_entry($1,$2,'screen',$3,$4) as value",[project,owner,deletionScreen,deletionEntry])).rows[0].value;
  assert.equal(deletionPreview.beforePayload.code,originalCard); assert.equal(deletionPreview.payload.code,deletedCard);
  const restoreDeletedRequest = randomUUID();
  const deletionRevision = (await read("screen",deletionScreen)).revision;
  const restored = await op("restore-before",null,{target:deletionScreen,entryId:deletionEntry,revision:deletionRevision,requestId:restoreDeletedRequest});
  assert.equal(restored.status,"success"); assert.equal((await read("screen",deletionScreen)).payload.code,originalCard);
  assert.equal((await op("restore-before",null,{target:deletionScreen,entryId:deletionEntry,revision:deletionRevision,requestId:restoreDeletedRequest})).replayed,true);
  await op("undo",null,{target:deletionScreen}); assert.equal((await read("screen",deletionScreen)).payload.code,deletedCard);
  await op("redo",null,{target:deletionScreen}); assert.equal((await read("screen",deletionScreen)).payload.code,originalCard);
  await db.query("delete from screens where id=$1",[deletionScreen]);
  const rev = (await read()).revision;
  await db.query("update screens set summary='memory' where id=$1",[screen]);
  assert.equal((await read()).revision,rev);
  await op("commit",{tokens:{color:"red"}},{context:"tokens",target:project});
  assert.equal((await read()).revision,rev);
  await op("commit",{code:"memory target"});
  await db.query("update screens set summary='stale enrichment' where id=$1 and design_revision=$2",[screen,rev]);
  assert.equal((await db.query("select summary from screens where id=$1",[screen])).rows[0].summary,null);
  for(let i=0;i<23;i++) await op("commit",{code:`retained-${i}`});
  assert.equal((await db.query("select count(*)::integer as count from design_history_changes c join design_history_heads h on h.id=c.head_id where h.context='screen'")).rows[0].count,20);
  for(let i=0;i<20;i++) assert.equal((await op("undo")).status,"success");
  assert.equal((await op("undo")).status,"unavailable_entry");
  assert.equal((await read()).payload.code,"retained-2");
  // An older application changes source without capture: stale cursor is discarded.
  await db.query("update screens set code='external' where id=$1",[screen]);
  assert.equal((await op("undo")).status,"unavailable_entry");
  assert.equal((await read()).payload.code,"external");
  await assert.rejects(op("commit",{code:"wrong owner"},{owner:randomUUID(),revision:0}),/unavailable/);
  await db.exec("reset role; create function reject_history() returns trigger language plpgsql as $$begin raise exception 'injected failure'; end;$$; create trigger fail_history before insert on design_history_changes for each row execute function reject_history(); set role service_role;");
  await assert.rejects(op("commit",{code:"must rollback"}),/injected failure/);
  assert.equal((await read()).payload.code,"external");
  await db.exec("reset role; drop trigger fail_history on design_history_changes; set role service_role;");
  await db.query("insert into generation_runs(id,project_id,owner_id,status) values($1,$2,$3,'building')",[randomUUID(),project,owner]);
  assert.equal((await op("undo")).status,"busy_target");
  await db.query("delete from generation_runs where project_id=$1",[project]);
  await db.query("insert into project_messages values($1,$2)",[project,JSON.stringify({editJob:{status:"editing"}})]);
  assert.equal((await op("undo")).status,"busy_target");
  await db.query("delete from project_messages where project_id=$1",[project]);
  await db.query("insert into project_navigation(id,project_id,owner_id,plan,shell_code,status) values($1,$2,$3,'{}','nav-A','ready')",[randomUUID(),project,owner]);
  const nav = (await read("navigation",project)).payload;
  await op("commit",{...nav,shellCode:"nav-B"},{context:"navigation",target:project});
  await op("undo",null,{context:"navigation",target:project});
  assert.equal((await read("navigation",project)).payload.shellCode,"nav-A");
  await op("redo",null,{context:"navigation",target:project});
  const navEntry = (await db.query("select c.id from design_history_changes c join design_history_heads h on h.id=c.head_id where h.context='navigation'")).rows[0].id;
  const historyListing = (await db.query("select list_design_history($1,$2,'navigation',$1) as value",[project,owner])).rows[0].value;
  assert.equal(historyListing.entries.length,1);
  assert.equal((await db.query("select read_design_history_entry($1,$2,'navigation',$1,$3) as value",
    [project,owner,navEntry])).rows[0].value.id,navEntry);
  await assert.rejects(db.query("select list_design_history($1,$2,'navigation',$1)",[project,randomUUID()]),/unavailable/);
  // Structural changes invalidate the complete navigation restore.
  await db.query("update screens set state_key='changed' where id=$1",[screen]);
  const rejected = await op("restore",null,{context:"navigation",target:project,entryId:navEntry});
  assert.equal(rejected.status,"incompatible_navigation");
  const currentNav = await read("navigation",project);
  assert.equal((await op("commit",nav,{context:"navigation",target:project})).status,"incompatible_navigation");
  assert.deepEqual(await read("navigation",project),currentNav);
  const initialScreen = randomUUID();
  await db.query("insert into screens(id,project_id,owner_id,code,status) values($1,$2,$3,'placeholder','building')",[initialScreen,project,owner]);
  await op("commit",{code:"first accepted"},{target:initialScreen});
  assert.equal((await op("undo",null,{target:initialScreen})).status,"unavailable_entry");
  await db.query("delete from screens where id=$1",[initialScreen]);
  const snapshot = await db.query("select read_export_context($1,$2,$3) as value",[project,owner,[screen]]);
  assert.equal(snapshot.rows[0].value.screens[0].code,"external");
  const approvalId = randomUUID(), batchId = randomUUID(), roadmapId = randomUUID();
  await db.query("insert into generation_runs(id,project_id,owner_id,status,metadata) values($1,$2,$3,'completed',$4)",
    [approvalId,project,owner,JSON.stringify({productPlanning:{scope:{status:"approved",manifest:[{stableKey:"stable-one"}]}}})]);
  await db.query("insert into generation_runs(id,project_id,owner_id,status,metadata) values($1,$2,$3,'completed',$4)",
    [batchId,project,owner,JSON.stringify({productApprovalId:approvalId})]);
  await db.query("insert into project_screen_roadmap values($1,$2,$3,'stable-one')",[roadmapId,project,owner]);
  await db.query("update screens set generation_run_id=$1,roadmap_item_id=$2 where id=$3",[batchId,roadmapId,screen]);
  const linked = (await db.query("select read_export_context($1,$2,$3) as value",[project,owner,[screen]])).rows[0].value;
  assert.equal(linked.specificationSources[0].approvalId,approvalId);
  assert.equal(linked.specificationSources[0].outputKey,"stable-one");
  assert.equal(linked.specificationSources[0].approvedPlanning.scope.status,"approved");
  const beforeFailedGeneration = await read();
  await db.query("update screens set status='building',code='temporary placeholder' where id=$1",[screen]);
  await db.query("update screens set status='failed',code='failed generation' where id=$1",[screen]);
  assert.equal((await read()).payload.code,beforeFailedGeneration.payload.code);
  assert.equal((await read()).revision,beforeFailedGeneration.revision);
  const restoredLastGood = (await db.query("select restore_last_good_screen($1,$2,$3,$4,$5,$6) as value",
    [project,owner,screen,beforeFailedGeneration.revision,randomUUID(),JSON.stringify({blocks:[]})])).rows[0].value;
  assert.equal(restoredLastGood.status,"success");
  assert.equal((await db.query("select status from screens where id=$1",[screen])).rows[0].status,"ready");
  const secondScreen = randomUUID();
  await db.query("insert into screens(id,project_id,owner_id,name,code,status) values($1,$2,$3,'Two','second screen','ready')", [secondScreen,project,owner]);
  const navBeforeFailure = await read("navigation",project);
  await db.exec("reset role; create function reject_assignment() returns trigger language plpgsql as $$begin if new.navigation_item_id='explode' then raise exception 'injected nav failure'; end if; return new; end;$$; create trigger fail_assignment before update on screens for each row execute function reject_assignment(); set role service_role;");
  const navPayload = { ...navBeforeFailure.payload, shellCode:"nav-C", assignments: navBeforeFailure.payload.assignments.map((a,index) => ({ ...a,navigationItemId:index === 0 ? "new-first" : "explode" })) };
  await assert.rejects(db.query("select apply_navigation_repair($1,$2,$3,$4,$5,$6)",
    [project,owner,navBeforeFailure.revision,randomUUID(),JSON.stringify(navPayload),null]),/injected nav failure/);
  assert.deepEqual(await read("navigation",project),navBeforeFailure);
  await db.exec("reset role; drop trigger fail_assignment on screens; set role service_role;");
  navPayload.assignments.forEach((assignment,index) => { assignment.navigationItemId = `new-${index}`; });
  assert.equal((await db.query("select apply_navigation_repair($1,$2,$3,$4,$5,$6) as value",
    [project,owner,navBeforeFailure.revision,randomUUID(),JSON.stringify(navPayload),null])).rows[0].value.status,"success");
  assert.equal((await read("navigation",project)).payload.shellCode,"nav-C");
  await op("undo",null,{context:"navigation",target:project});
  assert.deepEqual((await read("navigation",project)).payload.assignments,navBeforeFailure.payload.assignments);
  await op("redo",null,{context:"navigation",target:project});
  assert.deepEqual((await read("navigation",project)).payload.assignments,navPayload.assignments);
  await db.query("delete from screens where id=$1",[secondScreen]);
  // One combined manual batch, recovery, an independent reload, and export all agree.
  const appearance = '<main><button style="color: red; border-radius: 12px"><svg></svg><span>Find nearby</span></button><img src="/retained-upload.png"></main>';
  const countBefore = (await db.query("select count(*)::integer as count from design_history_changes c join design_history_heads h on h.id=c.head_id where h.target_id=$1",[screen])).rows[0].count;
  const baseline = await read();
  await op("commit",{code:appearance});
  assert.equal((await db.query("select count(*)::integer as count from design_history_changes c join design_history_heads h on h.id=c.head_id where h.target_id=$1",[screen])).rows[0].count,countBefore+1);
  await op("undo"); assert.equal((await read()).payload.code,baseline.payload.code);
  await op("redo");
  if (realPostgres) { const reload = await db.connect(); try { assert.equal((await reload.query("select code from screens where id=$1",[screen])).rows[0].code,appearance); } finally { await reload.end(); } }
  assert.equal((await db.query("select read_export_context($1,$2,$3) as value",[project,owner,[screen]])).rows[0].value.screens[0].code,appearance);
  assert.equal((await db.query("select read_export_context($1,$2,$3) as value",[project,randomUUID(),[screen]])).rows[0].value,null);
  await db.exec("reset role; set role anon");
  await assert.rejects(read(),/permission denied/);
  await assert.rejects(db.query("select read_export_context($1,$2,$3)",[project,owner,[screen]]),/permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(read(),/permission denied/);
  await assert.rejects(db.query("select * from design_history_changes"),/permission denied/);
  await db.exec("reset role; set role service_role");
  if (realPostgres) { await db.exec("reset role"); await (await import("./design-history/concurrency.mjs")).verifyConcurrency(db, { project, owner, screen }); await db.exec("set role service_role"); }
  await db.query("delete from screens where id=$1",[screen]);
  assert.equal((await db.query("select count(*)::integer as count from design_history_heads where context='screen'")).rows[0].count,0);
  await assert.rejects(op("commit",{code:"resurrect"},{revision:0}),/unavailable/);
  console.log("PASS: export snapshot, owner/grant isolation, CAS, retry identity, undo/redo/restore, branches, retention, independent tokens, metadata revisions, reconciliation, insertion rollback and deletion lifetime.");
} finally { await db.close(); }
