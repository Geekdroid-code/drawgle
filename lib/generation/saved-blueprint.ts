import type { ProductPlanning } from "@/lib/product-planning/model";
import type { CreativeDirection, NavigationPlan, ProjectCharter } from "@/lib/types";
import { blueprintNavigationDesign } from "./approved-navigation";

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const texts = (value: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(value) ? value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems) : [];

const savedCreativeDirection = (direction?: CreativeDirection | null) => {
  if (!direction) return null;
  const clipped = {
    conceptName: text(direction.conceptName, 200),
    styleEssence: text(direction.styleEssence, 2400),
    colorStory: text(direction.colorStory, 2400),
    typographyMood: text(direction.typographyMood, 2400),
    surfaceLanguage: text(direction.surfaceLanguage, 2400),
    iconographyStyle: text(direction.iconographyStyle, 2400),
    compositionPrinciples: texts(direction.compositionPrinciples, 10, 600),
    signatureMoments: texts(direction.signatureMoments, 10, 600),
    motionTone: text(direction.motionTone, 2400),
    avoid: texts(direction.avoid, 12, 600),
  };
  return Object.values(clipped).every((value) => value.length > 0) ? clipped : null;
};

/**
 * Batches after the first in an approved flow already have the project's
 * charter, navigation and approved screen list. This rebuilds the planner's
 * blueprint from that saved state, so the blueprint model call is skipped and
 * the charter cannot drift between batches. Returns null when anything the
 * blueprint needs is missing; the caller then plans the blueprint normally.
 */
export function savedProjectBlueprint({ productPlanning, executionKeys, charter, navigationPlan }: {
  productPlanning: ProductPlanning;
  executionKeys: string[];
  charter?: ProjectCharter | null;
  navigationPlan?: NavigationPlan | null;
}): Record<string, unknown> | null {
  const scope = productPlanning.scope;
  const parents = (scope?.status === "approved" ? scope.manifest ?? [] : [])
    .filter((item) => item.kind === "screen")
    .sort((a, b) => a.sequence - b.sequence);
  const parentKeys = new Set(parents.map((item) => item.stableKey));
  const batchKeys = executionKeys.filter((key) => parentKeys.has(key));
  const architecture = charter?.navigationArchitecture;
  // A project without navigation that grows on the canvas may now need it,
  // so only the approved flow that decided "none" reuses that decision.
  const navigationDecided = Boolean(navigationPlan?.version === 2
    && (navigationPlan.enabled || productPlanning.phase === "discovery"));
  if (!charter || !architecture || !navigationPlan || !navigationDecided || batchKeys.length === 0
    || batchKeys.length > 8 || parents.length > 24) return null;

  const rootScreens = new Set([
    ...navigationPlan.items.map((item) => item.linkedScreenName?.toLowerCase()),
    ...navigationPlan.screenChrome.filter((entry) => entry.chrome === "bottom-tabs").map((entry) => entry.screenName.toLowerCase()),
  ].filter(Boolean));
  const design = navigationPlan.design;

  return {
    requires_bottom_nav: navigationPlan.enabled,
    navigation_architecture: {
      kind: architecture.kind,
      primary_navigation: architecture.primaryNavigation,
      root_chrome: architecture.rootChrome,
      detail_chrome: architecture.detailChrome,
      consistency_rules: texts(architecture.consistencyRules, 10, 500).length
        ? texts(architecture.consistencyRules, 10, 500)
        : ["Keep the approved navigation family on every screen."],
      rationale: text(architecture.rationale, 2400) || "Approved project navigation architecture.",
    },
    navigation_plan: {
      version: 2,
      decision: navigationPlan.decision ?? (navigationPlan.enabled ? "project-native" : "none"),
      evidence: {
        source: navigationPlan.evidence?.source ?? null,
        reason: text(navigationPlan.evidence?.reason, 1200) || "Approved project navigation.",
      },
      enabled: navigationPlan.enabled,
      kind: navigationPlan.kind,
      items: navigationPlan.items.slice(0, 5).map((item) => ({
        id: item.id,
        label: text(item.label, 40),
        icon: item.icon,
        role: text(item.role, 240),
        availability: item.availability,
        linked_screen_name: item.linkedScreenName ?? null,
      })),
      design: design ? blueprintNavigationDesign(design) : null,
      visual_brief: text(navigationPlan.visualBrief, 1600) || undefined,
      screen_chrome: navigationPlan.screenChrome.map((entry) => ({
        screen_name: entry.screenName,
        chrome: entry.chrome,
        navigation_item_id: entry.navigationItemId ?? null,
      })),
    },
    roadmap: {
      requested_parent_count: parents.length,
      items: parents.map((item) => {
        const summary = text(item.description, 1200);
        return {
          stable_key: item.stableKey,
          name: item.name,
          type: rootScreens.has(item.name.toLowerCase()) ? "root" : "detail",
          summary: summary.length >= 20 ? summary : `${item.name}: ${text(item.outcome, 1000) || "an approved screen in this flow."}`,
          priority: "required",
          explicitly_requested: true,
          dependency_keys: item.dependencyKeys.filter((key) => parentKeys.has(key)).slice(0, 8),
        };
      }),
      initial_batch_keys: batchKeys,
    },
    // Grounding can leave a field empty (for example no capability facts);
    // those fall back to the approved flow instead of failing validation.
    charter: {
      originalPrompt: text(charter.originalPrompt, 10000)
        || text(productPlanning.input.originalRequest, 10000)
        || text(scope?.goal, 10000),
      imageReferenceSummary: text(charter.imageReferenceSummary, 6000) || null,
      appType: text(charter.appType, 240) || text(scope?.goal, 240) || "Mobile app",
      targetAudience: text(charter.targetAudience, 800) || "The product's primary users",
      navigationModel: text(charter.navigationModel, 800) || (navigationPlan.enabled
        ? "Shared bottom navigation between root destinations"
        : "Screen-specific chrome without persistent navigation"),
      keyFeatures: texts(charter.keyFeatures, 20, 400).length
        ? texts(charter.keyFeatures, 20, 400)
        : parents.slice(0, 20).map((item) => text(item.name, 400)),
      designRationale: text(charter.designRationale, 8000)
        || text(productPlanning.experience?.direction, 8000)
        || "Keep one spacing, type and surface system across every screen.",
      creativeDirection: savedCreativeDirection(charter.creativeDirection),
    },
  };
}
