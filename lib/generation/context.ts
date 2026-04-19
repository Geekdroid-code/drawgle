import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { DesignTokens, ProjectCharter } from "@/lib/types";

import { generateEmbedding } from "@/lib/generation/embeddings";

type AdminClient = ReturnType<typeof createAdminClient>;
type MatchedScreen = Database["public"]["Functions"]["match_screens"]["Returns"][number];

const DEFAULT_MATCH_COUNT = 5;
const DEFAULT_MATCH_THRESHOLD = 0.55;
const MAX_DESIGN_TOKEN_CHARS = 3000;

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const formatCharter = (charter: ProjectCharter) => [
  `Original intent: ${charter.originalPrompt}`,
  charter.imageReferenceSummary ? `Image reference: ${charter.imageReferenceSummary}` : null,
  `App type: ${charter.appType}`,
  `Audience: ${charter.targetAudience}`,
  `Navigation model: ${charter.navigationModel}`,
  `Key features: ${charter.keyFeatures.join(", ")}`,
  `Design rationale: ${charter.designRationale}`,
]
  .filter(Boolean)
  .join("\n");

const formatCreativeDirection = (creativeDirection: NonNullable<ProjectCharter["creativeDirection"]>) => [
  `Concept: ${creativeDirection.conceptName}`,
  `Style essence: ${creativeDirection.styleEssence}`,
  `Color story: ${creativeDirection.colorStory}`,
  `Typography mood: ${creativeDirection.typographyMood}`,
  `Surface language: ${creativeDirection.surfaceLanguage}`,
  `Iconography: ${creativeDirection.iconographyStyle}`,
  `Composition principles: ${creativeDirection.compositionPrinciples.join(", ")}`,
  `Signature moments: ${creativeDirection.signatureMoments.join(", ")}`,
  `Motion tone: ${creativeDirection.motionTone}`,
  `Avoid: ${creativeDirection.avoid.join(", ")}`,
].join("\n");

const formatDesignTokens = (designTokens: DesignTokens | null) => {
  if (!designTokens?.tokens) {
    return null;
  }

  return truncate(JSON.stringify(designTokens.tokens), MAX_DESIGN_TOKEN_CHARS);
};

const formatDesignTokenMetadata = (designTokens: DesignTokens | null) => {
  if (!designTokens?.meta) {
    return null;
  }

  const lines = [
    designTokens.meta.recommendedFonts?.length
      ? `Recommended fonts: ${designTokens.meta.recommendedFonts.join(", ")}`
      : null,
    designTokens.meta.rationale?.color ? `Color rationale: ${designTokens.meta.rationale.color}` : null,
    designTokens.meta.rationale?.typography ? `Typography rationale: ${designTokens.meta.rationale.typography}` : null,
    designTokens.meta.rationale?.spacing ? `Spacing rationale: ${designTokens.meta.rationale.spacing}` : null,
    designTokens.meta.rationale?.radii ? `Radii rationale: ${designTokens.meta.rationale.radii}` : null,
    designTokens.meta.rationale?.shadows ? `Shadow rationale: ${designTokens.meta.rationale.shadows}` : null,
    designTokens.meta.rationale?.surfaces ? `Surface rationale: ${designTokens.meta.rationale.surfaces}` : null,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : null;
};

const formatMatches = (matches: MatchedScreen[]) =>
  matches
    .map((match, index) => {
      const similarity = typeof match.similarity === "number"
        ? `${Math.round(match.similarity * 100)}%`
        : "n/a";

      return `${index + 1}. ${match.name} (${similarity} match)\n${match.summary}`;
    })
    .join("\n\n");

export async function assembleProjectContext({
  admin,
  projectId,
  userPrompt,
  matchCount = DEFAULT_MATCH_COUNT,
  matchThreshold = DEFAULT_MATCH_THRESHOLD,
}: {
  admin?: AdminClient;
  projectId: string;
  userPrompt: string;
  matchCount?: number;
  matchThreshold?: number;
}): Promise<string> {
  const client = admin ?? createAdminClient();

  const { data: project, error: projectError } = await client
    .from("projects")
    .select("prompt, project_charter, design_tokens")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw projectError;
  }

  if (!project) {
    return "";
  }

  const charter = (project.project_charter as ProjectCharter | null) ?? null;
  const designTokens = (project.design_tokens as DesignTokens | null) ?? null;

  let matches: MatchedScreen[] = [];
  const queryText = userPrompt.trim() || charter?.originalPrompt || project.prompt || "Extend this product with a coherent new screen.";

  try {
    const queryEmbedding = await generateEmbedding(queryText, "RETRIEVAL_QUERY");
    const { data, error } = await client.rpc("match_screens", {
      query_embedding: queryEmbedding,
      p_project_id: projectId,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      throw error;
    }

    matches = data ?? [];
  } catch (error) {
    console.error("Failed to retrieve related screens", error);
  }

  const sections = [
    charter ? `PROJECT CHARTER\n${formatCharter(charter)}` : null,
    charter?.creativeDirection
      ? `CREATIVE DIRECTION\n${formatCreativeDirection(charter.creativeDirection)}`
      : null,
    formatDesignTokens(designTokens)
      ? `APPROVED DESIGN TOKENS\n${formatDesignTokens(designTokens)}`
      : null,
    formatDesignTokenMetadata(designTokens)
      ? `DESIGN TOKEN RATIONALE\n${formatDesignTokenMetadata(designTokens)}`
      : null,
    matches.length > 0
      ? `RELEVANT EXISTING SCREENS\n${formatMatches(matches)}`
      : null,
  ].filter(Boolean);

  if (sections.length === 0) {
    return "";
  }

  return [
    "Use this project memory to stay consistent with the existing product.",
    "Do not duplicate a retrieved screen unless the user explicitly asked to replace or rework it.",
    ...sections,
  ].join("\n\n");
}