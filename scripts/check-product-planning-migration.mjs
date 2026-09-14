// Run with Node and a package.json path for a temporary PGlite installation.
// This verifies the actual migration and existing projects RLS in isolated PostgreSQL.
// No production database, credentials, or application dependency changes are needed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(resolve(process.argv[2] || "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`
    create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table public.projects (id uuid primary key, owner_id uuid not null, name text, prompt text, status text);
    create table public.project_messages (project_id uuid references projects(id), owner_id uuid, role text, content text, message_type text, metadata jsonb);
    alter table public.projects enable row level security;
    grant select, insert, update, delete on public.projects to authenticated, anon;
    grant select, insert, update, delete on public.projects, public.project_messages to service_role;
    insert into public.projects (id, owner_id, name) values
      ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Legacy'),
      ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other owner');
  `);
  const initial = await readFile("supabase/migrations/20260417000100_initial_drawgle.sql", "utf8");
  const ownerPolicy = initial.match(/create policy "Projects are owner-scoped"[\s\S]*?;/)?.[0];
  assert.ok(ownerPolicy);
  await db.exec(ownerPolicy);
  await db.exec(await readFile("supabase/migrations/20260914053035_product_planning.sql", "utf8"));
  assert.equal((await db.query("select product_planning from projects limit 1")).rows[0].product_planning, null);
  await assert.rejects(db.query("update projects set product_planning = '{}'::jsonb"), /projects_product_planning_shape/);
  const createArgs = ["33333333-3333-4333-8333-333333333333", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Planning", "T-shirts", JSON.stringify({ version: 1, revision: 0, phase: "discovery", blueprint: { facts: [] } }), JSON.stringify({ action: "product_initial_prompt" })];
  const createSql = "select public.create_planning_project($1,$2,$3,$4,$5,$6)";
  await db.query(createSql, createArgs);
  await db.query(createSql, createArgs);
  assert.equal((await db.query("select * from project_messages")).rows.length, 1);
  await assert.rejects(db.query(createSql, [createArgs[0], "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ...createArgs.slice(2)]), /already used/);
  await db.exec("delete from project_messages; delete from projects where name='Planning';");
  await db.exec("set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';");
  assert.equal((await db.query("select id from projects")).rows.length, 1);
  await assert.rejects(db.query(createSql, createArgs), /permission denied/);
  const state = { version: 1, revision: 0, phase: "discovery", blueprint: { facts: [] }, scope: null };
  await assert.rejects(db.query("update projects set product_planning=$1 where id=$2 returning id", [JSON.stringify(state), "11111111-1111-4111-8111-111111111111"]), /managed by the project agent/);
  assert.equal((await db.query("update projects set name='Renamed' where id='11111111-1111-4111-8111-111111111111' returning id")).rows.length, 1);
  assert.equal((await db.query("update projects set product_planning=$1 where id=$2 returning id", [JSON.stringify(state), "22222222-2222-4222-8222-222222222222"])).rows.length, 0);
  await assert.rejects(db.query("update projects set owner_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"), /row-level security/);
  await db.exec("reset role; set role service_role;");
  assert.equal((await db.query("update projects set product_planning=$1 where id=$2 returning id", [JSON.stringify(state), "11111111-1111-4111-8111-111111111111"])).rows.length, 1);
  const next = { ...state, revision: 1 };
  const cas = "update projects set product_planning=$1 where id=$2 and owner_id=$3 and product_planning->>'revision'=$4 returning id";
  const args = [JSON.stringify(next), "11111111-1111-4111-8111-111111111111", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "0"];
  assert.equal((await db.query(cas, args)).rows.length, 1);
  assert.equal((await db.query(cas, args)).rows.length, 0);
  await db.exec("reset role; set role anon; set request.jwt.claim.sub = '';");
  assert.equal((await db.query("select * from projects")).rows.length, 0);
  assert.equal((await db.query("update projects set name='unauthorized' returning id")).rows.length, 0);
  console.log("PASS: migration, atomic/idempotent creation, legacy NULL state, malformed-state rejection, owner isolation, protected planning state, owner reassignment denial, anonymous denial, and stale-revision CAS.");
} finally { await db.close(); }
