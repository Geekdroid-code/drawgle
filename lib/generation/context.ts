import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { NavigationPlan, ProjectCharter, ProjectMessage } from "@/lib/types";

import { generateEmbedding } from "@/lib/generation/embeddings";
import { createNavigationArchitecture, deriveRequiresBottomNav } from "@/lib/navigation";

type AdminClient = ReturnType<typeof createAdminClient>;
type MatchedScreen = Database["public"]["Functions"]["match_screens"]["Returns"][number];
type MatchedMessage = Database["public"]["Functions"]["match_project_messages"]["Returns"][number];

const DEFAULT_MATCH_COUNT = 5;
const DEFAULT_MATCH_THRESHOLD = 0.55;
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

const formatTypographyRoleContract = () => [
  "nav_title: top bars, modal headers, compact detail headers",
  "screen_title: default title for normal app feature screens",
  "hero_title: onboarding, empty states, splash/editorial hero moments only",
  "section_title: cards, grouped content, list sections, panel headers",
  "metric_value: balances, prices, counters, scores, numeric hero data",
  "body: primary body copy, list item titles, main descriptive text",
  "supporting: supporting copy, subtitles, secondary descriptions",
  "caption: metadata, helper text, and micro-labels",
  "button_label: all buttons, segmented controls, and tappable nav labels",
].join("\n");

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
    `TYPOGRAPHY ROLE CONTRACT\n${formatTypographyRoleContract()}`,
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
// Chat Context - recent messages + semantic retrieval from project_messages
// ---------------------------------------------------------------------------

const RECENT_MESSAGE_COUNT = 6;
const SEMANTIC_MATCH_COUNT = 5;
const SEMANTIC_MATCH_THRESHOLD = 0.50;
const semanticMemoryPromptPattern =
  /\b(like before|same as before|same style|similar to|as earlier|from earlier|previous|last time|that card|that screen|that section|remember|consistent with)\b/i;

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

  // 2. Semantic retrieval - find older relevant messages via embedding
  let semanticMessages: MatchedMessage[] = [];

  if (semanticMemoryPromptPattern.test(userPrompt)) {
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
