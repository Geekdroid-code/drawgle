import "server-only";
import type { DesignStylePack, LlmLogFn, PromptImagePayload, ReferenceMode } from "@/lib/types";
import { generateDesignTokens } from "@/lib/generation/service";
import { analyzeReferenceImageForScope } from "@/lib/generation/scope-contract";
import { compileDesignRequirements, designRequirementsKey } from "./design-requirements";
import { projectDesignPrompt } from "./project-design-preparation";
import { reconcileTokensWithDesignRequirements } from "./reconcile-design";
import type { ProductPlanning } from "./model";

/** The speculative task and Build miss path must use identical token inputs. */
export async function generateProjectDesign(state: ProductPlanning, input: {
  image: PromptImagePayload | null; referenceMode: ReferenceMode; referenceId: string | null;
  designStyle: DesignStylePack | null; llmLog?: LlmLogFn;
}) {
  const prompt = projectDesignPrompt(state);
  // Keep usage accounting without adding project briefs to preparation logs.
  const usageLog: LlmLogFn | undefined = input.llmLog
    ? (label, data) => { if (label.startsWith("[TOKEN USAGE]")) input.llmLog!(label, data); }
    : undefined;
  const referenceAnalysis = (await analyzeReferenceImageForScope({ prompt, image: input.image,
    referenceMode: input.referenceMode, llmLog: usageLog })).analysis;
  const generated = await generateDesignTokens({ prompt, image: input.image, referenceMode: input.referenceMode,
    referenceId: input.referenceId, designStyle: input.designStyle, referenceAnalysis,
    designRequirements: compileDesignRequirements(state, input.referenceMode), llmLog: usageLog });
  const designTokens = await reconcileTokensWithDesignRequirements(generated, state);
  return { designTokens, referenceAnalysis, requirementsKey: designRequirementsKey(state) };
}
