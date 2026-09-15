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

export async function inspectProductReference(admin: PlanningStore, ownerId: string, state: ProductPlanning, request: string) {
  const recreation = state.input.imageReferenceMode === "recreate" && Boolean(state.input.imagePath);
  const reqKey = designRequirementsKey(state);
  const explicitReqs = explicitDesignRequirements(state);
  let referenceId: string | null = state.experience?.referencePath === state.input.imagePath ? state.experience.referenceId : null;
  let catalogHash: string | null = state.experience?.referencePath === state.input.imagePath ? state.experience.catalogHash ?? null : null;
  let referencePath = state.input.imagePath;
  let image = state.input.referencePreference?.mode === "none" ? null : await loadPlanningReference(admin, referencePath, ownerId);
  if (referencePath && !image && state.input.referencePreference?.mode !== "none") throw new Error("The supplied reference is unavailable. Restore or replace it before approving designs.");

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
        ...Object.fromEntries(fields.map(field => [field, { type: Type.STRING }])),
        compatibility: {
          type: Type.OBJECT,
          properties: {
            compatible: { type: Type.BOOLEAN },
            conflicts: { type: Type.ARRAY, items: { type: Type.STRING } },
            transfer: { type: Type.STRING },
            rationale: { type: Type.STRING },
          },
          required: ["compatible", "conflicts", "transfer", "rationale"],
        },
      },
      required: [...fields, "compatibility"],
    },
  });

  if (state.input.referencePreference?.mode === "none") {
    const textPrompt = [
      activeFacts(state).map(f => `${f.section}: ${f.label} - ${f.detail}`).join("\n"),
      explicitReqs.length ? `Explicit design requirements:\n${JSON.stringify(explicitReqs)}` : null,
      request,
    ].filter(Boolean).join("\n\n");

    const response = await createGeminiClient().models.generateContent({
      model: policy.model,
      config: {
        ...policy.config,
        systemInstruction: "You are the visual/product designer establishing an experience direction derived entirely from the prompt and user design requirements, without external visual references. Synthesize the visual hierarchy, component density, navigation, and layout adaptations from the explicit requirements and domain needs. Return JSON only.",
      },
      contents: [{ role: "user", parts: [{ text: textPrompt }] }],
    });

    const parsed = JSON.parse(response.text || "{}");
    const experience = experienceSchema.parse({
      ...parsed,
      referenceId: null,
      referencePath: null,
      referenceHash: null,
      catalogHash: undefined,
      requirementsKey: reqKey,
      compatibility: {
        compatible: true,
        conflicts: [],
        transfer: "Prompt-only design direction; strictly preserve explicit user requirements and standard platform ergonomics.",
        rationale: "User selected explicit no-reference mode.",
      },
    });

    return { experience, image: null };
  }

  // A curated asset is reusable only under the same confirmed requirements and
  // exact stored pixels. Stale/rejected candidates return to bounded selection.
  if (image && planningReferenceContext(state).source === "curated") {
    if (state.experience?.requirementsKey === reqKey && state.experience.compatibility?.compatible === true
      && state.experience.referenceHash === createHash("sha256").update(image.data).digest("hex")) {
      return { experience: state.experience, image };
    }
    image = null;
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

    const candidates = await shortlistCuratedStyleReferences(query);

    let chosenExperience: ReturnType<typeof experienceSchema.parse> | null = null;
    let chosenImage: { data: string; mimeType: string } | null = null;
    let chosenCandidate = candidates[0];

    for (let i = 0; i < Math.min(candidates.length, 3); i += 1) {
      const candidate = candidates[i];
      const candidateImage = await loadCuratedStyleReferenceImage(candidate.reference);
      if (!candidateImage) continue;

      const candidateHash = createHash("sha256").update(candidateImage.data).digest("hex");
      const response = await createGeminiClient().models.generateContent({
        model: policy.model, config: policy.config, contents: [{
          role: "user", parts: [
            { text: JSON.stringify({ facts: activeFacts(state), explicitRequirements: explicitReqs, scope: state.scope, request, mode: state.input.imageReferenceMode, referenceSource: "curated" }) },
            { inlineData: { data: candidateImage.data, mimeType: candidateImage.mimeType } },
          ],
        }],
      });

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
      throw new ProductToolError("No compatible reference passed inspection. Keep the saved requirements; ask the user to supply evidence, refine direction, or explicitly continue without references. Do not retry inspection in this turn.", "NO_COMPATIBLE_REFERENCE");
    }

    referenceId = chosenCandidate.reference.id;
    catalogHash = chosenCandidate.catalogHash;
    referencePath = await storePlanningReference(admin, ownerId, chosenImage);
    image = await loadPlanningReference(admin, referencePath, ownerId);
    if (!image) throw new Error("The persisted curated reference could not be read.");

    const referenceHash = createHash("sha256").update(image.data).digest("hex");
    const experience = experienceSchema.parse({
      ...chosenExperience,
      referencePath,
      referenceHash,
      catalogHash,
      requirementsKey: reqKey,
    });
    return { experience, image };
  }

  const referenceHash = createHash("sha256").update(image.data).digest("hex");
  const response = await createGeminiClient().models.generateContent({
    model: policy.model, config: policy.config, contents: [{
      role: "user", parts: [
        { text: JSON.stringify({ facts: recreation ? [] : activeFacts(state), explicitRequirements: recreation ? [] : explicitReqs, scope: recreation ? state.scope?.manifest : state.scope, request: recreation ? state.input.originalRequest || request : request, mode: state.input.imageReferenceMode, referenceSource: referenceId ? "curated" : planningReferenceContext(state).source }) },
        { inlineData: { data: image.data, mimeType: image.mimeType } },
      ],
    }],
  });

  const parsed = JSON.parse(response.text || "{}");
  const sourceFrames = recreation ? await verifySourceDetails(admin, ownerId, image, parsed.frames) : undefined;
  const experience = experienceSchema.required({ compatibility: true }).parse({
    ...parsed, sourceFrames,
    referenceId,
    referencePath,
    referenceHash,
    catalogHash: catalogHash ?? undefined,
    requirementsKey: reqKey,
  });
  if (!experience.compatibility.compatible && !recreation) throw new ProductToolError("The supplied reference conflicts with your saved requirements. Explain a compatible adaptation or ask the user which choice to revise; do not substitute a library image.", "USER_REFERENCE_CONFLICT");
  return { experience, image };
}
