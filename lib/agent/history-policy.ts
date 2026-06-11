import "server-only";

import type { AgentTurnState } from "@/lib/agent/router";

export type HistoryNeed = "none" | "last_few" | "standard";

export type HistoryPolicyInput = {
  prompt: string;
  hasImage: boolean;
  hasSelectedElement: boolean;
  agentState: AgentTurnState | null;
};

/**
 * How many recent messages to include for each tier.
 * "none"     → 0   Self-contained prompt; history is noise, not signal.
 * "last_few" → 3   Follow-up or continuation; need the immediately prior exchange.
 * "standard" → 6   Ambiguous; use a moderate slice for context.
 */
export const HISTORY_LIMITS: Record<HistoryNeed, number> = {
  none: 0,
  last_few: 3,
  standard: 6,
};

// Short prompts that refer back to something ("make it darker", "change that", "try again").
const FOLLOW_UP_PRONOUN_PATTERN =
  /^(make (it|that|this|them)|change (it|that|this)|update (it|that|this)|try (again|that again)|no(,| |$)|actually|instead|wait|undo|revert|go back|what did you|can you (un|re)|that('s| is) (wrong|off|not)|different(ly)?)\b/i;

// Words mid-prompt that signal the user is continuing a prior thread.
const CONTINUATION_WORD_PATTERN =
  /\b(also|but|actually|instead|wait|and (also|make|change|add)|not (that|this)|rather)\b/i;

// Approval words — agentState will already exist so this is belt-and-suspenders.
const APPROVAL_PATTERN =
  /^(yes|yeah|yep|ok|okay|sure|do it|build it|build this|approve|approved|go ahead|looks good|ship it|create it)(\s|[.!?,]|$)/i;

// Questions about what just happened.
const HISTORY_QUESTION_PATTERN =
  /\b(what did you (do|just|change)|what('s| was) (changed|different|updated)|can you (undo|revert|go back))\b/i;

// Canvas object vocabulary — presence makes a prompt likely self-contained.
const CANVAS_NOUN_PATTERN =
  /\b(screen|page|view|section|card|button|header|footer|nav|navigation|form|list|grid|modal|hero|tab|banner|layout|component|text|color|font|spacing|icon|image|background|typography)\b/i;

// Action verbs that signal the user has a full intent in this message.
const STRONG_ACTION_PATTERN =
  /\b(redesign|rebuild|rewrite|create|build|add|generate|make|restyle|revamp|overhaul|replace|design)\b/i;

const STOPWORDS = new Set([
  "a", "an", "and", "app", "can", "for", "i", "in", "is", "it", "make",
  "me", "my", "of", "on", "please", "the", "this", "to", "with",
]);

const meaningfulWordCount = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .length;

/**
 * Classify how much recent message history the router needs for this turn.
 *
 * Designed to be called synchronously right after agentState is extracted,
 * before building the recentMessages array passed to the router LLM.
 *
 * Cost impact:
 *   "none"     → saves up to 5,400 input tokens (12 × 1,800 chars at old cap)
 *   "last_few" → sends ≤3 × 500 chars ≈ 375 tokens instead of up to 5,400
 *   "standard" → sends ≤6 × 500 chars ≈ 750 tokens
 */
export function classifyHistoryNeed(input: HistoryPolicyInput): HistoryNeed {
  const { prompt, hasImage, hasSelectedElement, agentState } = input;
  const text = prompt.trim();

  // Image provides its own context — no history needed.
  if (hasImage) return "none";

  // Active agentState means we're in a continuation (pending clarification,
  // failed edit recovery). Always pull recent messages so the router can
  // resolve the thread correctly.
  if (agentState) {
    // Expired states are already filtered by latestUsableAgentState, so any
    // non-null agentState here is live.
    return "last_few";
  }

  // Explicit follow-up signal at the start of the prompt.
  if (FOLLOW_UP_PRONOUN_PATTERN.test(text)) return "last_few";

  // Approval of a prior proposal (screen plan etc).
  if (APPROVAL_PATTERN.test(text)) return "last_few";

  // Questions about prior actions.
  if (HISTORY_QUESTION_PATTERN.test(text)) return "last_few";

  // Selected element + any action verb: the element IS the context.
  // No need to send old messages.
  if (hasSelectedElement && STRONG_ACTION_PATTERN.test(text)) return "none";

  // Long, descriptive, self-contained prompt with canvas vocabulary and action.
  const wordCount = meaningfulWordCount(text);
  const hasClearTarget = CANVAS_NOUN_PATTERN.test(text);
  const hasAction = STRONG_ACTION_PATTERN.test(text);

  if (wordCount >= 6 && hasClearTarget && hasAction) return "none";

  // Short prompt without any follow-up signal and without canvas target:
  // ambiguous — give the router a moderate slice.
  if (CONTINUATION_WORD_PATTERN.test(text)) return "last_few";

  // Default: moderate context for anything we could not classify confidently.
  return "standard";
}
