import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { DesignTokens, NavigationPlan, ProjectCharter, ProjectMessage } from "@/lib/types";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { generateEmbedding } from "@/lib/generation/embeddings";
import { createNavigationArchitecture, deriveRequiresBottomNav } from "@/lib/navigation";

type AdminClient = ReturnType<typeof createAdminClient>;
type MatchedScreen = Database["public"]["Functions"]["match_screens"]["Returns"][number];
type MatchedMessage = Database["public"]["Functions"]["match_project_messages"]["Returns"][number];

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

const formatNavigationArchitecture = (charter: ProjectCharter) => {
  if (!charter.navigationArchitecture) {
    return null;
  }

  const normalized = createNavigationArchitecture({
    navigationArchitecture: charter.navigationArchitecture,
    requiresBottomNav: deriveRequiresBottomNav(charter.navigationArchitecture),
  });

  return [
    `Kind: ${normalized.kind}`,
    `Primary navigation: ${normalized.primaryNavigation}`,
    `Root chrome: ${normalized.rootChrome}`,
    `Detail chrome: ${normalized.detailChrome}`,
    `Rationale: ${normalized.rationale}`,
    `Consistency rules: ${normalized.consistencyRules.join(", ")}`,
  ].join("\n");
};

const formatNavigationPlan = (navigationPlan: NavigationPlan | null) => {
  if (!navigationPlan) {
    return null;
  }

  if (!navigationPlan.enabled) {
    return "Persistent navigation: disabled";
  }

  return [
    `Persistent navigation: ${navigationPlan.kind}`,
    `Items: ${navigationPlan.items.map((item) => `${item.label} (${item.id}, ${item.icon}) -> ${item.linkedScreenName}`).join(", ")}`,
    `Visual brief: ${navigationPlan.visualBrief}`,
    `Screen chrome: ${navigationPlan.screenChrome.map((entry) => `${entry.screenName}: ${entry.chrome}${entry.navigationItemId ? `/${entry.navigationItemId}` : ""}`).join(", ")}`,
  ].join("\n");
};

const formatDesignTokens = (designTokens: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens);

  if (!normalized?.tokens) {
    return null;
  }

  return truncate(JSON.stringify(normalized.tokens), MAX_DESIGN_TOKEN_CHARS);
};

const formatDesignContract = (designTokens: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens);

  if (!normalized?.tokens) {
    return null;
  }

  const tokens = normalized.tokens;

  return [
    `Standard app radius: ${tokens.radii?.app ?? "18px"}`,
    `Pill radius: ${tokens.radii?.pill ?? "9999px"} (use only for capsule controls)`,
    `Standard border width: ${tokens.border_widths?.standard ?? "1px"}`,
    `Standard surface shadow: ${tokens.shadows?.surface ?? "0 12px 32px rgba(15,23,42,0.14)"}`,
    `Overlay shadow: ${tokens.shadows?.overlay ?? "0 -4px 24px rgba(15,23,42,0.18)"}`,
    `Screen margin: ${tokens.mobile_layout?.screen_margin ?? "20px"}`,
    `Section gap: ${tokens.mobile_layout?.section_gap ?? "24px"}`,
    `Element gap: ${tokens.mobile_layout?.element_gap ?? "16px"}`,
    `Standard button height: ${tokens.sizing?.standard_button_height ?? "52px"}`,
    `Standard input height: ${tokens.sizing?.standard_input_height ?? "48px"}`,
  ].join("\n");
};

const formatTypographyRoleContract = () => [
  "title_large: hero moments and strongest landing headlines",
  "title_main: screen titles and key section headers",
  "body_primary: primary body copy and list item titles",
  "body_secondary: supporting copy and secondary descriptions",
  "caption: metadata, helper text, and micro-labels",
  "button_label: all buttons, segmented controls, and tappable nav labels",
].join("\n");

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
  const { data: projectNavigation } = await client
    .from("project_navigation")
    .select("plan")
    .eq("project_id", projectId)
    .maybeSingle();
  const navigationPlan = (projectNavigation?.plan as NavigationPlan | null) ?? null;

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
    charter?.navigationArchitecture
      ? `NAVIGATION ARCHITECTURE\n${formatNavigationArchitecture(charter)}`
      : null,
    formatNavigationPlan(navigationPlan)
      ? `APPROVED NAVIGATION PLAN\n${formatNavigationPlan(navigationPlan)}`
      : null,
    charter?.creativeDirection
      ? `CREATIVE DIRECTION\n${formatCreativeDirection(charter.creativeDirection)}`
      : null,
    formatDesignContract(designTokens)
      ? `APPROVED DESIGN CONTRACT\n${formatDesignContract(designTokens)}`
      : null,
    `TYPOGRAPHY ROLE CONTRACT\n${formatTypographyRoleContract()}`,
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

// ---------------------------------------------------------------------------
// Chat Context — recent messages + semantic retrieval from project_messages
// ---------------------------------------------------------------------------

const RECENT_MESSAGE_COUNT = 6;
const SEMANTIC_MATCH_COUNT = 5;
const SEMANTIC_MATCH_THRESHOLD = 0.50;

export async function assembleChatContext({
  admin,
  projectId,
  userPrompt,
  recentMessages,
}: {
  admin?: AdminClient;
  projectId: string;
  userPrompt: string;
  recentMessages: ProjectMessage[];
}): Promise<Array<{ role: "user" | "model"; content: string }>> {
  const client = admin ?? createAdminClient();

  // 1. Take the last N messages for recency
  const recent = recentMessages.slice(-RECENT_MESSAGE_COUNT);

  // 2. Semantic retrieval — find older relevant messages via embedding
  let semanticMessages: MatchedMessage[] = [];

  try {
    const queryEmbedding = await generateEmbedding(userPrompt, "RETRIEVAL_QUERY");
    const { data, error } = await client.rpc("match_project_messages", {
      query_embedding: queryEmbedding,
      p_project_id: projectId,
      match_threshold: SEMANTIC_MATCH_THRESHOLD,
      match_count: SEMANTIC_MATCH_COUNT,
    });

    if (error) {
      console.error("Failed to match project messages", error);
    } else {
      semanticMessages = data ?? [];
    }
  } catch (error) {
    console.error("Failed to embed query for message retrieval", error);
  }

  // 3. Deduplicate: remove semantic results that overlap with recent
  const recentIds = new Set(recent.map((m) => m.id));
  const uniqueSemantic = semanticMessages.filter(
    (m) => !recentIds.has(m.message_id),
  );

  // 4. Build the LLM history: semantic context first (as a summary), then recent messages
  const history: Array<{ role: "user" | "model"; content: string }> = [];

  if (uniqueSemantic.length > 0) {
    const summaryText = uniqueSemantic
      .map((m) => `[${m.role}] ${m.content.slice(0, 300)}`)
      .join("\n\n");

    history.push({
      role: "user",
      content: `[Earlier conversation context for reference]\n${summaryText}`,
    });
    history.push({
      role: "model",
      content: "Understood. I have the earlier context and will use it as needed.",
    });
  }

  for (const msg of recent) {
    if (msg.role === "user" || msg.role === "model") {
      history.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return history;
}
