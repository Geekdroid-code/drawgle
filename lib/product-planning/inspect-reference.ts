import "server-only";
import { createHash } from "node:crypto";
import { Type } from "@google/genai";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { withProviderRetry } from "@/lib/ai/provider-retry";
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
import { experienceSchema } from "./experience";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import { promptExperience } from "./prompt-experience";
import { loadDesignReference } from "./load-design-reference";

const clip = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max).trim() : "";

const RECREATION_INSPECTION_INSTRUCTION = "Inspect only the supplied frames for faithful recreation. Preserve their visible copy, layout, typography, colors, assets, controls and states. Describe the source itself, not a redesigned product. Product preferences and inherited architecture must not adapt these screens. Apply only explicit user-requested deviations. Return optional frames containing each one-based index and bounds {x,y,width,height} in normalized 0-1 coordinates enclosing its complete visible frame, including overlays/shadows. Omit uncertain bounds. Compatibility is true because the user selected this source for recreation; transfer describes source preservation. Return JSON only.";

/**
 * Whether a library reference's look suits the product, which the library pick cannot know: it ranks the library by
 * how close each reference's description is to the request, and a request's mood words ("premium", "clean",
 * "sophisticated") outweighed what the product was. A reference made for another kind of product is fine, since only
 * its look transfers; one whose look depends on content or a mood the product does not have is not. The person's own
 * upload is never rejected for this: they chose it.
 */
export const CURATED_FIT_RULE = [
  "When referenceSource is \"curated\", also judge whether this look suits this product's content and use, from scope.anatomy and the facts.",
  "Report compatible=false, naming the conflict, when the look cannot be carried without content or a mood this product does not have: a look carried by large photography for a product with little imagery, a loud or playful look for a product people use for focused or serious work, a dense data look for a product people read or browse calmly, or the reverse of any of these.",
  "A reference made for a different kind of product is otherwise compatible, because only its look transfers.",
].join(" ");

/**
 * How a style reference is read. It once asked for the reference's composition and then how to adapt it, and the
 * answer mapped the reference's screens onto the product: a file manager was told to "replace the social metrics
 * with file storage data using the same card-based layout", and came out as a creator's analytics dashboard with a
 * greeting and figure tiles. A style reference is another product; only its look is this product's.
 */
export const STYLE_INSPECTION_INSTRUCTION = [
  "You are the visual designer inspecting the actual provided reference pixels. Curated library references were selected by Drawgle; never describe them as user uploads.",
  "The reference shows another product. Only its look transfers to this one: colour and its rhythm, typography character, surface material and depth, edges and corners, iconography, control styling, imagery treatment, and the craft of each component (how a row, tile, chip, toggle, field or bar is built).",
  "Its screens, sections and their order, content, figures, greetings, feeds, component choices and information architecture never transfer: this product's own facts and scope decide what each screen contains and how it is arranged, and scope.anatomy, when given, names this product's own components and the form each takes.",
  "Write every field about this product, in the reference's visual language:",
  "- observations: the reference's look, concretely. Name no screen, section, content or feature of the reference.",
  "- direction: how this product should look.",
  "- informationHierarchy: how the look builds emphasis (scale and weight contrast, colour, depth, quiet metadata), applied to this product's own priorities. Never carry over the reference's priorities, such as its hero figure or its greeting.",
  "- navigation: only how navigation is drawn (shape, material, active state). Whether there is a bar, and what it holds, come from the product.",
  "- adaptations: for each of this product's own components (scope.anatomy.components when given), the reference treatment that dresses it, written from the product's component to the treatment, for example \"<a component of this product> takes the reference's inset icon wells and quiet two-line metadata\". Never turn a reference component into a component of this product, and never add a component, section or figure because the reference has one.",
  "- compatibility.transfer: the transferable visual rules only.",
  "Preserve product decisions; the reference does not establish hidden business rules.",
  "When explicit user design requirements are provided, evaluate visual compatibility honestly. If the reference's core visual traits clashingly violate explicit constraints (such as dark palette vs explicit white/cream requirement, heavy gradients vs explicit no-gradients), report compatible=false with identified conflicts. If transferable craft (typography, rhythm, surface delicacy) can guide unspecified choices while honoring the explicit constraints, report compatible=true.",
  CURATED_FIT_RULE,
  "Return JSON only.",
].join("\n");

/**
 * What the product is and what its screens show, first in the library query: the request alone let its mood words
 * outweigh the product, and a file manager drew a creator dashboard while an invoice tracker, a subscription tracker
 * and a doctor booking app all drew the same travel tracker. Null for a plan without an anatomy.
 */
export function curatedQueryProduct(state: Pick<ProductPlanning, "scope">): string | null {
  const anatomy = state.scope?.anatomy;
  if (!anatomy) return null;
  return `Product: ${anatomy.kind}. It shows: ${anatomy.components.map(component => component.shows).join("; ")}.`;
}

/** Shape model observations to the saved contract. A verbose answer is
 * shortened, never a reason to discard a good reference. A library candidate
 * needs an explicit compatible verdict; the user's own image does not. */
export function normalizeExperienceFields(value: unknown, verdictRequired = false) {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const compatibility = raw.compatibility && typeof raw.compatibility === "object" ? raw.compatibility as Record<string, unknown> : {};
  const fallback = "Follow the reference image's visual language, adapted to this product's tasks.";
  return {
    ...(Array.isArray(raw.frames) ? { frames: raw.frames } : {}),
    observations: clip(raw.observations, 4000) || fallback,
    direction: clip(raw.direction, 4000) || fallback,
    informationHierarchy: clip(raw.informationHierarchy, 2400) || "Lead each screen with its primary task, then supporting details.",
    navigation: clip(raw.navigation, 2400) || "Use the approved screen actions and destinations.",
    adaptations: clip(raw.adaptations, 4000) || fallback,
    compatibility: {
      compatible: compatibility.compatible === true || (compatibility.compatible === undefined && !verdictRequired),
      conflicts: (Array.isArray(compatibility.conflicts) ? compatibility.conflicts : [])
        .map(item => clip(item, 500)).filter(Boolean).slice(0, 20),
      transfer: clip(compatibility.transfer, 3000),
      rationale: clip(compatibility.rationale, 2000),
    },
  };
}

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
    systemInstruction: recreation ? RECREATION_INSPECTION_INSTRUCTION : STYLE_INSPECTION_INSTRUCTION,
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
      curatedQueryProduct(state),
      activeFacts(state).filter(f => ["identity", "jobs", "preferences", "constraints"].includes(f.section)).map(f => f.detail).join("\n"),
      explicitReqs.length ? `Explicit requirements:\n${JSON.stringify(explicitReqs)}` : null,
      preset ? JSON.stringify({ title: preset.title, description: preset.description, style: preset.stylePack }) : null,
      request,
    ].filter(Boolean).join("\n");

    const candidates = await withProviderRetry(() => shortlistCuratedStyleReferences(query)).catch(() => []);

    let chosenExperience: ReturnType<typeof experienceSchema.parse> | null = null;
    let chosenImage: { data: string; mimeType: string } | null = null;
    let chosenCandidate = candidates[0];

    for (let i = 0; i < Math.min(candidates.length, 3); i += 1) {
      const candidate = candidates[i];
      const candidateImage = await loadCuratedStyleReferenceImage(candidate.reference).catch(() => null);
      if (!candidateImage) continue;

      const candidateHash = createHash("sha256").update(candidateImage.data).digest("hex");
      const started = Date.now();
      const response = await withProviderRetry(() => createGeminiClient().models.generateContent({
        model: policy.model, config: policy.config, contents: [{
          role: "user", parts: [
            { text: JSON.stringify({ facts: activeFacts(state), explicitRequirements: explicitReqs, scope: state.scope, request, mode: state.input.imageReferenceMode, referenceSource: "curated" }) },
            { inlineData: { data: candidateImage.data, mimeType: candidateImage.mimeType } },
          ],
        }],
      })).catch(() => null);
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
        ...normalizeExperienceFields(parsed, true),
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
  const response = await withProviderRetry(() => createGeminiClient().models.generateContent({
    model: policy.model, config: policy.config, contents: [{
      role: "user", parts: [
        { text: JSON.stringify({ facts: recreation ? [] : activeFacts(state), explicitRequirements: recreation ? [] : explicitReqs, scope: recreation ? state.scope?.manifest : state.scope, request: recreationFullRequest, mode: state.input.imageReferenceMode, referenceSource: referenceId ? "curated" : planningReferenceContext(state).source }) },
        { inlineData: { data: image.data, mimeType: image.mimeType } },
      ],
    }],
  }));
  onTrace?.({ stage: "reference_upload", elapsedMs: Date.now() - started,
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount });

  let raw: unknown = {};
  try { raw = JSON.parse(response.text || "{}"); } catch { raw = {}; }
  const { frames, ...observed } = normalizeExperienceFields(raw);
  const sourceFrames = recreation ? await verifySourceDetails(admin, ownerId, image, frames) : undefined;
  // The user chose this image. Where it conflicts with their explicit written
  // requirements, those requirements win and the reference still guides the
  // rest of the craft; it is never grounds to stop planning.
  const compatibility = observed.compatibility.compatible || recreation ? observed.compatibility : {
    ...observed.compatibility, compatible: true,
    rationale: `Explicit user requirements take precedence where this reference conflicts: ${observed.compatibility.conflicts.join("; ") || observed.compatibility.rationale}`.slice(0, 2000),
  };
  const experience = experienceSchema.required({ compatibility: true }).parse({
    ...observed, compatibility, sourceFrames,
    referenceId,
    referencePath,
    referenceHash,
    catalogHash: catalogHash ?? undefined,
    requirementsKey: reqKey,
    provenance: referenceId ? "curated" : "user_upload",
  });
  return { experience, image };
}
