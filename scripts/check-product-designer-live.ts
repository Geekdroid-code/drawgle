// Synthetic conversation evaluation: real model, in-memory projects/messages, no generation or production DB writes.
// pnpm exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/check-product-designer-live.ts --live
import { randomUUID } from "node:crypto";
import { runProductDesigner } from "@/lib/product-planning/designer";
import { activeFacts, createProductPlanning, readProductPlanning } from "@/lib/product-planning/model";

async function main() {
  if (!process.argv.includes("--live")) throw new Error("Pass --live to run synthetic conversations using the configured model.");
  const projectId = randomUUID();
  const ownerId = randomUUID();
  const tables: Record<string, Array<Record<string, unknown>>> = {
    projects: [{ id: projectId, owner_id: ownerId, name: "Tacozz", prompt: "", product_planning: createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null }) }],
    project_messages: [],
  };
  const admin = { from(table: string) {
    const filters: Array<[string, unknown]> = [];
    let update: Record<string, unknown> | null = null;
    let insert: Record<string, unknown> | null = null;
    const execute = (single = false) => {
      const rows = tables[table] ??= [];
      if (insert) rows.push({ ...insert, id: randomUUID(), created_at: new Date().toISOString() });
      const matched = rows.filter((row) => filters.every(([key, value]) => {
        if (key === "product_planning->>revision") return String((row.product_planning as { revision: number }).revision) === value;
        return row[key] === value;
      }));
      if (update) matched.forEach((row) => Object.assign(row, update));
      return { data: structuredClone(single ? insert ? rows.at(-1) : matched[0] ?? null : matched), error: null };
    };
    const query = {
      select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      in: () => query, order: () => query, limit: () => query,
      update: (value: Record<string, unknown>) => { update = value; return query; },
      insert: (value: Record<string, unknown>) => { insert = value; return query; },
      single: async () => execute(true), maybeSingle: async () => execute(true),
      then: (resolve: (value: ReturnType<typeof execute>) => void) => Promise.resolve(execute()).then(resolve),
    };
    return query;
  } };
  for (const prompt of [
    "I want a premium app for selling my T-shirts. Tacozz. Proper onboarding, sophisticated and minimal.",
    "Onboarding should just introduce the brand, no fake personalization. Customers buy our limited-run T-shirts. Guest checkout, size and color selection, shipping address and card payment are needed. For now only design onboarding. Map the rest of the product for later, and make low-risk assumptions if needed.",
    "Actually, design only the purchase flow first, from choosing a T-shirt through successful payment. Keep onboarding in the roadmap. No accounts required.",
  ]) {
    const response = await runProductDesigner({ admin, projectId, ownerId, prompt, clientTurnId: randomUUID(), enqueueMemory: false, onTrace: (event) => console.log(JSON.stringify(event)) });
    const state = readProductPlanning(tables.projects[0].product_planning)!;
    console.log(JSON.stringify({ prompt, response, scope: state.scope, activeFacts: activeFacts(state), phase: state.phase }, null, 2));
    if (state.phase !== "discovery") throw new Error("The designer must not start generation.");
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Evaluation failed."); process.exitCode = 1; });
