/**
 * What a navigation request asks for. The semantic router decides this from the person's own words; the patterns
 * below are a conservative backstop for when it could not.
 * - reuse: put the accepted nav on a screen. Its look and tabs stay exactly as they are.
 * - restyle: change how the nav looks. The tabs stay.
 * - redesign: a new or better nav for this app. Both its look and which tabs it has are open.
 * - destinations: add, remove, rename, reorder or re-icon specific tabs. The look stays.
 */
export const NAVIGATION_EDIT_INTENTS = ["reuse", "restyle", "redesign", "destinations"] as const;
export type NavigationEditIntent = typeof NAVIGATION_EDIT_INTENTS[number];

export const parseNavigationEditIntent = (value: unknown): NavigationEditIntent | null =>
  NAVIGATION_EDIT_INTENTS.find(intent => intent === value) ?? null;

const REDESIGN_WORDS = /\b(?:redesign|restyle|moderni[sz]e|revamp|premium|modern|better|new|improve|creative)\b/i;
// A tab bar is the nav itself, not one of its tabs.
const DESTINATION_CHANGE = /\b(?:add|remove|delete|drop|rename|reorder|swap)\b[^.!?]{0,40}\b(?:tabs?(?!\s*bar)|destinations?)\b|\brename\s+["']?[^"'\s]+["']?\s+to\b/i;

export function navigationEditIntent(prompt: string, navigationSelected = false): NavigationEditIntent | null {
  const namesNavigation = /\b(nav(?:s|bar|igation)?|tab\s*bar|bottom\s+bar|floating\s+dock)\b/i.test(prompt);
  if (!namesNavigation && !navigationSelected) return null;
  if (/\b(?:redesign|rewrite|rebuild|replace)\s+(?:the\s+)?(?:whole|entire|full)\s+(?:screen|page)\b/i.test(prompt)) return null;
  if (/\b(?:card|button|header|background|chart)\b[^.!?]{0,50}\b(?:match|like|same as|same color as|same style as)\b[^.!?]{0,30}\bnav/i.test(prompt)) return null;
  // Mentioning chrome as a constraint on a different edit must not redirect that edit.
  if (/\b(?:keep|preserve|leave|without changing|do not change|don't change)\b[^.!?]{0,50}\b(?:nav(?:igation)?|tab bar)\b/i.test(prompt)) return null;
  if (!navigationSelected) {
    const directRequest = /\b(?:add|create|build|use|reuse|re-use|apply|put|include|copy|make|change|edit|redesign|restyle|moderni[sz]e|revamp|improve|replace|move|fix|remove)\s+(?:(?:the|a|an|this|that|our|my|existing|new|shared|premium|modern|better|bottom|floating|primary|project|same)\s+){0,8}(?:nav(?:s|bar|igation)?|tab\s*bar|bottom\s+bar|dock)\b/i.test(prompt);
    const complaint = /\b(?:different|inconsistent)\s+nav(?:s|igation)?\b/i.test(prompt);
    const navSubject = /^(?:(?:the|this|our|bottom|shared|primary)\s+)*(?:nav(?:bar|igation)?|tab\s*bar)\b/i.test(prompt.trim());
    if (!directRequest && !complaint && !navSubject) return null;
  }
  // "Add a profile tab to the nav" changes the tabs; it is not a request to put the nav somewhere.
  if (DESTINATION_CHANGE.test(prompt) && !REDESIGN_WORDS.test(prompt)) return "destinations";
  if (/\b(?:reuse|re-use|same|consistent|different navs?|different navigation)\b/i.test(prompt)
    || /\b(?:add|create|build|use|apply|put|include|copy)\b[^.!?]{0,80}\b(?:nav(?:igation)?|tab bar|bottom bar)\b/i.test(prompt)
    || /\b(?:nav(?:igation)?|tab bar)\b[^.!?]{0,70}\b(?:this|that|another|second)\s+(?:screen|page)\b/i.test(prompt)) {
    // A request to redesign an existing bar is not a reuse request.
    if (!/\b(?:redesign|restyle|moderni[sz]e|revamp|improve)\b/i.test(prompt)
      && !/\b(?:create|make|build)\b[^.!?]{0,35}\bnew\b/i.test(prompt)) return "reuse";
    // Complaints about an unwanted new bar must not trigger another redesign.
    if (/why\b[^.!?]{0,100}\bnew\b|didn'?t\s+(?:you\s+)?use|different navs?/i.test(prompt)) return "reuse";
  }
  if (REDESIGN_WORDS.test(prompt)) return "redesign";
  return "restyle";
}
