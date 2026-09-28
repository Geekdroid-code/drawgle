import "server-only";
import { createHash } from "node:crypto";
import { Type } from "@google/genai";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import {
  loadCuratedStyleReferenceImage,
  shortlistCuratedStyleReferences,
} from "@/lib/generation/curated-style-references";
import { activeFacts, type ProductPlanning } from "./model";
import { explicitDesignRequirements, designRequirementsKey } from "./design-requirements";
import { loadPlanningReference, storePlanningReference } from "./references";
import type { PlanningStore } from "./store";
import { planningReferenceContext } from "./reference-context";
import { verifySourceDetails } from "./source-detail";
import { ProductToolError } from "./tool-failure";
import { experienceSchema } from "./experience";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import { promptExperience } from "./prompt-experience";
import { loadDesignReference } from "./load-design-reference";

export async function inspectProductReference(admin: PlanningStore, ownerId: string, state: ProductPlanning, request: string,
  onTrace?: (event: { stage: string; elapsedMs: number; inputTokens?: number; outputTokens?: number; errorCode?: string }) => void) {
  const referenceContext = planningReferenceContext(state);
  const recreation = referenceContext.assessmentMode === "recreate";
  const reqKey = designRequirementsKey(state);
  const explicitReqs = explicitDesignRequirements(state);
  let referenceId: string | null = state.experience?.referencePath === state.input.imagePath ? state.experience.referenceId : null;
  let catalogHash: string | null = state.experience?.referencePath === state.input.imagePath ? state.experience.catalogHash ?? null : null;
  let referencePath = state.input.imagePath;
  let image = await loadDesignReference(admin, ownerId, state, onTrace);

  const fields = ["observations", "direction", "informationHierarchy", "navigation", "adaptations"];
  const policy = geminiPolicyForTask("project_planning", {
    systemInstruction: recreation ? "Inspect only the supplied frames for faithful recreation. Preserve their visible copy, layout, typography, colors, assets, controls and states. Describe the source itself, not a redesigned product. Product preferences and inherited architecture must not adapt these screens. Apply only explicit user-requested deviations. Return optional frames containing each one-based index and bounds {x,y,width,height} in normalized 0-1 coordinates enclosing its complete visible frame, including overlays/shadows. Omit uncertain bounds. Compatibility is true because the user selected this source for recreation; transfer describes source preservation. Return JSON only." : `You are the visual/product designer inspecting the actual provided reference pixels. Curated library references were selected by Drawgle; never describe them as user uploads. Describe the observed composition, hierarchy, spacing, density, imagery and component relationships concretely. Then recommend how to adapt that visual language to the provided product's actual tasks and information. Preserve product decisions; the reference does not establish hidden business rules. When explicit user design requirements are provided, evaluate visual compatibility honestly. If the reference's core visual traits clashingly violate explicit constraints (such as dark palette vs explicit white/cream requirement, heavy gradients vs explicit no-gradients), report compatible=false with identified conflicts. If transferable craft (typography, rhythm, surface delicacy) can guide unspecified choices while honoring the explicit constraints, report compatible=true. Return JSON only.`,
    responseMimeType: "application/json", maxOutputTokens: 4500,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        ...(recreation ? { frames: { type: Type.ARRAY, maxItems: 24, items: { type: Type.OBJECT, properties: {
          index: { type: Type.INTEGER }, bounds: { type: Type.OBJECT, properties: Object.fromEntries(["x", "y", "width", "height"].map(key => [key, { type: Type.NUMBER }])), required: ["x", "y", "width", "height"] },
        }, required: ["index", "bounds"] } } } : {}),
        ...Object.fromEntries(fields.map(field => [field, { type: Type.STRING,
          description: `Concise, non-empty ${field}; at most ${field === "informationHierarchy" || field === "navigation" ? 2400 : 4000} characters.` }])),
        compatibility: {
          type: Type.OBJECT,
          properties: {
            compatible: { type: Type.BOOLEAN },
            conflicts: { type: Type.ARRAY, maxItems: 20, items: { type: Type.STRING } },
            transfer: { type: Type.STRING, description: "Transferable visual rules; at most 3000 characters." },
            rationale: { type: Type.STRING, description: "Concise compatibility rationale; at most 2000 characters." },
          },
          required: ["compatible", "conflicts", "transfer", "rationale"],
        },
      },
      required: [...fields, "compatibility"],
    },
  });

  const buildPromptDirection = (reason: "explicit" | "optional_reference_unavailable") => {
    onTrace?.({ stage: "reference_prompt_basis", elapsedMs: 0 });
    return { experience: promptExperience(state, reason), image: null };
  };
  if (state.input.referencePreference?.mode === "none") return buildPromptDirection("explicit");

  // A reference asset is reusable under the same confirmed requirements and
  // exact stored pixels. Stale/rejected candidates return to bounded selection.
  if (image) {
    if (state.experience?.requirementsKey === reqKey && state.experience.compatibility?.compatible === true
      && state.experience.referenceHash === createHash("sha256").update(image.data).digest("hex")) {
      return { experience: state.experience, image };
    }
    if (planningReferenceContext(state).source === "curated") image = null;
  }
  if (!image) {
    const preset = state.input.stylePresetSlug ? await resolvePublishedStylePreset(state.input.stylePresetSlug) : null;
    if (state.input.stylePresetSlug && !preset) throw new Error("The selected style preset is unavailable. Choose a current direction or upload a reference.");
    const query = [
      activeFacts(state).filter(f => ["identity", "jobs", "preferences", "constraints"].includes(f.section)).map(f => f.detail).join("\n"),
      explicitReqs.length ? `Explicit requirements:\n${JSON.stringify(explicitReqs)}` : null,
      preset ? JSON.stringify({ title: preset.title, description: preset.description, style: preset.stylePack }) : null,
      request,
    ].filter(Boolean).join("\n");

    const candidates = await shortlistCuratedStyleReferences(query).catch(() => []);

    let chosenExperience: ReturnType<typeof experienceSchema.parse> | null = null;
    let chosenImage: { data: string; mimeType: string } | null = null;
    let chosenCandidate = candidates[0];

    for (let i = 0; i < Math.min(candidates.length, 3); i += 1) {
      const candidate = candidates[i];
      const candidateImage = await loadCuratedStyleReferenceImage(candidate.reference).catch(() => null);
      if (!candidateImage) continue;

      const candidateHash = createHash("sha256").update(candidateImage.data).digest("hex");
      const started = Date.now();
      const response = await createGeminiClient().models.generateContent({
        model: policy.model, config: policy.config, contents: [{
          role: "user", parts: [
            { text: JSON.stringify({ facts: activeFacts(state), explicitRequirements: explicitReqs, scope: state.scope, request, mode: state.input.imageReferenceMode, referenceSource: "curated" }) },
            { inlineData: { data: candidateImage.data, mimeType: candidateImage.mimeType } },
          ],
        }],
      }).catch(() => null);
      if (!response) {
        // Candidate incompatibility can justify another image. A service
        // failure does not: repeating it for each image only extends the wait.
        onTrace?.({ stage: "reference_candidate", elapsedMs: Date.now() - started,
          errorCode: "OPTIONAL_REFERENCE_INSPECTION_UNAVAILABLE" });
        break;
      }
      onTrace?.({ stage: "reference_candidate", elapsedMs: Date.now() - started,
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount });

      let parsed: unknown;
      try { parsed = JSON.parse(response.text || "{}"); } catch { continue; }
      const checked = experienceSchema.required({ compatibility: true }).safeParse({
        ...(parsed && typeof parsed === "object" ? parsed : {}),
        referenceId: candidate.reference.id,
        referencePath: null,
        referenceHash: candidateHash,
        catalogHash: candidate.catalogHash,
        requirementsKey: reqKey,
      });

      if (!checked.success || !checked.data.compatibility.compatible) continue;
      chosenExperience = checked.data;
      chosenImage = candidateImage;
      chosenCandidate = candidate;

      break;
    }

    if (!chosenImage || !chosenExperience) {
      return buildPromptDirection("optional_reference_unavailable");
    }

    referenceId = chosenCandidate.reference.id;
    catalogHash = chosenCandidate.catalogHash;
    try {
      referencePath = await storePlanningReference(admin, ownerId, chosenImage);
      image = await loadPlanningReference(admin, referencePath, ownerId);
      if (!image) throw new Error("The persisted curated reference could not be read.");
    } catch {
      onTrace?.({ stage: "reference_optional_store", elapsedMs: 0, errorCode: "OPTIONAL_REFERENCE_UNAVAILABLE" });
      return buildPromptDirection("optional_reference_unavailable");
    }

    const referenceHash = createHash("sha256").update(image.data).digest("hex");
    const experience = experienceSchema.parse({
      ...chosenExperience,
      referencePath,
      referenceHash,
      catalogHash,
      requirementsKey: reqKey,
      provenance: "curated",
    });
    return { experience, image };
  }

  const referenceHash = createHash("sha256").update(image.data).digest("hex");
  const recreationFullRequest = recreation
    ? [
        state.input.recreationRequest || state.input.originalRequest || request,
        ...(state.input.recreationChanges ?? []).map(c => `Subsequent user request: ${c.request}`),
      ].filter(Boolean).join("\n\n")
    : request;
  const started = Date.now();
  const response = await createGeminiClient().models.generateContent({
    model: policy.model, config: policy.config, contents: [{
      role: "user", parts: [
        { text: JSON.stringify({ facts: recreation ? [] : activeFacts(state), explicitRequirements: recreation ? [] : explicitReqs, scope: recreation ? state.scope?.manifest : state.scope, request: recreationFullRequest, mode: state.input.imageReferenceMode, referenceSource: referenceId ? "curated" : planningReferenceContext(state).source }) },
        { inlineData: { data: image.data, mimeType: image.mimeType } },
      ],
    }],
  });
  onTrace?.({ stage: "reference_upload", elapsedMs: Date.now() - started,
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount });

  const parsed = JSON.parse(response.text || "{}");
  const sourceFrames = recreation ? await verifySourceDetails(admin, ownerId, image, parsed.frames) : undefined;
  const experience = experienceSchema.required({ compatibility: true }).parse({
    ...parsed, sourceFrames,
    referenceId,
    referencePath,
    referenceHash,
    catalogHash: catalogHash ?? undefined,
    requirementsKey: reqKey,
    provenance: referenceId ? "curated" : "user_upload",
  });
  if (!experience.compatibility.compatible && !recreation) throw new ProductToolError("The supplied reference conflicts with your saved requirements. Explain a compatible adaptation or ask the user which choice to revise; do not substitute a library image.", "USER_REFERENCE_CONFLICT");
  return { experience, image };
}
