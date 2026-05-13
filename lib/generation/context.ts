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

export type AgentContextScreen = {
  id: string;
  name: string;
  prompt?: string | null;
  status?: string | null;
  summary?: string | null;
  chrome?: string | null;
  navigationItemId?: string | null;
};

export type AgentContextRecentMessage = {
  role: "user" | "model" | "system";
  content: string;
  screenId?: string | null;
  screenName?: string | null;
  event?: string | null;
};

export type AgentContextSnapshot = {
  version: "agent-context-v1";
  project: {
    id: string;
    name?: string | null;
    originalPrompt?: string | null;
    charterSummary?: string | null;
    creativeDirection?: string | null;
    navigationArchitecture?: string | null;
    hasDesignTokens: boolean;
  };
  navigationPlan: {
    enabled: boolean;
    kind?: string | null;
    items: Array<{
      id: string;
      label: string;
      icon: string;
      linkedScreenName: string;
    }>;
    screenChrome: Array<{
      screenName: string;
      chrome: string;
      navigationItemId?: string | null;
    }>;
    visualBrief?: string | null;
  } | null;
  activeGeneration?: {
    id: string;
    status: string;
  } | null;
  pendingProposal?: {
    messageId: string;
    prompt: string;
    screenName: string;
    screenType: string;
    screenDescription: string;
    status?: string | null;
    expiresAt: string;
  } | null;
  agentState?: unknown | null;
  selected?: {
    activeScreenId?: string | null;
    activeScreenName?: string | null;
    selectedElement?: {
      targetType?: "screen" | "navigation" | null;
      drawgleId?: string | null;
      textPreview?: string | null;
    } | null;
  } | null;
  screens: Array<{
    id: string;
    name: string;
    prompt?: string | null;
    status?: string | null;
    summary?: string | null;
    chrome?: string | null;
    navigationItemId?: string | null;
    navigationLabel?: string | null;
    roleHint?: string | null;
  }>;
  recentMessages: AgentContextRecentMessage[];
};

const compactText = (value: string | null | undefined, limit = 600) => {
  const text = value?.trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const deriveScreenRoleHint = (screen: AgentContextScreen, navigationPlan: NavigationPlan | null) => {
  const navigationItem = navigationPlan?.items.find((item) => item.linkedScreenName === screen.name);
  if (navigationItem) {
    return `${navigationItem.label} navigation destination`;
  }

  if (screen.chrome) {
    return `${screen.chrome} screen`;
  }

  return compactText(screen.summary, 120);
};

export function buildAgentContextSnapshot({
  project,
  screens,
  navigationPlan,
  activeGeneration,
  pendingProposal,
  agentState,
  activeScreenId,
  selectedElement,
  recentMessages,
}: {
  project: {
    id: string;
    name?: string | null;
    prompt?: string | null;
    charter?: ProjectCharter | null;
    hasDesignTokens?: boolean | null;
  };
  screens: AgentContextScreen[];
  navigationPlan?: NavigationPlan | null;
  activeGeneration?: { id: string; status: string } | null;
  pendingProposal?: {
    messageId: string;
    proposal: {
      prompt: string;
      screenPlan: {
        name: string;
        type: string;
        description: string;
      };
      status?: string | null;
      expiresAt: string;
    };
  } | null;
  agentState?: unknown | null;
  activeScreenId?: string | null;
  selectedElement?: {
    targetType?: "screen" | "navigation" | null;
    drawgleId?: string | null;
    textPreview?: string | null;
  } | null;
  recentMessages?: AgentContextRecentMessage[];
}): AgentContextSnapshot {
  const charter = project.charter ?? null;
  const activeScreen = activeScreenId ? screens.find((screen) => screen.id === activeScreenId) : null;
  const navigationByScreenName = new Map(
    (navigationPlan?.items ?? []).map((item) => [item.linkedScreenName, item.label]),
  );

  return {
    version: "agent-context-v1",
    project: {
      id: project.id,
      name: compactText(project.name, 120),
      originalPrompt: compactText(charter?.originalPrompt ?? project.prompt, 500),
      charterSummary: charter ? compactText(formatCharter(charter), 1200) : null,
      creativeDirection: charter?.creativeDirection
        ? compactText(formatCreativeDirection(charter.creativeDirection), 900)
        : null,
      navigationArchitecture: charter?.navigationArchitecture
        ? compactText(formatNavigationArchitecture(charter), 700)
        : null,
      hasDesignTokens: Boolean(project.hasDesignTokens),
    },
    navigationPlan: navigationPlan
      ? {
          enabled: navigationPlan.enabled,
          kind: navigationPlan.kind,
          items: navigationPlan.items.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            linkedScreenName: item.linkedScreenName,
          })),
          screenChrome: navigationPlan.screenChrome.map((entry) => ({
            screenName: entry.screenName,
            chrome: entry.chrome,
            navigationItemId: entry.navigationItemId ?? null,
          })),
          visualBrief: compactText(navigationPlan.visualBrief, 500),
        }
      : null,
    activeGeneration: activeGeneration ?? null,
    pendingProposal: pendingProposal
      ? {
          messageId: pendingProposal.messageId,
          prompt: compactText(pendingProposal.proposal.prompt, 600) ?? pendingProposal.proposal.prompt,
          screenName: pendingProposal.proposal.screenPlan.name,
          screenType: pendingProposal.proposal.screenPlan.type,
          screenDescription: compactText(pendingProposal.proposal.screenPlan.description, 900) ??
            pendingProposal.proposal.screenPlan.description,
          status: pendingProposal.proposal.status ?? null,
          expiresAt: pendingProposal.proposal.expiresAt,
        }
      : null,
    agentState: agentState ?? null,
    selected: {
      activeScreenId: activeScreenId ?? null,
      activeScreenName: activeScreen?.name ?? null,
      selectedElement: selectedElement ?? null,
    },
    screens: screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      prompt: compactText(screen.prompt, 500),
      status: screen.status ?? null,
      summary: compactText(screen.summary, 500),
      chrome: screen.chrome ?? null,
      navigationItemId: screen.navigationItemId ?? null,
      navigationLabel: navigationByScreenName.get(screen.name) ?? null,
      roleHint: deriveScreenRoleHint(screen, navigationPlan ?? null),
    })),
    recentMessages: (recentMessages ?? []).map((message) => ({
      ...message,
      content: compactText(message.content, 500) ?? "",
    })),
  };
}

export function formatAgentContextSnapshot(snapshot: AgentContextSnapshot) {
  const projectLines = [
    `Project: ${snapshot.project.name ?? snapshot.project.id}`,
    snapshot.project.originalPrompt ? `Original prompt: ${snapshot.project.originalPrompt}` : null,
    snapshot.project.charterSummary ? `Charter:\n${snapshot.project.charterSummary}` : null,
    snapshot.project.creativeDirection ? `Creative direction:\n${snapshot.project.creativeDirection}` : null,
    snapshot.project.navigationArchitecture ? `Navigation architecture:\n${snapshot.project.navigationArchitecture}` : null,
    `Design tokens available: ${snapshot.project.hasDesignTokens ? "yes" : "no"}`,
  ].filter(Boolean);

  const selectedLines = [
    snapshot.selected?.activeScreenName
      ? `Active screen: ${snapshot.selected.activeScreenName} (${snapshot.selected.activeScreenId})`
      : null,
    snapshot.selected?.selectedElement?.drawgleId
      ? `Selected element: ${snapshot.selected.selectedElement.drawgleId}${snapshot.selected.selectedElement.textPreview ? `, preview: ${snapshot.selected.selectedElement.textPreview}` : ""}`
      : null,
  ].filter(Boolean);

  const screenLines = snapshot.screens.map((screen, index) =>
    [
      `${index + 1}. ${screen.name} (${screen.id})`,
      screen.roleHint ? `Role: ${screen.roleHint}` : null,
      screen.status ? `Status: ${screen.status}` : null,
      screen.chrome ? `Chrome: ${screen.chrome}` : null,
      screen.navigationLabel ? `Navigation: ${screen.navigationLabel}` : null,
      screen.summary ? `Summary: ${screen.summary}` : null,
      screen.prompt ? `Original screen prompt: ${screen.prompt}` : null,
    ].filter(Boolean).join("\n"),
  );

  const pendingLines = snapshot.pendingProposal
    ? [
        `Pending proposal: ${snapshot.pendingProposal.screenName}`,
        `Prompt: ${snapshot.pendingProposal.prompt}`,
        `Description: ${snapshot.pendingProposal.screenDescription}`,
        `Status: ${snapshot.pendingProposal.status ?? "pending"}, expires: ${snapshot.pendingProposal.expiresAt}`,
      ]
    : [];

  const navigationLines = snapshot.navigationPlan
    ? [
        `Persistent navigation: ${snapshot.navigationPlan.enabled ? snapshot.navigationPlan.kind ?? "enabled" : "disabled"}`,
        snapshot.navigationPlan.items.length
          ? `Items: ${snapshot.navigationPlan.items.map((item) => `${item.label} (${item.id}, ${item.icon}) -> ${item.linkedScreenName}`).join(", ")}`
          : null,
        snapshot.navigationPlan.visualBrief ? `Visual brief: ${snapshot.navigationPlan.visualBrief}` : null,
        snapshot.navigationPlan.screenChrome.length
          ? `Screen chrome: ${snapshot.navigationPlan.screenChrome.map((entry) => `${entry.screenName}: ${entry.chrome}${entry.navigationItemId ? `/${entry.navigationItemId}` : ""}`).join(", ")}`
          : null,
      ].filter(Boolean)
    : [];

  const messageLines = snapshot.recentMessages.map((message) =>
    `[${message.role}${message.screenName ? `/${message.screenName}` : ""}${message.event ? `/${message.event}` : ""}] ${message.content}`,
  );

  return [
    projectLines.length ? `PROJECT\n${projectLines.join("\n")}` : null,
    navigationLines.length ? `NAVIGATION\n${navigationLines.join("\n")}` : null,
    pendingLines.length ? `PENDING PROPOSAL\n${pendingLines.join("\n")}` : null,
    snapshot.activeGeneration ? `ACTIVE GENERATION\n${snapshot.activeGeneration.id}: ${snapshot.activeGeneration.status}` : null,
    selectedLines.length ? `CURRENT SELECTION\n${selectedLines.join("\n")}` : null,
    snapshot.agentState ? `LIVE AGENT STATE\n${JSON.stringify(snapshot.agentState)}` : null,
    screenLines.length ? `SCREEN INVENTORY\n${screenLines.join("\n\n")}` : null,
    messageLines.length ? `RECENT CONVERSATION\n${messageLines.join("\n")}` : null,
  ].filter(Boolean).join("\n\n");
}

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
