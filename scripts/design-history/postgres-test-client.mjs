import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

// Only an isolated loopback test server is accepted; no application credentials are read.
export async function createPostgresTestClient(packagePath, port = 55439) {
  const { Client } = createRequire(resolve(packagePath))("pg");
  const options = { host: "127.0.0.1", port, user: "editor_test", database: "postgres" };
  const admin = new Client(options);
  await admin.connect();
  const database = `drawgle_history_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`create database ${database}`);
  const connect = async () => {
    const client = new Client({ ...options, database });
    await client.connect();
    await client.query("set statement_timeout='15s'; set lock_timeout='10s'");
    return client;
  };
  const client = await connect();
  return {
    query: (sql, parameters) => client.query(sql, parameters),
    exec: async sql => { await client.query(sql); },
    connect,
    close: async () => { await client.end(); await admin.query(`drop database ${database}`); await admin.end(); },
  };
}
