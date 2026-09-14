// Synthetic conversation evaluation: real model, in-memory projects/messages, no generation or production DB writes.
// pnpm exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/check-product-designer-live.ts --live
import { randomUUID } from "node:crypto";
import { productDesignerMemoryStore } from "./lib/product-designer-memory-store";
import { runProductDesigner } from "@/lib/product-planning/designer";
import { activeFacts, createProductPlanning, readProductPlanning } from "@/lib/product-planning/model";
import { CURATED_STYLE_REFERENCES, loadCuratedStyleReferenceImage } from "@/lib/generation/curated-style-references";

async function main() {
  if (!process.argv.includes("--live")) throw new Error("Pass --live to run synthetic conversations using the configured model.");
  const projectId = randomUUID();
  const ownerId = randomUUID();
  const tables: Record<string, Array<Record<string, unknown>>> = {
    projects: [{ id: projectId, owner_id: ownerId, name: "Tacozz", prompt: "", product_planning: createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null }) }],
    project_messages: [],
  };
  const admin = productDesignerMemoryStore(tables);
  const recreate = process.argv.includes("--recreate-reference");
  const image = recreate ? await loadCuratedStyleReferenceImage(CURATED_STYLE_REFERENCES[0]) : null;
  if (recreate && !image) throw new Error("The recreation evaluation image is unavailable.");
  const prompts = recreate ? ["Recreate every supplied screen exactly. Preserve the visible layouts and flow; do not invent additional screens."] : [
    "I want a premium app for selling my T-shirts. Tacozz. Proper onboarding, sophisticated and minimal.",
    "Onboarding should just introduce the brand, no fake personalization. Customers buy our limited-run T-shirts. Guest checkout, size and color selection, shipping address and card payment are needed. For now only design onboarding. Map the rest of the product for later, and make low-risk assumptions if needed.",
    "Actually, design only the purchase flow first, from choosing a T-shirt through successful payment. Keep onboarding in the roadmap. No accounts required.",
  ];
  for (const [index, prompt] of (process.argv.includes("--first-turn-only") ? prompts.slice(0, 1) : prompts).entries()) {
    const response = await runProductDesigner({ admin, projectId, ownerId, prompt, image, imageReferenceMode: recreate ? "recreate" : "style",
      clientTurnId: randomUUID(), enqueueMemory: false, onTrace: (event) => console.log(JSON.stringify(event)) });
    const state = readProductPlanning(tables.projects[0].product_planning)!;
    console.log(JSON.stringify({ prompt, response, assessment: state.evidenceAssessment, experience: state.experience, scope: state.scope, activeFacts: activeFacts(state), phase: state.phase }, null, 2));
    if (state.phase !== "discovery") throw new Error("The designer must not start generation.");
    if (!recreate && index === 0 && state.scope) throw new Error("Incomplete Tacozz brief should start a conversation before choosing screens.");
    if (recreate && (state.scope?.status !== "proposed" || state.evidenceAssessment?.gaps.length)) throw new Error("Exact recreation should reach a narrow proposal without broad discovery.");
    if (index > 0 && state.scope?.status !== "proposed") throw new Error("The detailed follow-up did not produce a validated approval. Inspect tool errors and the model's response.");
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Evaluation failed."); process.exitCode = 1; });
