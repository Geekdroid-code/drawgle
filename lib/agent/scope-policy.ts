import "server-only";

export type ScopePolicyInput = {
  prompt: string;
  hasImage: boolean;
  hasSelectedElement: boolean;
  hasSelectedScreen: boolean;
};

export type ScopePolicyResult =
  | { verdict: "hard_reject"; reasonCode: "content_spam" | "general_advice" | "code_request"; userMessage: string }
  | { verdict: "allow" }
  | { verdict: "route" };

// Canvas objects and design actions that confirm the user is talking about the canvas.
const CANVAS_OBJECT_PATTERN =
  /\b(app|canvas|screen|page|view|ui|ux|layout|component|section|card|button|tab|nav|navigation|hero|form|list|grid|modal|sheet|header|footer|text|copy|color|spacing|font|typography|style|design|mobile|ios|android|prototype|wireframe)\b/i;

const DESIGN_ACTION_PATTERN =
  /\b(create|build|generate|add|edit|change|modify|update|replace|remove|delete|redesign|restyle|rewrite|repair|fix|make|move|resize|align|polish|improve|tighten|plan|draft|review|critique)\b/i;

// Obvious off-topic categories that should never touch the router or DB.
const CONTENT_SPAM_PATTERN =
  /\b(write|compose|draft|generate|make)\s+(me\s+)?(a\s+|an\s+|the\s+)?(poem|song|story|joke|blog|article|essay|email|tweet|thread|caption|resume|cover letter|linkedin|press release)\b/i;

const GENERAL_ADVICE_PATTERN =
  /\b(design philosophy|business plan|marketing strategy|seo|life advice|homework|recipe|travel itinerary|legal advice|medical advice|stock pick|crypto|weather|news)\b/i;

const CODE_REQUEST_PATTERN =
  /\b(write|debug|fix|explain)\s+(code|python|javascript|sql|regex|script)\b/i;

export const SCOPE_REFUSAL_MESSAGE =
  "I can only help with designing, editing, or planning this app canvas. Try describing a screen or UI change you want to make.";

function hasDesignIntent(input: ScopePolicyInput): boolean {
  if (input.hasImage) return true;
  const { prompt } = input;
  const mentionsCanvasObject = CANVAS_OBJECT_PATTERN.test(prompt);
  const hasAction = DESIGN_ACTION_PATTERN.test(prompt);
  const scopedEdit = (input.hasSelectedElement || input.hasSelectedScreen) && hasAction;
  return scopedEdit || (mentionsCanvasObject && hasAction);
}

/**
 * Classify a user prompt into one of three verdicts before touching the router or any DB.
 *
 * - `hard_reject`: Obviously off-topic spam, general advice, or code request.
 *   Return an immediate refusal — zero router tokens, zero DB writes.
 *
 * - `allow`: Clear design/canvas intent detected.
 *   Proceed directly to the router without further gating.
 *
 * - `route`: Ambiguous — no clear design signal but not obviously spam.
 *   Let the router apply semantic judgment as a backup guard.
 */
export function checkScope(input: ScopePolicyInput): ScopePolicyResult {
  const { prompt, hasImage, hasSelectedElement, hasSelectedScreen } = input;

  // Empty prompt is valid; schema validation handles truly empty submissions.
  if (!prompt.trim() && !hasImage) return { verdict: "allow" };

  // Fast-allow: active canvas context + design action → unambiguous canvas edit.
  if ((hasSelectedElement || hasSelectedScreen) && DESIGN_ACTION_PATTERN.test(prompt)) {
    return { verdict: "allow" };
  }

  // Fast-allow: image attached → visual design intent implied.
  if (hasImage) return { verdict: "allow" };

  // Detect obvious off-topic content. Only hard-reject when there is no design
  // intent at all — a request like "fix the button color and write the launch tweet"
  // should route so the router can decide which part to handle.
  const isSpam   = CONTENT_SPAM_PATTERN.test(prompt);
  const isAdvice = GENERAL_ADVICE_PATTERN.test(prompt);
  const isCode   = CODE_REQUEST_PATTERN.test(prompt);

  if ((isSpam || isAdvice || isCode) && !hasDesignIntent(input)) {
    const reasonCode = isSpam ? "content_spam" : isAdvice ? "general_advice" : "code_request";
    return { verdict: "hard_reject", reasonCode, userMessage: SCOPE_REFUSAL_MESSAGE };
  }

  // Clear design signal → allow.
  if (hasDesignIntent(input)) return { verdict: "allow" };

  // No design signal and not obviously spam → let the router apply semantic judgment.
  return { verdict: "route" };
}
