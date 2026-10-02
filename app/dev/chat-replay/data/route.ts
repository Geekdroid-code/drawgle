import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const REPLAY_DIR = path.join(process.cwd(), "scripts", "design-eval", "out", "replay");

/** Dev only: a project exported by scripts/design-eval/export-replay.ts, or the list of exported projects. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    const files = await readdir(REPLAY_DIR).catch(() => [] as string[]);
    return NextResponse.json({ ids: files.filter((file) => file.endsWith(".json")).map((file) => file.slice(0, -5)) });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  try {
    const text = await readFile(path.join(REPLAY_DIR, `${id}.json`), "utf8");
    return new NextResponse(text, { headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Export this project first with scripts/design-eval/export-replay.ts." }, { status: 404 });
  }
}
