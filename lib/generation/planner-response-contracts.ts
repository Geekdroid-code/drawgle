type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const firstDefined = (record: JsonRecord, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const firstText = (record: JsonRecord, keys: string[]) => {
  const value = firstDefined(record, keys);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const slug = (value: string, fallback: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
};

const normalizeNavigationDesign = (value: unknown) => {
  if (!isRecord(value)) return value ?? null;
  return {
    anatomy: firstDefined(value, ["anatomy", "family", "style"]),
    width: firstDefined(value, ["width", "width_mode", "widthMode"]),
    labels: firstDefined(value, ["labels", "label_mode", "labelMode"]),
    active_treatment: firstDefined(value, ["active_treatment", "activeTreatment", "active_state", "activeState"]),
    surface: firstDefined(value, ["surface", "material"]),
    radius_px: firstDefined(value, ["radius_px", "radiusPx", "radius"]),
    safe_area_offset_px: firstDefined(value, ["safe_area_offset_px", "safeAreaOffsetPx", "safe_area_offset", "safeAreaOffset"]),
    item_gap_px: firstDefined(value, ["item_gap_px", "itemGapPx", "item_gap", "itemGap"]),
    icon_size_px: firstDefined(value, ["icon_size_px", "iconSizePx", "icon_size", "iconSize"]),
    border: firstDefined(value, ["border", "has_border", "hasBorder"]),
    elevation: firstDefined(value, ["elevation", "shadow"]),
    center_action_item_id: firstDefined(value, ["center_action_item_id", "centerActionItemId"]),
  };
};

const normalizeNavigationPlan = (value: unknown, roadmap: unknown) => {
  if (!isRecord(value)) return value;
  const decision = firstText(value, ["decision", "navigation_decision", "navigationDecision"]) ?? "none";
  const normalizedDecision = decision.toLowerCase();
  const disabled = /^(?:none|disabled|no-navigation)$/.test(normalizedDecision);
  const rawEvidence = isRecord(value.evidence) ? value.evidence : {};
  const rawItems = Array.isArray(value.items)
    ? value.items
    : Array.isArray(value.destinations)
      ? value.destinations
      : [];
  const items = rawItems.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const label = firstText(item, ["label", "title", "name"])
      ?? firstText(item, ["id", "key"])
      ?? `Destination ${index + 1}`;
    const linkedScreen = firstText(item, [
      "linked_screen_name",
      "linkedScreenName",
      "screen_name",
      "screenName",
      "screen",
    ]);
    const availability = firstText(item, ["availability", "status"])
      ?? (linkedScreen ? "generated" : "planned");
    return [{
      id: firstText(item, ["id", "key", "value"]) ?? slug(label, `destination-${index + 1}`),
      label,
      icon: firstText(item, ["icon", "icon_name", "iconName"]) ?? "Circle",
      role: firstText(item, ["role", "purpose", "description", "semantic_role", "semanticRole"])
        ?? `${label} destination and primary product area.`,
      availability,
      linked_screen_name: /planned/i.test(availability) ? null : linkedScreen ?? null,
    }];
  });

  const roadmapItems = isRecord(roadmap) && Array.isArray(roadmap.items)
    ? roadmap.items.filter(isRecord)
    : [];
  const roadmapTypeByName = new Map(
    roadmapItems.flatMap((item) => {
      const name = firstText(item, ["name"]);
      return name ? [[name.toLowerCase(), firstText(item, ["type"]) ?? "detail"] as const] : [];
    }),
  );
  const rawChrome = Array.isArray(value.screen_chrome)
    ? value.screen_chrome
    : Array.isArray(value.screenChrome)
      ? value.screenChrome
      : [];
  const screenChrome = rawChrome.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const screenName = firstText(entry, [
      "screen_name",
      "screenName",
      "name",
      "screen",
      "linked_screen_name",
      "linkedScreenName",
    ]);
    if (!screenName) return [];
    const roadmapType = roadmapTypeByName.get(screenName.toLowerCase());
    const defaultChrome = disabled
      ? roadmapType === "detail" ? "top-bar-back" : "top-bar"
      : roadmapType === "detail" ? "top-bar-back" : "bottom-tabs";
    return [{
      screen_name: screenName,
      chrome: firstText(entry, ["chrome", "kind", "chrome_kind", "chromeKind"]) ?? defaultChrome,
      navigation_item_id: firstDefined(entry, ["navigation_item_id", "navigationItemId", "item_id", "itemId"]) ?? null,
    }];
  });

  if (disabled) {
    return {
      version: 2,
      decision: "none",
      evidence: {
        source: null,
        reason: firstText(rawEvidence, ["reason", "rationale"])
          ?? "No positive evidence for persistent primary navigation.",
      },
      enabled: false,
      kind: "none",
      items: [],
      design: null,
      visual_brief: firstText(value, ["visual_brief", "visualBrief"])
        ?? "No persistent primary navigation. Use screen-purpose-specific chrome.",
      screen_chrome: screenChrome,
    };
  }

  return {
    ...value,
    version: 2,
    decision,
    evidence: {
      source: firstDefined(rawEvidence, ["source", "type"]) ?? null,
      reason: firstText(rawEvidence, ["reason", "rationale"])
        ?? "Persistent navigation follows the product architecture.",
    },
    items,
    design: normalizeNavigationDesign(firstDefined(value, ["design", "design_contract", "designContract"])),
    visual_brief: firstText(value, ["visual_brief", "visualBrief"]),
    screen_chrome: screenChrome,
  };
};

/**
 * Canonicalize harmless planner DTO variations before strict Zod validation.
 * This never invents navigation styling; an unusable design still fails the
 * navigation schema and is isolated by the caller without blocking screens.
 */
export const normalizePlannerBlueprintResponse = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const roadmap = firstDefined(value, ["roadmap", "project_roadmap", "projectRoadmap"]);
  return {
    ...value,
    requires_bottom_nav: firstDefined(value, ["requires_bottom_nav", "requiresBottomNav"]),
    navigation_architecture: firstDefined(value, ["navigation_architecture", "navigationArchitecture"]),
    navigation_plan: normalizeNavigationPlan(
      firstDefined(value, ["navigation_plan", "navigationPlan"]),
      roadmap,
    ),
    roadmap,
  };
};
