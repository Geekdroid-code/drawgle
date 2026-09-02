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

const stringSchema = { type: "string" } as const;
const stringArraySchema = { type: "array", items: stringSchema } as const;
const nullableStringSchema = { anyOf: [stringSchema, { type: "null" }] } as const;

export const plannerBlueprintResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["requires_bottom_nav", "navigation_architecture", "navigation_plan", "roadmap", "charter"],
  properties: {
    requires_bottom_nav: { type: "boolean" },
    navigation_architecture: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "primary_navigation", "root_chrome", "detail_chrome", "consistency_rules", "rationale"],
      properties: {
        kind: { type: "string", enum: ["bottom-tabs-app", "hierarchical", "single-screen"] },
        primary_navigation: { type: "string", enum: ["bottom-tabs", "none"] },
        root_chrome: { type: "string", enum: ["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"] },
        detail_chrome: { type: "string", enum: ["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"] },
        consistency_rules: stringArraySchema,
        rationale: stringSchema,
      },
    },
    navigation_plan: {
      type: "object",
      additionalProperties: false,
      required: ["version", "decision", "evidence", "items", "design", "visual_brief", "screen_chrome"],
      properties: {
        version: { type: "integer", enum: [2] },
        decision: { type: "string", enum: ["none", "project-native", "reference-derived"] },
        evidence: {
          type: "object",
          additionalProperties: false,
          required: ["source", "reason"],
          properties: {
            source: { anyOf: [{ type: "string", enum: ["explicit-prompt", "reference", "product-architecture"] }, { type: "null" }] },
            reason: stringSchema,
          },
        },
        items: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "icon", "role", "availability", "linked_screen_name"],
            properties: {
              id: stringSchema,
              label: stringSchema,
              icon: stringSchema,
              role: stringSchema,
              availability: { type: "string", enum: ["generated", "planned"] },
              linked_screen_name: nullableStringSchema,
            },
          },
        },
        design: {
          anyOf: [{
            type: "object",
            additionalProperties: false,
            required: ["anatomy", "width", "labels", "active_treatment", "surface", "radius_px", "safe_area_offset_px", "item_gap_px", "icon_size_px", "border", "elevation", "center_action_item_id"],
            properties: {
              anatomy: { type: "string", enum: ["fixed-tab-rail", "floating-dock", "glass-dock", "compact-icon-rail", "center-action-dock"] },
              width: { type: "string", enum: ["content", "inset", "full"] },
              labels: { type: "string", enum: ["always", "active-only", "hidden"] },
              active_treatment: { type: "string", enum: ["icon-fill", "tint", "underline", "compact-chip"] },
              surface: { type: "string", enum: ["solid", "translucent", "glass"] },
              radius_px: { type: "integer", minimum: 0, maximum: 36 },
              safe_area_offset_px: { type: "integer", minimum: 4, maximum: 28 },
              item_gap_px: { type: "integer", minimum: 0, maximum: 16 },
              icon_size_px: { type: "integer", minimum: 16, maximum: 26 },
              border: { type: "boolean" },
              elevation: { type: "string", enum: ["none", "low", "medium"] },
              center_action_item_id: nullableStringSchema,
            },
          }, { type: "null" }],
        },
        visual_brief: stringSchema,
        screen_chrome: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["screen_name", "chrome", "navigation_item_id"],
            properties: {
              screen_name: stringSchema,
              chrome: { type: "string", enum: ["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"] },
              navigation_item_id: nullableStringSchema,
            },
          },
        },
      },
    },
    roadmap: {
      type: "object",
      additionalProperties: false,
      required: ["requested_parent_count", "items", "initial_batch_keys"],
      properties: {
        requested_parent_count: { anyOf: [{ type: "integer", minimum: 1, maximum: 200 }, { type: "null" }] },
        items: {
          type: "array",
          minItems: 1,
          maxItems: 24,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["stable_key", "name", "type", "summary", "priority", "explicitly_requested", "dependency_keys"],
            properties: {
              stable_key: stringSchema,
              name: stringSchema,
              type: { type: "string", enum: ["root", "detail"] },
              summary: stringSchema,
              priority: { type: "string", enum: ["core", "required", "recommended", "optional"] },
              explicitly_requested: { type: "boolean" },
              dependency_keys: stringArraySchema,
            },
          },
        },
        initial_batch_keys: { type: "array", minItems: 1, maxItems: 5, items: stringSchema },
      },
    },
    charter: {
      type: "object",
      additionalProperties: false,
      required: ["originalPrompt", "imageReferenceSummary", "appType", "targetAudience", "navigationModel", "keyFeatures", "designRationale", "creativeDirection"],
      properties: {
        originalPrompt: stringSchema,
        imageReferenceSummary: nullableStringSchema,
        appType: stringSchema,
        targetAudience: stringSchema,
        navigationModel: stringSchema,
        keyFeatures: stringArraySchema,
        designRationale: stringSchema,
        creativeDirection: {
          anyOf: [{
            type: "object",
            additionalProperties: false,
            required: ["conceptName", "styleEssence", "colorStory", "typographyMood", "surfaceLanguage", "iconographyStyle", "compositionPrinciples", "signatureMoments", "motionTone", "avoid"],
            properties: {
              conceptName: stringSchema,
              styleEssence: stringSchema,
              colorStory: stringSchema,
              typographyMood: stringSchema,
              surfaceLanguage: stringSchema,
              iconographyStyle: stringSchema,
              compositionPrinciples: stringArraySchema,
              signatureMoments: stringArraySchema,
              motionTone: stringSchema,
              avoid: stringArraySchema,
            },
          }, { type: "null" }],
        },
      },
    },
  },
} as const;

const assetNeedSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "role", "subject", "assetType", "sourcePreference", "desiredAspectRatio", "transparentBackground", "placementHint", "priority", "reuseKey", "semanticCategory", "semanticTags", "slotCount", "reusePolicy"],
  properties: {
    id: stringSchema,
    role: { type: "string", enum: ["hero_cutout", "product_cutout", "avatar", "section_photo", "background_photo", "product_photo", "decorative_object", "map_texture"] },
    subject: stringSchema,
    assetType: { type: "string", enum: ["transparent_png", "photo", "illustration", "icon_like"] },
    sourcePreference: { type: "string", enum: ["internal_library", "stock", "user_upload"] },
    desiredAspectRatio: { type: "string", enum: ["1:1", "4:5", "5:4", "16:9", "free"] },
    transparentBackground: { type: "boolean" },
    placementHint: stringSchema,
    priority: { type: "string", enum: ["critical", "supporting", "optional"] },
    reuseKey: stringSchema,
    semanticCategory: stringSchema,
    semanticTags: stringArraySchema,
    slotCount: { type: "integer", minimum: 1, maximum: 12 },
    reusePolicy: { type: "string", enum: ["repeat", "distinct"] },
  },
} as const;

export const plannerScreenBriefsResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["screens"],
  properties: {
    screens: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "type", "roadmap_stable_key", "description", "layout_contract", "reference_transfer", "chrome_policy", "asset_needs", "state_variants"],
        properties: {
          name: stringSchema,
          type: { type: "string", enum: ["root", "detail"] },
          roadmap_stable_key: stringSchema,
          description: stringSchema,
          layout_contract: {
            type: "object",
            additionalProperties: false,
            required: ["viewport_plan", "focal_hierarchy", "section_rhythm", "component_density", "cta_policy", "anti_patterns"],
            properties: {
              viewport_plan: stringSchema,
              focal_hierarchy: stringSchema,
              section_rhythm: stringSchema,
              component_density: stringSchema,
              cta_policy: stringSchema,
              anti_patterns: stringArraySchema,
            },
          },
          reference_transfer: {
            type: "object",
            additionalProperties: false,
            required: ["layout_source", "preserve", "adapt", "reject", "rationale", "target_capabilities", "semantic_decisions", "premium_quality_targets"],
            properties: {
              layout_source: { type: "string", enum: ["reference", "screen-purpose"] },
              preserve: stringArraySchema,
              adapt: stringArraySchema,
              reject: stringArraySchema,
              rationale: stringSchema,
              target_capabilities: stringArraySchema,
              semantic_decisions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["primitive_id", "decision", "rationale", "adaptation", "quality_targets"],
                  properties: {
                    primitive_id: stringSchema,
                    decision: { type: "string", enum: ["preserve", "reinterpret", "reject"] },
                    rationale: stringSchema,
                    adaptation: nullableStringSchema,
                    quality_targets: stringArraySchema,
                  },
                },
              },
              premium_quality_targets: stringArraySchema,
            },
          },
          chrome_policy: {
            type: "object",
            additionalProperties: false,
            required: ["chrome", "show_primary_navigation", "shows_back_button"],
            properties: {
              chrome: { type: "string", enum: ["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"] },
              show_primary_navigation: { type: "boolean" },
              shows_back_button: { type: "boolean" },
            },
          },
          asset_needs: { type: "array", maxItems: 4, items: assetNeedSchema },
          state_variants: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "state_key", "state_label", "state_role", "trigger_label", "description", "edit_instruction", "explicitly_requested", "default_selected"],
              properties: {
                id: stringSchema,
                state_key: stringSchema,
                state_label: stringSchema,
                state_role: stringSchema,
                trigger_label: stringSchema,
                description: stringSchema,
                edit_instruction: stringSchema,
                explicitly_requested: { type: "boolean" },
                default_selected: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
} as const;
