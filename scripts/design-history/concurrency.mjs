import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyConcurrency(db, { project, owner, screen }) {
  const left = await db.connect(), right = await db.connect();
  const read = async () => (await left.query("select read_design_target($1,$2,'screen',$3) as value", [project, owner, screen])).rows[0].value;
  const operation = async (client, action, revision, code, requestId = randomUUID()) => (await client.query(
    "select apply_design_history($1,$2,'screen',$3,$4,$5,$6,$7,null,'Concurrency test','test',null) as value",
    [project, owner, screen, revision, requestId, action, code == null ? null : JSON.stringify({ code })])).rows[0].value;
  // Wait for a real lock waiter, rather than relying on timing-dependent sleeps.
  const waitForLock = async client => {
    const pid = (await client.query("select pg_backend_pid() as pid")).rows[0].pid;
    return async () => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await db.query("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
        if (result.rows[0]?.wait_event_type === "Lock") return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error("The second database connection never entered the expected lock wait.");
    };
  };
  try {
    await left.query("set role service_role"); await right.query("set role service_role");
    const rightWaits = await waitForLock(right);
    for (const secondAction of ["commit", "undo"]) {
      const saved = await read();
      await left.query("begin");
      assert.equal((await operation(left, "commit", saved.revision, `first-${secondAction}`)).status, "success");
      const pending = operation(right, secondAction, saved.revision, secondAction === "commit" ? "must-not-win" : null);
      await rightWaits();
      await left.query("commit");
      assert.equal((await pending).status, "stale_revision");
      assert.equal((await read()).payload.code, `first-${secondAction}`);
    }
    // Recovery wins against an AI completion based on an older revision.
    const saved = await read();
    await left.query("begin");
    const requestId = randomUUID();
    assert.equal((await operation(left, "undo", saved.revision, null, requestId)).status, "success");
    const delayedAi = operation(right, "commit", saved.revision, "late-ai-result");
    await rightWaits(); await left.query("commit");
    assert.equal((await delayedAi).status, "stale_revision");
    assert.equal((await operation(right, "undo", saved.revision, null, requestId)).replayed, true);
    const restored = await read();
    const redoId = randomUUID();
    assert.equal((await operation(left, "redo", restored.revision, null, redoId)).status, "success");
    assert.equal((await operation(right, "redo", restored.revision, null, redoId)).replayed, true);
    // Deletion must prevent a blocked late writer from resurrecting a screen.
    const doomed = randomUUID();
    await left.query("insert into screens(id,project_id,owner_id,name,code,status) values($1,$2,$3,'Delete race','baseline','ready')", [doomed, project, owner]);
    await left.query("begin");
    await left.query("delete from screens where id=$1", [doomed]);
    const lateWrite = right.query("select apply_design_history($1,$2,'screen',$3,0,$4,'commit',$5,null,'Late result','test',null)", [project, owner, doomed, randomUUID(), JSON.stringify({ code: "resurrection" })]).then(() => false, () => true);
    await rightWaits(); await left.query("commit");
    assert.equal(await lateWrite, true);
    assert.equal((await left.query("select count(*)::integer as count from screens where id=$1", [doomed])).rows[0].count, 0);
    console.log("PASS: real two-connection save/save, save/undo, recovery/delayed-AI, undo/redo replay, deletion/late-worker lock ordering.");
  } finally { await left.query("rollback"); await right.query("rollback"); await left.end(); await right.end(); }
}
