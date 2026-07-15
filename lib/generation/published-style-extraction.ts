type PublishedScreenSource = {
  name?: string | null;
  code?: string | null;
};

export interface PublishedConstructionEvidence {
  signal: string;
  screens: string[];
}

export interface PublishedConstructionExtraction {
  layoutGrammar: string[];
  componentRecipes: string[];
  evidence: PublishedConstructionEvidence[];
}

const unique = (items: string[]) => Array.from(new Set(items));

const screenNamesMatching = (
  screens: PublishedScreenSource[],
  pattern: RegExp,
) => unique(screens
  .filter((screen) => pattern.test(screen.code ?? ""))
  .map((screen, index) => screen.name?.trim() || `Screen ${index + 1}`));

/**
 * Convert proven showcase HTML constructions into portable style knowledge.
 * This intentionally records anatomy, not product copy or information
 * architecture, so published presets retain more than colors and radii.
 */
export const extractPublishedConstructionKnowledge = (
  screens: PublishedScreenSource[],
): PublishedConstructionExtraction => {
  const evidence: PublishedConstructionEvidence[] = [];
  const layoutGrammar: string[] = [];
  const componentRecipes: string[] = [];
  const add = ({
    signal,
    pattern,
    layout,
    component,
  }: {
    signal: string;
    pattern: RegExp;
    layout?: string;
    component?: string;
  }) => {
    const matchedScreens = screenNamesMatching(screens, pattern);
    if (!matchedScreens.length) return;
    evidence.push({ signal, screens: matchedScreens.slice(0, 5) });
    if (layout) layoutGrammar.push(`${layout} Proven in: ${matchedScreens.slice(0, 3).join(", ")}.`);
    if (component) componentRecipes.push(`${component} Proven in: ${matchedScreens.slice(0, 3).join(", ")}.`);
  };

  add({
    signal: "overlap-and-anchoring",
    pattern: /(?:-mt-|-[lrbt]?-?\[\d+px\]|absolute\s|translate-[xy]-|translate-[xy]-\[)/,
    layout: "Use deliberate overlap or edge anchoring where the source does: preserve the parent/child stacking relationship, clipping boundary, and clearance instead of converting it into another vertical card.",
  });
  add({
    signal: "horizontal-partial-peek-rail",
    pattern: /overflow-x-(?:auto|scroll)[\s\S]{0,500}(?:min-w-|shrink-0|snap-x)|(?:min-w-|shrink-0|snap-x)[\s\S]{0,500}overflow-x-(?:auto|scroll)/,
    layout: "Use a horizontal partial-peek rail as a spatial navigation device: fixed-width children, controlled gap, clipped next item, and no wrapping into an equal card grid.",
  });
  add({
    signal: "edge-connected-sheet",
    pattern: /rounded-t(?:-|\[)|rounded-\[.*?\][\s\S]{0,220}(?:-mt-|absolute|translate-y)/,
    layout: "Use an edge-connected sheet or stage boundary as one continuous silhouette; only the exposed corners round, while the connected edge remains structurally joined.",
  });
  add({
    signal: "asymmetric-grid",
    pattern: /grid-cols-[\d\[]+[\s\S]{0,700}(?:col-span-|row-span-)/,
    layout: "Preserve unequal grid spans and a dominant module; supporting modules align to its rail or baseline and must not become equal repeated tiles.",
  });
  add({
    signal: "full-bleed-breakout",
    pattern: /(?:-mx-|w-screen|left-1\/2[^\n]{0,160}-translate-x-1\/2|inset-x-0)/,
    layout: "Allow a focal media/data plane to break the normal content rail while its labels and controls remain aligned to safe screen margins.",
  });
  add({
    signal: "constructed-data-visualization",
    pattern: /<svg\b|<path\b|<polyline\b|stroke-dasharray|conic-gradient|clip-path/,
    component: "Construct charts, gauges, progress fields, or custom silhouettes as visible SVG/CSS geometry with a definite size and meaningful annotations; never substitute an empty chart card.",
  });
  add({
    signal: "controlled-atmosphere",
    pattern: /(?:radial-gradient|linear-gradient|bg-gradient-|blur-\[|filter:\s*blur)/,
    component: "Treat gradients and blurred light as localized compositional layers with an anchor and falloff. Keep them behind readable content and do not apply glow uniformly to every surface.",
  });
  add({
    signal: "translucent-material",
    pattern: /(?:backdrop-blur|backdrop-filter|rgba\([^)]*,\s*0\.[0-9]+)/,
    component: "Build translucent material as a stack: backdrop blur, controlled translucent fill, hairline/edge highlight, and contrast-safe content. Do not approximate it with opacity alone.",
  });
  add({
    signal: "custom-clipping",
    pattern: /(?:clip-path|mask-image|overflow-hidden[\s\S]{0,180}(?:absolute|scale-|translate-))/, 
    component: "Preserve intentional clipping and custom silhouette geometry on featured modules; the clipping parent, decorative plane, and foreground content must remain separate layers.",
  });

  return {
    layoutGrammar: layoutGrammar.slice(0, 6),
    componentRecipes: componentRecipes.slice(0, 6),
    evidence,
  };
};
