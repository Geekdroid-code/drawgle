import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function checkManualStateDatabase(db, { owner, project }) {
  await db.exec(`reset role;
    alter table generation_runs add column image_path text, add column requested_screen_count integer;
    alter table screens add column owner_id uuid, add column code text, add column name text, add column parent_screen_id uuid;
    create table project_messages(id uuid primary key, project_id uuid, owner_id uuid, screen_id uuid, role text, content text, message_type text, metadata jsonb);
    grant all on project_messages to service_role;`);
  await db.exec(await readFile("supabase/migrations/20260915045831_atomic_manual_state_generation.sql", "utf8"));
  await db.exec("set role service_role");
  await db.query("update generation_runs set status='canceled' where project_id=$1 and status in ('queued','planning','building')", [project]);
  const parent = "66666666-6666-4666-8666-666666666666";
  const request = "77777777-7777-4777-8777-777777777777";
  const request2 = "88888888-8888-4888-8888-888888888888";
  const code = "<main>Original parent layout and content</main>";
  const hash = createHash("sha256").update(code).digest("hex");
  const parentItem = (await db.query("select id from project_screen_roadmap where project_id=$1 and stable_key='screen:welcome'", [project])).rows[0].id;
  await db.query("insert into screens(id,project_id,owner_id,status,code,name,roadmap_item_id) values($1,$2,$3,'ready',$4,'Welcome',$5)", [parent, project, owner, code, parentItem]);
  await db.query("update project_screen_roadmap set generated_screen_id=$1, status='ready' where id=$2", [parent, parentItem]);
  const proposal = { version: 1, prompt: "Show a helpful empty result", parentScreenId: parent, parentRoadmapItemId: parentItem,
    status: "pending", expiresAt: "2099-01-01T00:00:00Z", state: { stateKey: "custom-empty", stateLabel: "Empty result", stateRole: "custom",
      triggerLabel: "No matches", description: "Explain no matches", editInstruction: "Keep the header; show an empty result" } };
  const message = async (id, value = proposal) => db.query("insert into project_messages(id,project_id,owner_id,screen_id,role,content,message_type,metadata) values($1,$2,$3,$4,'user','Create state','chat',$5)",
    [id, project, owner, parent, JSON.stringify({ action: "manual_state_request", parentRevisionHash: hash, screenStateProposal: value })]);
  await message(request);
  const claim = "select claim_screen_state_generation($1,$2,$3,$4) as result";
  const args = [project, owner, request, hash];
  await assert.rejects(db.query(claim, [project, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", request, hash]), /Project not found/);
  await assert.rejects(db.query(claim, [project, owner, request, "wrong"]), /parent changed/i);
  assert.equal((await db.query("select count(*)::int as count from project_screen_roadmap where kind='state'")).rows[0].count, 0);
  const first = (await db.query(claim, args)).rows[0].result.generationRunId;
  const savePlan = "select save_product_prepared_plan($1,$2,$3,$4,$5) as saved";
  const plan = JSON.stringify({ screens: [{ name: "Next" }], charter: {}, navigationPlan: {} });
  assert.equal((await db.query(savePlan, [first, owner, 0, "a".repeat(64), plan])).rows[0].saved, true);
  assert.equal((await db.query(savePlan, [first, owner, 1, "b".repeat(64), plan])).rows[0].saved, false);
  assert.equal((await db.query("select metadata->>'proposalMessageId' as id from generation_runs where id=$1", [first])).rows[0].id, request);
  for (const key of ["b", "c", "d", "e"]) await db.query(savePlan, [first, owner, 0, key.repeat(64), plan]);
  assert.equal(Object.keys((await db.query("select metadata->'preparedPlans' as cache from generation_runs where id=$1", [first])).rows[0].cache).length, 4);
  assert.equal((await db.query(claim, args)).rows[0].result.generationRunId, first);
  assert.equal((await db.query("select count(*)::int as count from project_screen_roadmap where kind='state'")).rows[0].count, 1);
  assert.equal((await db.query("select count(*)::int as count from project_messages where message_type='generation_started'")).rows[0].count, 1);
  assert.equal((await db.query("select code from screens where id=$1", [parent])).rows[0].code, code);
  await message(request2, { ...proposal, state: { ...proposal.state, stateKey: "second", stateLabel: "Second" } });
  await assert.rejects(db.query(claim, [project, owner, request2, hash]), /Another generation/);
  assert.equal((await db.query("select metadata->'screenStateProposal'->>'status' as status from project_messages where id=$1", [request2])).rows[0].status, "pending");
  await db.query("select reserve_generation_credits($1,$2,$3,$4)", [owner, project, first, JSON.stringify([{ outputKey: `state:${first}`, outputKind: "state", amount: 10 }])]);
  const balance = Number((await db.query("select credits from credits where user_id=$1", [owner])).rows[0].credits);
  await db.query("select reserve_generation_credits($1,$2,$3,$4)", [owner, project, first, JSON.stringify([{ outputKey: `state:${first}`, outputKind: "state", amount: 10 }])]);
  assert.equal(Number((await db.query("select credits from credits where user_id=$1", [owner])).rows[0].credits), balance);
  await db.query("select release_generation_credit($1,$2,$3,'test')", [owner, first, `state:${first}`]);
  await db.query("update generation_runs set status='completed' where id=$1", [first]);
  // Concurrent parent edit invalidates the saved request without partially approving it.
  await db.query("update screens set code='changed' where id=$1", [parent]);
  await assert.rejects(db.query(claim, [project, owner, request2, hash]), /parent changed/i);
  assert.equal((await db.query(claim, args)).rows[0].result.generationRunId, first, "An acknowledged request remains idempotent after parent changes");
  await db.exec("reset role; set role authenticated");
  await assert.rejects(db.query(claim, args), /permission denied/);
  await assert.rejects(db.query(savePlan, [first, owner, 0, "a".repeat(64), plan]), /permission denied/);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query(claim, args), /permission denied/);
  await db.exec("reset role; set role service_role");
  await db.query("update generation_runs set status='canceled' where id=$1", [first]);
  assert.equal((await db.query(savePlan, [first, owner, 0, "f".repeat(64), plan])).rows[0].saved, false);
  console.log("PASS: atomic manual state claim, owner isolation, parent revision binding, preserved parent, idempotent output/run/activity, active-run exclusion, unchanged pending draft, duplicate credit reservation, and RPC permissions.");
}
