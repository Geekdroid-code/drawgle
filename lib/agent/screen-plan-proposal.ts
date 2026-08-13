export type ScreenProposalProductContext = {
  projectName?: string | null;
  projectPrompt?: string | null;
  appType?: string | null;
  targetAudience?: string | null;
  keyFeatures?: string[] | null;
};

const compactText = (value: string | null | undefined, limit: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);

const normalizeProposalWord = (word: string) =>
  word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word;

const proposalWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .map(normalizeProposalWord);

const GENERIC_PROPOSAL_WORDS = new Set([
  "additional",
  "app",
  "default",
  "detail",
  "existing",
  "generic",
  "new",
  "page",
  "planner",
  "project",
  "root",
  "screen",
  "simple",
  "view",
]);

export const isGenericScreenSuggestion = (value: string | null | undefined) => {
  const clean = compactText(value, 320).toLowerCase().replace(/[.!?]+$/, "");
  if (!clean) return true;
  if (/^(?:a |an |the )?(?:new |additional |simple )?(?:planner|detail|root|generic)?\s*(?:screen|page|view)$/.test(clean)) {
    return true;
  }
  if (/^(?:a )?new screen that (?:follows|matches) the existing project(?: direction)?$/.test(clean)) {
    return true;
  }
  if (/^(?:a |the )?(?:screen|page|view) for (?:the |this )?(?:app|project)$/.test(clean)) {
    return true;
  }

  const meaningfulWords = proposalWords(clean).filter((word) => !GENERIC_PROPOSAL_WORDS.has(word));
  return meaningfulWords.length === 0;
};

const overlappingFeature = (screenName: string, instruction: string, features: string[]) => {
  const requestWords = new Set(proposalWords(`${screenName} ${instruction}`));
  return features
    .map((feature) => ({
      feature: compactText(feature, 120),
      score: proposalWords(feature).filter((word) => requestWords.has(word)).length,
    }))
    .filter(({ feature }) => Boolean(feature))
    .sort((left, right) => right.score - left.score)[0];
};

export const buildScreenSuggestionSummary = ({
  screenName,
  routerRole,
  instruction,
  product,
}: {
  screenName: string;
  routerRole?: string | null;
  instruction: string;
  product: ScreenProposalProductContext;
}) => {
  const routerSummary = compactText(routerRole, 320)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const productVocabulary = new Set(proposalWords([
    product.projectPrompt,
    product.appType,
    product.targetAudience,
    ...(product.keyFeatures ?? []),
  ].filter(Boolean).join(" ")));
  const routerWords = proposalWords(routerSummary).filter((word) => !GENERIC_PROPOSAL_WORDS.has(word));
  const hasProductSignal = routerWords.some((word) => productVocabulary.has(word));
  const isConcreteProductPreview = routerWords.length >= 8 && hasProductSignal;
  if (!isGenericScreenSuggestion(routerSummary) && isConcreteProductPreview) return routerSummary;

  const appLabel = compactText(product.appType, 100)
    || compactText(product.projectName, 100)
    || "this product";
  const audience = compactText(product.targetAudience, 140).replace(/[.!?]+$/, "");
  const features = (product.keyFeatures ?? []).map((feature) => compactText(feature, 120)).filter(Boolean);
  const featureMatch = overlappingFeature(screenName, instruction, features);
  const feature = featureMatch?.score ? featureMatch.feature : compactText(screenName, 100);
  const audienceClause = audience ? `, built for ${audience}` : "";

  return compactText(
    `A focused ${screenName} for ${appLabel}${audienceClause}. It should support ${feature.toLowerCase()} with useful content, a clear primary task, and an obvious next action.`,
    320,
  );
};
