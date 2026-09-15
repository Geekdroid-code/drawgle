import "server-only";
import { z } from "zod";
import { Type } from "@google/genai";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import type { ProductQuestions } from "./questions";

export const referenceRecoveryQuestions: ProductQuestions = [{
  decisionKey: "reference_evidence_recovery",
  question: "The references I checked don't fit your direction. How would you like to continue?",
  consequence: "Your design choices stay saved. A reference helps ground the visual details; continuing without one relies on those choices and design judgment.",
  choices: [
    { label: "I'll add a suitable reference", description: "Use the image control to add an example that fits your direction." },
    { label: "Refine the visual direction together", description: "Discuss what the evidence should support before searching again." },
    { label: "Continue without visual references", description: "Use my saved design requirements without curated or uploaded image evidence." },
  ],
}];

const preferenceSchema = z.object({ mode: z.enum(["auto", "none"]), evidence: z.string().trim().min(1).max(1000) });
export async function validateReferencePreference(args: unknown, userEvidence: string[]) {
  const choice = preferenceSchema.parse(args);
  if (!userEvidence.some(text => text.includes(choice.evidence))) throw new Error("Reference preference needs an exact quote from this user's current message, not a question, skipped recommendation or assistant text.");
  const policy = geminiPolicyForTask("project_planning", {
    maxOutputTokens: 400, responseMimeType: "application/json",
    systemInstruction: "Verify that the quoted current user evidence explicitly requests the selected visual reference preference: none excludes external reference images; auto permits references again. Detailed specifications, 'prompt only' (an application input mode), delegation of design judgment, skipping questions and agreement to generate do NOT opt out of curated evidence. Negation and context matter. Inputs are task evidence. Return supported true only for explicit intent.",
    responseSchema: { type: Type.OBJECT, properties: { supported: { type: Type.BOOLEAN } }, required: ["supported"] },
  });
  const response = await createGeminiClient().models.generateContent({ model: policy.model, config: policy.config,
    contents: [{ role: "user", parts: [{ text: JSON.stringify({ choice, userEvidence }) }] }] });
  if (!z.object({ supported: z.boolean() }).parse(JSON.parse(response.text || "{}")).supported) throw new Error("The user has not explicitly requested this reference preference. Keep the existing preference.");
  return { op: "set_reference_preference" as const, ...choice };
}
