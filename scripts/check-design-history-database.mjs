// Isolated PostgreSQL engine tests. Pass the package.json path of a temporary PGlite installation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const { PGlite } = createRequire(resolve(process.argv[2] || "package.json"))("@electric-sql/pglite");
const db = new PGlite();
const owner = randomUUID(), project = randomUUID(), screen = randomUUID();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
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
  assert.equal((await op("commit",{code:"stale"},{revision:0})).status,"stale_revision");
  await op("commit",{code:"C"});
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
  const navBeforeFailure = await read("navigation",project);
  await db.exec("reset role; create function reject_assignment() returns trigger language plpgsql as $$begin if new.navigation_item_id='explode' then raise exception 'injected nav failure'; end if; return new; end;$$; create trigger fail_assignment before update on screens for each row execute function reject_assignment(); set role service_role;");
  const navPayload = { ...navBeforeFailure.payload, shellCode:"nav-C", assignments: navBeforeFailure.payload.assignments.map(a => ({ ...a,navigationItemId:"explode" })) };
  await assert.rejects(db.query("select apply_navigation_repair($1,$2,$3,$4,$5,$6)",
    [project,owner,navBeforeFailure.revision,randomUUID(),JSON.stringify(navPayload),null]),/injected nav failure/);
  assert.deepEqual(await read("navigation",project),navBeforeFailure);
  await db.exec("reset role; drop trigger fail_assignment on screens; set role service_role;");
  navPayload.assignments[0].navigationItemId = "new";
  assert.equal((await db.query("select apply_navigation_repair($1,$2,$3,$4,$5,$6) as value",
    [project,owner,navBeforeFailure.revision,randomUUID(),JSON.stringify(navPayload),null])).rows[0].value.status,"success");
  assert.equal((await read("navigation",project)).payload.shellCode,"nav-C");
  assert.equal((await db.query("select read_export_context($1,$2,$3) as value",[project,randomUUID(),[screen]])).rows[0].value,null);
  await db.exec("reset role; set role anon");
  await assert.rejects(read(),/permission denied/);
  await assert.rejects(db.query("select read_export_context($1,$2,$3)",[project,owner,[screen]]),/permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(read(),/permission denied/);
  await assert.rejects(db.query("select * from design_history_changes"),/permission denied/);
  await db.exec("reset role; set role service_role");
  await db.query("delete from screens where id=$1",[screen]);
  assert.equal((await db.query("select count(*)::integer as count from design_history_heads where context='screen'")).rows[0].count,0);
  await assert.rejects(op("commit",{code:"resurrect"},{revision:0}),/unavailable/);
  console.log("PASS: export snapshot, owner/grant isolation, CAS, retry identity, undo/redo/restore, branches, retention, independent tokens, metadata revisions, reconciliation, insertion rollback and deletion lifetime.");
} finally { await db.close(); }
