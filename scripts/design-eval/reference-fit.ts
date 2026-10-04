/**
 * Before and after for the reference fix: plans the founder's own curated-style projects again on this branch, and
 * reports what each product was decided to be (its anatomy), which library reference it was given and how that
 * reference was read, beside what production gave the same request.
 *
 *   plan                  lists the cases and what a run calls; reads the database (select only), calls no model
 *   run [projectId ...]   plans each case with the configured models; without --yes it only prints the plan
 *
 * Planning only, the way the app plans a new project: the first planning turn, then Skip on every question card,
 * until the approval card. No tokens, kit or screens are built, nothing is written to the database (the project
 * lives in memory), and no task is queued: early design preparation and scope preparation are off in this process.
 * The report names library references, so it stays in the git-ignored out folder and is never shown to users.
 *
 * Run it with the app's environment, which it reads itself (never print it):
 *   pnpm exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/design-eval/reference-fit.ts plan
 *   pnpm exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/design-eval/reference-fit.ts run --yes --label after
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { productDesignerMemoryStore } from "../lib/product-designer-memory-store";
import { runProductDesigner } from "@/lib/product-planning/designer";
import { createProductPlanning, readProductPlanning, type ProductPlanning } from "@/lib/product-planning/model";
import { formatProductAnswers, readProductQuestions } from "@/lib/product-planning/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { costOf, formatCost, priceOf } from "./cost";

/**
 * The founder's own curated-style projects from 2026-09-16 to 2026-10-04: the ones whose library reference was made
 * for another kind of product, and two that matched, as controls.
 */
export const REFERENCE_FIT_CASES: Array<{ projectId: string; why: string }> = [
  { projectId: "e8ca8623-cef0-44ba-926e-d7843976b8f2", why: "file explorer, drew a creator dashboard" },
  { projectId: "50b9ab73-f881-4889-a17b-122cbb093210", why: "invoice tracker, drew a travel tracker" },
  { projectId: "895fbef5-5471-49cc-835b-9da5fc2bca36", why: "subscription tracker, drew a travel tracker" },
  { projectId: "69e2a8bd-f3b6-4c60-b276-452b03414e7f", why: "doctor booking, drew a travel tracker" },
  { projectId: "dba0010e-1da8-4bd9-8fbb-27fb1df79e39", why: "private jet charters, drew a travel tracker" },
  { projectId: "bcc377f9-a147-4942-899a-b1170a19de50", why: "hobby gear swapper, drew a crypto exchange" },
  { projectId: "f660a620-2db1-42aa-bd4b-01f14fcb161d", why: "home management, drew a photo gallery" },
  { projectId: "0ce99a06-351c-40e5-8cd6-20c62bb1db4f", why: "multi-pet family tracker, drew a meditation app" },
  { projectId: "77347553-135c-495a-8aae-a1d62efbc91a", why: "T-shirt shop, drew a bakery" },
  { projectId: "b2c18f09-d0a2-4318-9e97-208b3a5c775c", why: "control: food delivery, drew food delivery" },
  { projectId: "2329071e-4e98-4035-b6ca-1ba41e7252f7", why: "control: neo-brutalist sneaker drops, drew a sneaker shop" },
];

/**
 * Model calls one case can make: an assessment, a proposal and its one retry, a library query and three candidate
 * reads, then another assessment, proposal and retry when a question card is skipped. Most cases make about six.
 */
const MAX_CALLS_PER_CASE = 10;
/** Skips a case may need before it reaches the approval card. */
const MAX_SKIPS = 2;

type Before = { prompt: string; referenceId: string | null; direction: string | null; adaptations: string | null };
type Trace = Record<string, unknown>;

async function readBefore(projectId: string): Promise<Before> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("projects").select("prompt, product_planning, project_charter").eq("id", projectId).single();
  if (error) throw error;
  const planning = data.product_planning as { experience?: { referenceId?: string | null; direction?: string; adaptations?: string };
    input?: { originalRequest?: string } } | null;
  const charter = data.project_charter as { referenceDna?: { sourceReferenceId?: string | null } } | null;
  return {
    prompt: planning?.input?.originalRequest?.trim() || data.prompt,
    referenceId: charter?.referenceDna?.sourceReferenceId ?? planning?.experience?.referenceId ?? null,
    direction: planning?.experience?.direction ?? null,
    adaptations: planning?.experience?.adaptations ?? null,
  };
}

/** One case planned in memory, the way the app plans a new project, to its approval card. */
async function planCase(prompt: string) {
  const projectId = randomUUID();
  const ownerId = randomUUID();
  const tables: Record<string, Array<Record<string, unknown>>> = {
    projects: [{ id: projectId, owner_id: ownerId, name: "Reference fit", prompt,
      product_planning: createProductPlanning({ originalRequest: prompt, imagePath: null, imageReferenceMode: "style", stylePresetSlug: null }) }],
    project_messages: [],
  };
  const admin = productDesignerMemoryStore(tables);
  const traces: Trace[] = [];
  const state = () => readProductPlanning(tables.projects[0].product_planning)!;
  await runProductDesigner({ admin, projectId, ownerId, prompt, originalPrompt: prompt, clientTurnId: `initial:${projectId}`,
    initialize: true, enqueueMemory: false, onTrace: event => traces.push(event) });
  for (let skip = 0; skip < MAX_SKIPS && state().scope?.status !== "proposed"; skip += 1) {
    const card = [...tables.project_messages].reverse().find(message => message.role === "model"
      && readProductQuestions((message.metadata ?? {}) as Record<string, unknown>));
    const questions = card ? readProductQuestions(card.metadata as Record<string, unknown>) : null;
    if (!card || !questions) break;
    const answers = questions.map(() => ({ kind: "skip" as const }));
    await runProductDesigner({ admin, projectId, ownerId, prompt: formatProductAnswers(questions, answers).content, originalPrompt: prompt,
      clientTurnId: randomUUID(), productAnswers: { messageId: String(card.id), answers }, enqueueMemory: false,
      onTrace: event => traces.push(event) });
  }
  return { state: state(), traces };
}

const tokens = (traces: Trace[]) => traces.reduce<{ input: number; output: number }>((sum, event) => ({
  input: sum.input + (typeof event.inputTokens === "number" ? event.inputTokens : 0),
  output: sum.output + (typeof event.outputTokens === "number" ? event.outputTokens : 0),
}), { input: 0, output: 0 });

function caseReport(why: string, before: Before, after: ProductPlanning | null, traces: Trace[], failure: string | null) {
  const experience = after?.experience;
  const anatomy = after?.scope?.anatomy;
  const candidates = traces.filter(event => event.stage === "reference_candidate").length;
  return [
    `## ${why}`,
    "",
    `Request: ${before.prompt.replace(/\s+/g, " ").slice(0, 300)}`,
    "",
    "| | Before (production) | After (this branch) |",
    "| --- | --- | --- |",
    `| Reference | ${before.referenceId ?? "none"} | ${failure ? `failed: ${failure}` : experience?.referenceId ?? "none (prompt only)"} |`,
    `| Candidates read | | ${candidates} |`,
    "",
    anatomy ? [
      `**Anatomy:** ${anatomy.kind}`,
      "",
      ...anatomy.components.map(component => `- \`${component.name}\`: ${component.shows}. Form: ${component.form}`),
      anatomy.conventions.length ? `- Expected: ${anatomy.conventions.join("; ")}` : null,
      anatomy.avoid.length ? `- Avoid: ${anatomy.avoid.join("; ")}` : null,
    ].filter(Boolean).join("\n") : "**Anatomy:** none",
    "",
    `**Screens:** ${(after?.scope?.manifest ?? []).filter(item => item.kind === "screen").map(item => item.name).join(", ") || "none"}`,
    "",
    "**Direction before:** " + (before.direction ?? "none"),
    "",
    "**Direction after:** " + (experience?.direction ?? "none"),
    "",
    "**Map before:** " + (before.adaptations ?? "none"),
    "",
    "**Map after:** " + (experience?.adaptations ?? "none"),
    experience?.compatibility?.conflicts.length ? `\n**Conflicts named:** ${experience.compatibility.conflicts.join("; ")}` : "",
    "",
  ].join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    yes: { type: "boolean", default: false }, label: { type: "string", default: "after" } } });
  const [command = "plan", ...ids] = positionals;
  const cases = ids.length ? REFERENCE_FIT_CASES.filter(item => ids.some(id => item.projectId.startsWith(id))) : REFERENCE_FIT_CASES;
  if (!cases.length) throw new Error("No case matches those project ids.");
  const price = priceOf(process.env.DRAWGLE_GEMINI_PROJECT_PLANNER_MODEL?.trim() || "gemini-3-flash-preview");

  console.log(`${cases.length} cases, at most ${cases.length * MAX_CALLS_PER_CASE} model calls, about six each (an assessment, a proposal, a library query, up to three candidate reads, and another assessment and proposal when a question card is skipped). Planning only: nothing is built or saved, and no task is queued.`);
  for (const item of cases) console.log(`- ${item.projectId.slice(0, 8)}  ${item.why}`);
  if (command !== "run" || !values.yes) {
    if (command === "run") console.log("\nPass --yes to run it.");
    return;
  }

  // Nothing here may queue work on the real project pipeline.
  process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE = "off";
  process.env.DRAWGLE_SCOPE_PREPARATION = "off";

  const out = path.join("scripts", "design-eval", "out", "reference-fit", values.label);
  mkdirSync(out, { recursive: true });
  const sections: string[] = [];
  const results: Array<Record<string, unknown>> = [];
  let total = { input: 0, output: 0 };
  for (const item of cases) {
    const before = await readBefore(item.projectId);
    let after: ProductPlanning | null = null;
    let traces: Trace[] = [];
    let failure: string | null = null;
    try {
      ({ state: after, traces } = await planCase(before.prompt));
    } catch (error) {
      failure = error instanceof Error ? error.message.slice(0, 200) : "unknown";
    }
    const used = tokens(traces);
    total = { input: total.input + used.input, output: total.output + used.output };
    console.log(`${item.projectId.slice(0, 8)}: ${before.referenceId ?? "none"} → ${failure ? `failed (${failure})` : after?.experience?.referenceId ?? "none"}; ${used.input} in, ${used.output} out`);
    sections.push(caseReport(item.why, before, after, traces, failure));
    results.push({ ...item, before, after: after ? { anatomy: after.scope?.anatomy ?? null, experience: after.experience ?? null,
      screens: (after.scope?.manifest ?? []).map(entry => entry.name), navigation: after.scope?.navigation ?? null } : null, failure, tokens: used });
  }
  const cost = costOf({ inputTokens: total.input, outputTokens: total.output, thinkingTokens: null }, price);
  writeFileSync(path.join(out, "report.md"), [`# Reference fit: ${values.label}`, "",
    `${cases.length} cases. Tokens the traces reported: ${total.input} in, ${total.output} out (${formatCost(cost)} at the Flash price; calls that report no tokens are not counted).`, "",
    ...sections].join("\n"));
  writeFileSync(path.join(out, "report.json"), JSON.stringify(results, null, 2));
  console.log(`\nWrote ${path.join(out, "report.md")}. Tokens reported: ${total.input} in, ${total.output} out, about ${formatCost(cost)}.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "The reference-fit run failed."); process.exitCode = 1; });
