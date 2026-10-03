/** A conservative routing backstop; the semantic router handles phrasing outside these common requests. */
export type NavigationEditIntent = "reuse" | "redesign" | "edit";

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
  if (/\b(?:reuse|re-use|same|consistent|different navs?|different navigation)\b/i.test(prompt)
    || /\b(?:add|create|build|use|apply|put|include|copy)\b[^.!?]{0,80}\b(?:nav(?:igation)?|tab bar|bottom bar)\b/i.test(prompt)
    || /\b(?:nav(?:igation)?|tab bar)\b[^.!?]{0,70}\b(?:this|that|another|second)\s+(?:screen|page)\b/i.test(prompt)) {
    // A request to redesign an existing bar is not a reuse request.
    if (!/\b(?:redesign|restyle|moderni[sz]e|revamp|improve)\b/i.test(prompt)
      && !/\b(?:create|make|build)\b[^.!?]{0,35}\bnew\b/i.test(prompt)) return "reuse";
    // Complaints about an unwanted new bar must not trigger another redesign.
    if (/why\b[^.!?]{0,100}\bnew\b|didn'?t\s+(?:you\s+)?use|different navs?/i.test(prompt)) return "reuse";
  }
  if (/\b(?:redesign|restyle|moderni[sz]e|revamp|premium|modern|better|new|improve)\b/i.test(prompt)) return "redesign";
  return "edit";
}
