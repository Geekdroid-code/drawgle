import "server-only";

import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { filterMeaningfulStateVariants } from "@/lib/agent/state-variant-guardrails";
import type { ScreenBaseStatePlan, ScreenPlan, ScreenStateVariantPlan } from "@/lib/types";

const StateVariantSchema = z.object({
  id: z.string().trim().min(1).max(80),
  stateKey: z.string().trim().min(1).max(80),
  stateLabel: z.string().trim().min(1).max(60),
  stateRole: z.string().trim().min(1).max(160),
  triggerLabel: z.string().trim().min(1).max(80),
  description: z.string().trim().min(20).max(1200),
  editInstruction: z.string().trim().min(30).max(1800),
  defaultSelected: z.boolean().default(true),
});

const StateVariantPlanSchema = z.object({
  baseState: z.object({
    stateKey: z.string().trim().min(1).max(80),
    stateLabel: z.string().trim().min(1).max(60),
  }).nullable().optional(),
  stateVariants: z.array(StateVariantSchema).max(3).default([]),
});

const parseJsonResponse = <T>(text: string): T => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  const source = fenced || trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("State variant planner did not return a JSON object.");
  }
  return JSON.parse(source.slice(start, end + 1)) as T;
};

const slugify = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || fallback;
};

const normalizeVariant = (variant: z.infer<typeof StateVariantSchema>, index: number): ScreenStateVariantPlan => {
  const stateKey = slugify(variant.stateKey || variant.stateLabel, `state-${index + 1}`);
  const id = slugify(variant.id || stateKey, stateKey);

  return {
    id,
    stateKey,
    stateLabel: variant.stateLabel,
    stateRole: variant.stateRole,
    triggerLabel: variant.triggerLabel,
    description: variant.description,
    editInstruction: variant.editInstruction,
    defaultSelected: variant.defaultSelected,
  };
};

export async function planScreenStateVariants({
  prompt,
  screenPlan,
  projectContext,
}: {
  prompt: string;
  screenPlan: ScreenPlan;
  projectContext?: string | null;
}): Promise<{
  baseState: ScreenBaseStatePlan | null;
  stateVariants: ScreenStateVariantPlan[];
}> {
  try {
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("draft_plan", {
      responseMimeType: "application/json",
      temperature: 0.18,
      systemInstruction: [
        "You identify optional same-screen UI states for Drawgle screen proposals.",
        "Return ONLY JSON with shape { baseState: { stateKey, stateLabel } | null, stateVariants: [] }.",
        "A same-screen state is a local state of the same route/screen shell that materially changes the screen content or workflow: a tab/segment with a distinct content body, filter/search/sort results, modal/sheet/dialog/popover open state, empty/loading/error state, selected item detail panel, form/create flow, or expanded/collapsed content region.",
        "Do not suggest real navigation routes, detail pages, checkout flows, settings/profile routes, onboarding/login, CTA destinations, shared bottom-nav destinations, or separate app sections.",
        "Reject visual preference states: dark mode, light mode, theme/system appearance, compact mode, density, colors, hover/focus/pressed styling, icon/button color changes, typography, spacing, radius, shadows, or animation-only changes. These are not paid state variants.",
        "If a control only changes styling or preferences without a meaningful content/workflow surface, return stateVariants: [] for that control.",
        "If the screen brief does not clearly need alternate local states, return stateVariants: [].",
        "Return at most 3 variants. Prefer 1-2 high-value variants.",
        "Each editInstruction must tell the edit worker to preserve the parent shell, header, shared navigation, spacing, typography, tokens, and overall layout, changing only the local active state and content region.",
      ].join("\n"),
    });

    const userText = [
      `User request:\n${prompt}`,
      `Parent screen name: ${screenPlan.name}`,
      `Parent screen type: ${screenPlan.type}`,
      `Parent screen brief:\n${screenPlan.description}`,
      projectContext?.trim() ? `Existing project context:\n${projectContext.slice(0, 4000)}` : null,
      [
        "Return JSON only. Example:",
        "{",
        "  \"baseState\": { \"stateKey\": \"transactions\", \"stateLabel\": \"Transactions\" },",
        "  \"stateVariants\": [",
        "    {",
        "      \"id\": \"analytics\",",
        "      \"stateKey\": \"analytics\",",
        "      \"stateLabel\": \"Analytics\",",
        "      \"stateRole\": \"Alternate active tab for analytics content on the same dashboard screen\",",
        "      \"triggerLabel\": \"Analytics tab\",",
        "      \"description\": \"Same dashboard shell with the Analytics tab active and analytics content visible in the tab body.\",",
        "      \"editInstruction\": \"Create a state variant of the parent screen. Preserve the parent shell, header, shared navigation, tokens, typography, spacing, and layout. Set the Analytics tab/segmented control as active and replace only the local tab body with analytics-focused content that matches the existing visual system.\",",
        "      \"defaultSelected\": true",
        "    }",
        "  ]",
        "}",
      ].join("\n"),
    ].filter(Boolean).join("\n\n");

    const response = await ai.models.generateContent({
      model: policy.model,
      contents: userText,
      config: policy.config,
    });

    const parsed = StateVariantPlanSchema.safeParse(parseJsonResponse<unknown>(response.text || "{}"));
    if (!parsed.success) {
      return { baseState: null, stateVariants: [] };
    }

    const seen = new Set<string>();
    const stateVariants = filterMeaningfulStateVariants(parsed.data.stateVariants
      .map(normalizeVariant)
      .filter((variant) => {
        if (seen.has(variant.id)) return false;
        seen.add(variant.id);
        return true;
      }));

    const baseState = stateVariants.length > 0
      ? parsed.data.baseState ?? { stateKey: "base", stateLabel: "Base" }
      : null;

    return { baseState, stateVariants };
  } catch (error) {
    console.error("Failed to plan screen state variants", error);
    return { baseState: null, stateVariants: [] };
  }
}
