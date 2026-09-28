import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { activeFacts, assertExperienceReady, blockingScreenQuestions, productPlanningSchema,
  productSectionSchema, proposeProductScope } from "../lib/product-planning/model";
import { evidenceAllowsProposal } from "../lib/product-planning/evidence";
import { designRequirementsKey } from "../lib/product-planning/design-requirements";
import { ProductToolError } from "../lib/product-planning/tool-failure";
import { requiredFactSections } from "../lib/product-planning/required-facts";

// Read-only. Credentials must already be supplied by the caller's environment.
// Deliberately does not load env files or print database errors, prompts, or records.
async function main() {
  const projectId = process.argv[2];
  if (!/^[a-f0-9-]{36}$/i.test(projectId ?? "")) throw new Error("Provide a project UUID.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database credentials are not present in the process environment.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("projects").select("owner_id,product_planning")
    .eq("id", projectId).single();
  if (error) throw new Error("Read-only project lookup failed.");
  const parsed = productPlanningSchema.safeParse(data.product_planning);
  if (!parsed.success) {
    console.log(JSON.stringify({ projectId, schemaIssues: parsed.error.issues.map(issue => ({
      code: issue.code, path: issue.path.join("."),
    })) }, null, 2));
    return;
  }
  const state = parsed.data;
  const check = (run: () => unknown) => {
    try { run(); return { passed: true }; }
    catch (error) {
      // The fingerprint can be compared with saved sanitized failure metadata.
      const message = error instanceof Error ? error.message : "";
      return { passed: false,
        ...(error instanceof ProductToolError && error.code === "REQUIRED_FACTS_MISSING" ? { code: error.code } : {}),
        fingerprint: createHash("sha256").update(message).digest("hex").slice(0, 12) };
    }
  };
  console.log(JSON.stringify({ projectId, phase: state.phase, revision: state.revision,
    contentRevision: state.contentRevision, protocol: state.planningProtocol,
    facts: Object.fromEntries(productSectionSchema.options.map(section => [section, activeFacts(state, section).length])),
    missingRequiredFactSections: requiredFactSections(state.input).filter(section => !activeFacts(state, section).length),
    evidenceAllowsProposal: evidenceAllowsProposal(state.evidenceAssessment),
    evidence: state.evidenceAssessment ? { mode: state.evidenceAssessment.mode,
      productReady: state.evidenceAssessment.productReady, experienceReady: state.evidenceAssessment.experienceReady,
      gaps: state.evidenceAssessment.gaps.length } : null,
    blockingQuestions: blockingScreenQuestions(state).map(fact => ({ id: fact.id, decisionKey: fact.decisionKey })),
    scope: state.scope ? { status: state.scope.status, selected: state.scope.outputKeys?.length,
      outputs: state.scope.manifest?.length, reviewIssues: state.scope.reviewIssues?.length ?? 0,
      removedSurfaceCount: state.scope.surfaceIds.filter(id => !activeFacts(state, "surfaces").some(fact => fact.id === id)).length } : null,
    experience: state.experience ? { provenance: state.experience.provenance,
      referenceMatches: state.experience.referencePath === state.input.imagePath,
      requirementsMatch: state.experience.requirementsKey === designRequirementsKey(state),
      compatible: state.experience.compatibility?.compatible } : null,
    experienceCheck: check(() => assertExperienceReady(state)), scopeCheck: check(() => proposeProductScope(state)),
  }, null, 2));
  const { data: messages, error: messageError } = await db.from("project_messages")
    .select("created_at,metadata").eq("project_id", projectId).eq("owner_id", data.owner_id)
    .eq("role", "model").order("created_at", { ascending: false }).limit(8);
  if (messageError) throw new Error("Read-only project lookup failed.");
  const symbol = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_]{1,100}$/.test(value) ? value : undefined;
  console.log(JSON.stringify({ recentTurns: (messages ?? []).flatMap(message => {
    const metadata = message.metadata ?? {};
    if (!metadata.productTurnComplete) return [];
    return [{ createdAt: message.created_at, failure: metadata.productPlanningFailure ? {
      stage: symbol(metadata.productPlanningFailure.stage), code: symbol(metadata.productPlanningFailure.code),
    } : null, timings: Array.isArray(metadata.planningPerformanceV1)
      ? metadata.planningPerformanceV1.map((item: { stage?: unknown; elapsedMs?: unknown }) => ({
        stage: symbol(item.stage), elapsedMs: typeof item.elapsedMs === "number" ? item.elapsedMs : undefined,
      })) : [] }];
  }) }, null, 2));
}

void main().catch(error => {
  // Only errors constructed in this file are safe to display.
  const safe = new Set(["Provide a project UUID.", "Database credentials are not present in the process environment.",
    "Read-only project lookup failed."]);
  console.error(error instanceof Error && safe.has(error.message) ? error.message : "Planning diagnostic failed; no sensitive error details were printed.");
  process.exitCode = 1;
});
