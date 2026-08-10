export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export type ProjectStatus = 'draft' | 'active' | 'queued' | 'generating' | 'failed' | 'completed' | 'archived';

export type ScreenStatus = 'queued' | 'building' | 'ready' | 'failed';

export type GenerationStatus = 'queued' | 'planning' | 'building' | 'completed' | 'failed' | 'canceled';

export const ACTIVE_GENERATION_STATUSES = ['queued', 'planning', 'building'] as const;

export const TERMINAL_GENERATION_STATUSES = ['completed', 'failed', 'canceled'] as const;

export function isActiveGenerationStatus(status: GenerationStatus) {
  return ACTIVE_GENERATION_STATUSES.includes(status as (typeof ACTIVE_GENERATION_STATUSES)[number]);
}

export function isTerminalGenerationStatus(status: GenerationStatus) {
  return TERMINAL_GENERATION_STATUSES.includes(status as (typeof TERMINAL_GENERATION_STATUSES)[number]);
}

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface PromptImagePayload {
  data: string;
  mimeType: string;
}

export type VisualAssetRole =
  | "hero_cutout"
  | "product_cutout"
  | "avatar"
  | "section_photo"
  | "background_photo"
  | "product_photo"
  | "decorative_object"
  | "map_texture";

export type VisualAssetType = "transparent_png" | "photo" | "illustration" | "icon_like";

export type VisualAssetSourcePreference = "user_upload" | "internal_library" | "stock";

export type VisualAssetSemanticCategory =
  | "person"
  | "animal"
  | "food"
  | "fashion"
  | "electronics"
  | "vehicle"
  | "fitness"
  | "beauty"
  | "home"
  | "place"
  | "nature"
  | "map"
  | "logo"
  | "generic_product"
  | "other";

export type VisualAssetReusePolicy = "repeat" | "distinct";

export type VisualAssetPriority = "critical" | "supporting" | "optional";

export type VisualAssetRequirementOrigin =
  | "reference_visible"
  | "user_explicit"
  | "planner_inferred"
  | "heuristic_inferred";

export type VisualAssetSource = "user_upload" | "internal_library" | "stock" | "placeholder";

export type VisualAssetProvider =
  | "user"
  | "drawgle_r2"
  | "pexels"
  | "pixabay"
  | "placeholder";

export type VisualAssetVisibility = "public_reusable" | "owner_private" | "project_private";

export interface AssetRequirement {
  id: string;
  screenName: string;
  role: VisualAssetRole;
  subject: string;
  assetType: VisualAssetType;
  sourcePreference: VisualAssetSourcePreference;
  desiredAspectRatio: "1:1" | "4:5" | "5:4" | "16:9" | "free";
  transparentBackground: boolean;
  placementHint: string;
  priority: VisualAssetPriority;
  reuseKey: string;
  semanticCategory: VisualAssetSemanticCategory;
  semanticTags: string[];
  slotCount: number;
  reusePolicy: VisualAssetReusePolicy;
  userAssetId?: string;
  origin?: VisualAssetRequirementOrigin;
}

export interface ScreenAssetManifest {
  id: string;
  requirementId: string;
  role: VisualAssetRole;
  url: string | null;
  variantUrl?: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  alt: string;
  placementHint: string;
  objectFit: "contain" | "cover";
  objectPosition: string;
  source: VisualAssetSource;
  provider: VisualAssetProvider;
  critical: boolean;
  visibility: VisualAssetVisibility;
  verificationScore?: number | null;
  placeholder?: boolean;
  license?: string | null;
  attribution?: string | null;
  sourceUrl?: string | null;
  requirementOrigin?: VisualAssetRequirementOrigin;
  semanticCategory: VisualAssetSemanticCategory;
  semanticTags: string[];
  reusePolicy: VisualAssetReusePolicy;
  expectedUses: number;
  slotIndex?: number;
}

export interface ProjectAssetManifest {
  requirements: AssetRequirement[];
  assetsByScreen: Record<string, ScreenAssetManifest[]>;
  failures?: AssetResolutionFailure[];
  diagnostics?: AssetResolutionDiagnostic[];
}

export interface AssetResolutionFailure {
  requirementId: string;
  screenName: string;
  subject: string;
  priority: VisualAssetPriority;
  reason: string;
  fatal: boolean;
}

export interface AssetResolutionDiagnostic {
  requirementId: string;
  screenName: string;
  subject: string;
  semanticCategory: VisualAssetSemanticCategory;
  candidateCount: number;
  selectedAssetId?: string | null;
  selectedVia?: "user_upload" | "cache" | "curated" | "stock" | "placeholder" | null;
  selectedSource?: VisualAssetSource | null;
  rejectionCode?: string | null;
  cacheHit: boolean;
  durationMs: number;
  sanitizedMisuseCount: number;
  apiCallCount: number;
  r2WriteCount: number;
}

export type ImageReferenceMode = "recreate" | "style";

export type GenerationReferencePolicy =
  | "user_upload"
  | "project_reference"
  | "explicit_style"
  | "project_memory"
  | "curated_fallback";

export type ReferenceSource = "user_upload" | "project_upload" | "project_memory" | "curated";

export type ReferenceMode = "user_recreate" | "user_style" | "curated_style" | "internal_style";

export type GenerationPromptMode = "recreate" | "style" | "prompt";

export type ReferenceImageRole = "structural-reference" | "style-calibration";

export interface ReferenceImageAttachmentDecision {
  attach: boolean;
  role: ReferenceImageRole | null;
  reason: string;
  calibrationContractVersion: number | null;
  featureEnabled: boolean;
}

export interface DesignColorTokens {
  background?: {
    primary?: string;
    secondary?: string;
    surface_elevated?: string;
    [key: string]: JsonValue | undefined;
  };
  surface?: {
    card?: string;
    bottom_sheet?: string;
    modal?: string;
    [key: string]: JsonValue | undefined;
  };
  text?: {
    high_emphasis?: string;
    medium_emphasis?: string;
    low_emphasis?: string;
    action_label?: string;
    [key: string]: JsonValue | undefined;
  };
  action?: {
    primary?: string;
    secondary?: string;
    primary_gradient_start?: string;
    primary_gradient_end?: string;
    on_surface_white_bg?: string;
    on_primary_text?: string;
    disabled?: string;
    [key: string]: JsonValue | undefined;
  };
  border?: {
    divider?: string;
    focused?: string;
    [key: string]: JsonValue | undefined;
  };
  status?: {
    success?: DesignStatusColorRole;
    warning?: DesignStatusColorRole;
    danger?: DesignStatusColorRole;
    info?: DesignStatusColorRole;
    [key: string]: JsonValue | DesignStatusColorRole | undefined;
  };
  [key: string]: JsonValue | undefined;
}

export interface DesignStatusColorRole {
  foreground?: string;
  surface?: string;
  border?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignTypographyScale {
  size?: string;
  weight?: string | number;
  line_height?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignTypographyTokens {
  heading_font_family?: string;
  body_font_family?: string;
  nav_title?: DesignTypographyScale;
  screen_title?: DesignTypographyScale;
  hero_title?: DesignTypographyScale;
  section_title?: DesignTypographyScale;
  metric_value?: DesignTypographyScale;
  body?: DesignTypographyScale;
  supporting?: DesignTypographyScale;
  caption?: DesignTypographyScale;
  button_label?: DesignTypographyScale;
  title_large?: DesignTypographyScale;
  title_main?: DesignTypographyScale;
  body_primary?: DesignTypographyScale;
  body_secondary?: DesignTypographyScale;
  [key: string]: JsonValue | undefined;
}

export interface DesignSpacingTokens {
  none?: string;
  xxs?: string;
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  xxl?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignMobileLayoutTokens {
  screen_margin?: string;
  safe_area_top?: string;
  safe_area_bottom?: string;
  section_gap?: string;
  element_gap?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignSizingTokens {
  min_touch_target?: string;
  standard_button_height?: string;
  standard_input_height?: string;
  icon_small?: string;
  icon_standard?: string;
  bottom_nav_height?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignRadiiTokens {
  app?: string;
  inner?: string;
  pill?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignBorderWidthTokens {
  standard?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignShadowTokens {
  none?: string;
  surface?: string;
  overlay?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignGradientTokens {
  app_background?: string;
  action_primary?: string;
  surface_highlight?: string;
  accent_ring?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignNavigationTokens {
  surface?: string;
  content?: string;
  muted_content?: string;
  active_surface?: string;
  active_content?: string;
  border?: string;
  shadow?: string;
  anatomy?: NavigationAnatomy;
  width?: "content" | "inset" | "full";
  labels?: "always" | "active-only" | "hidden";
  active_treatment?: "icon-fill" | "tint" | "underline" | "compact-chip";
  surface_material?: "solid" | "translucent" | "glass";
  container_height?: string;
  max_width?: string;
  safe_area_offset?: string;
  horizontal_inset?: string;
  horizontal_padding?: string;
  vertical_padding?: string;
  item_gap?: string;
  icon_size?: string;
  label_size?: string;
  label_weight?: string;
  backdrop_blur?: string;
  active_indicator_width?: string;
  active_indicator_height?: string;
  [key: string]: JsonValue | undefined;
}

/**
 * Semantic map: compact, role-named entries sent to the LLM instead of the
 * raw spacing/sizing/opacities/z-index scales. Each entry resolves to a
 * concrete CSS variable + pixel value so the LLM can make visual judgements.
 * The raw scales are still emitted as CSS variables for the browser.
 */
export interface DesignSemanticEntry {
  /** Human-readable role description — the LLM uses this to choose the right token */
  role: string;
  /** CSS variable name, e.g. --dg-spacing-md */
  variable: string;
  /** Resolved pixel/value, e.g. 16px */
  value: string;
}

export interface DesignTokenValues {
  color?: DesignColorTokens;
  typography?: DesignTypographyTokens;
  spacing?: DesignSpacingTokens;
  mobile_layout?: DesignMobileLayoutTokens;
  sizing?: DesignSizingTokens;
  radii?: DesignRadiiTokens;
  border_widths?: DesignBorderWidthTokens;
  shadows?: DesignShadowTokens;
  gradients?: DesignGradientTokens;
  navigation?: DesignNavigationTokens;
  elevation?: Record<string, string>;
  opacities?: Record<string, string>;
  z_index?: Record<string, string>;
  [key: string]: JsonValue | undefined;
}

export interface DesignTokenMetadata {
  recommendedFonts?: string[];
  componentShapePolicy?: DesignComponentShapePolicy;
  /** StyleCharterV1 — the reference's hand-authored constraints, kept for the planner and builder. */
  styleCharter?: JsonValue;
  /** TokenRelationshipReportV1 — what the relationship validator repaired. */
  tokenRelationships?: JsonValue;
  /** Where this run's reference analysis contradicted the curated catalog. */
  charterConflicts?: string[];
  [key: string]: JsonValue | undefined;
}

export interface DesignComponentShapePolicy {
  version: 1;
  field: "app";
  standardButton: "inner";
  primaryCta: "inner" | "pill";
  segmentedContainer: "app";
  segmentedItem: "inner" | "pill";
  nestedSurface: "inner";
  iconWell: "pill";
  evidenceSource: "default" | "user" | "reference" | "design-style";
  rationale: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignTokens {
  system_schema?: string;
  tokens?: DesignTokenValues;
  meta?: DesignTokenMetadata;
  [key: string]: JsonValue | undefined;
}

export type DesignStyleId =
  | "modern-light"
  | "modern-dark"
  | "editorial-minimal"
  | "soft-clay"
  | "neo-brutal"
  | "luxury-quiet"
  | "cyberpunk-command"
  | "glass-utility"
  | "playful-whimsical"
  | "data-command";

export type DesignStyleReferenceRole = "visual_dna" | "component_craft" | "navigation" | "layout";

export interface DesignStylePack {
  id: string;
  label: string;
  version: number;
  premiumIntent: string;
  bestFor: string[];
  avoidFor?: string[];
  tokenSeed: Partial<DesignTokens>;
  creativeDirectionSeed: Partial<CreativeDirection>;
  layoutGrammar: string[];
  componentRecipes: string[];
  navigationRecipes: string[];
  assetAndImageryRules: string[];
  densityRules: string[];
  antiPatterns: string[];
  referenceImages?: Array<{
    imageUrl: string;
    role: DesignStyleReferenceRole;
  }>;
}

export interface ProjectDesignStyleSummary {
  id: string;
  label: string;
  version: number;
}

export interface CreativeDirection {
  conceptName: string;
  styleEssence: string;
  colorStory: string;
  typographyMood: string;
  surfaceLanguage: string;
  iconographyStyle: string;
  compositionPrinciples: string[];
  signatureMoments: string[];
  motionTone: string;
  avoid: string[];
}

export interface ProjectCharterReferenceScreen {
  index: number;
  suggestedRole: string;
  layoutSummary: string;
  visualHierarchy: string;
  components: string[];
  stylingCues: string[];
  interactionCues?: string[];
  copyPatterns?: string[];
  implementationNotes?: string[];
}

export interface ProjectCharterDesignSystemSignals {
  palette?: string;
  typography?: string;
  surfaces?: string;
  iconography?: string;
  density?: string;
  motionTone?: string;
  [key: string]: JsonValue | undefined;
}

export interface ProjectCharterPlanningDiagnostics {
  source: "planner" | "partial_planner" | "reference_fallback";
  validationIssues?: string[];
  rawPlanKeys?: string[];
  rawScreenCount?: number;
  recoveredScreens?: number;
  notes?: string[];
  [key: string]: JsonValue | undefined;
}

export interface ProjectReferenceDna {
  schemaVersion: 1;
  source: "image_analysis" | "legacy_reconstruction";
  referenceMode: ReferenceMode;
  sourceImagePath?: string | null;
  sourceReferenceId?: string | null;
  sourceReferenceCatalogHash?: string | null;
  createdAt: string;
  analysis: ReferenceAnalysis;
  screenFamilyContract: ScreenFamilyContract;
}

export type PrimaryNavigationKind = "bottom-tabs" | "none";

export type ScreenChromeKind = "bottom-tabs" | "top-bar" | "top-bar-back" | "modal-sheet" | "immersive";

export interface ScreenChromePolicy {
  chrome: ScreenChromeKind;
  showPrimaryNavigation: boolean;
  showsBackButton: boolean;
}

export interface NavigationArchitecture {
  kind: "bottom-tabs-app" | "hierarchical" | "single-screen";
  primaryNavigation: PrimaryNavigationKind;
  rootChrome: ScreenChromeKind;
  detailChrome: ScreenChromeKind;
  consistencyRules: string[];
  rationale: string;
}

export type NavigationPlanKind = "bottom-tabs" | "none";

export type NavigationDecision = "none" | "project-native" | "reference-derived";
export type NavigationEvidenceSource = "explicit-prompt" | "reference" | "product-architecture";
export type NavigationDestinationAvailability = "generated" | "planned";
export type NavigationAnatomy =
  | "fixed-tab-rail"
  | "floating-dock"
  | "glass-dock"
  | "compact-icon-rail"
  | "center-action-dock";

export interface NavigationDesignContract {
  anatomy: NavigationAnatomy;
  width: "content" | "inset" | "full";
  labels: "always" | "active-only" | "hidden";
  activeTreatment: "icon-fill" | "tint" | "underline" | "compact-chip";
  surface: "solid" | "translucent" | "glass";
  radiusPx: number;
  safeAreaOffsetPx: number;
  itemGapPx: number;
  iconSizePx: number;
  border: boolean;
  elevation: "none" | "low" | "medium";
  centerActionItemId?: string | null;
  containerHeightPx?: number;
  maxWidthPx?: number | null;
  horizontalInsetPx?: number;
  horizontalPaddingPx?: number;
  verticalPaddingPx?: number;
  labelSizePx?: number;
  labelWeight?: number;
  blurPx?: number;
  borderWidthPx?: number;
  itemLayout?: "stacked" | "inline" | "icon-only";
  activeIndicatorWidthPx?: number | null;
  activeIndicatorHeightPx?: number | null;
  activeIndicatorRadiusPx?: number | null;
}

export interface ContextualChromeAppearanceContract {
  heightPx: number;
  horizontalInsetPx: number;
  controlSizePx: number;
  controlRadiusPx: number;
  controlGapPx: number;
  iconSizePx: number;
  titleAlignment: "leading" | "center";
  surface: "transparent" | "solid" | "translucent" | "glass";
  border: boolean;
  elevation: "none" | "low" | "medium";
}

export interface NavigationAppearanceContract {
  source: "reference" | "project-native";
  evidenceSource?: "structured-reference" | "curated-catalog" | "project-native";
  evidenceConfidence?: "high" | "medium" | "low";
  geometryOwner?: "reference-measurements" | "project-tokens";
  measuredFields?: string[];
  primary: NavigationDesignContract | null;
  contextualChrome: ContextualChromeAppearanceContract | null;
  rationale: string;
}

export interface NavigationPlanItem {
  id: string;
  label: string;
  icon: string;
  role: string;
  linkedScreenName: string | null;
  availability?: NavigationDestinationAvailability;
}

export interface NavigationPlanScreenChrome {
  screenName: string;
  chrome: ScreenChromeKind;
  navigationItemId?: string | null;
}

export interface NavigationPlan {
  version?: 1 | 2 | 3;
  decision?: NavigationDecision;
  evidence?: {
    source: NavigationEvidenceSource | null;
    reason: string;
  };
  design?: NavigationDesignContract | null;
  appearance?: NavigationAppearanceContract | null;
  enabled: boolean;
  kind: NavigationPlanKind;
  items: NavigationPlanItem[];
  visualBrief: string;
  screenChrome: NavigationPlanScreenChrome[];
}

export interface ProjectCharter {
  originalPrompt: string;
  imageReferenceSummary?: string | null;
  appType: string;
  targetAudience: string;
  navigationModel: string;
  navigationArchitecture?: NavigationArchitecture | null;
  keyFeatures: string[];
  designRationale: string;
  creativeDirection?: CreativeDirection | null;
  designStyle?: ProjectDesignStyleSummary | null;
  referenceScreens?: ProjectCharterReferenceScreen[];
  designSystemSignals?: ProjectCharterDesignSystemSignals | null;
  referenceDna?: ProjectReferenceDna | null;
  projectOrigin?: "image_to_ui" | "style_reference" | "prompt";
  planningDiagnostics?: ProjectCharterPlanningDiagnostics | null;
  charterSource?: "planner" | "partial_planner" | "reference_fallback";
}

export type ProjectRoadmapItemKind = "screen" | "state";
export type ProjectRoadmapPriority = "core" | "required" | "recommended" | "optional";
export type ProjectRoadmapStatus = "planned" | "queued" | "building" | "ready" | "failed" | "dismissed";
export type ProjectRoadmapSource = "prompt" | "planner" | "navigation" | "existing";

export interface ProjectRoadmapItem {
  id?: string;
  stableKey: string;
  parentStableKey?: string | null;
  parentItemId?: string | null;
  generatedScreenId?: string | null;
  kind: ProjectRoadmapItemKind;
  screenType?: "root" | "detail" | null;
  name: string;
  description: string;
  priority: ProjectRoadmapPriority;
  status: ProjectRoadmapStatus;
  source: ProjectRoadmapSource;
  explicitlyRequested: boolean;
  sequence: number;
  tranche: number;
  dependencyKeys: string[];
  stateKey?: string | null;
  stateLabel?: string | null;
  stateRole?: string | null;
  triggerLabel?: string | null;
  metadata?: Record<string, JsonValue>;
}

export interface ProjectRoadmap {
  version: 1;
  requestedParentCount: number | null;
  plannedParentCount: number;
  remainingUnplannedCount: number;
  tranche: number;
  items: ProjectRoadmapItem[];
}

export interface RoadmapBatchSelection {
  parentItemIds: string[];
  stateItemIds: string[];
  parentCount: number;
  stateCount: number;
  outputCount: number;
  requiredCredits: number;
}

export interface ContextualScreenSuggestionItem {
  roadmapItemId: string;
  kind: "screen" | "state";
  name: string;
  description: string;
  parentName?: string | null;
}

export interface RoadmapBuildRecommendation {
  version: 2;
  kind: "parent_batch" | "state_batch";
  title: string;
  items: ContextualScreenSuggestionItem[];
}

export interface CreditReservationSummary {
  reservedCredits: number;
  capturedCredits: number;
  releasedCredits: number;
  outputCount: number;
  availableBalance?: number | null;
}

export interface ScreenPlanningSeed {
  name: string;
  type: 'root' | 'detail';
  summary: string;
  prompt: string;
  roadmapStableKey?: string | null;
  roadmapPriority?: ProjectRoadmapPriority;
  explicitlyRequested?: boolean;
  dependencyKeys?: string[];
  referenceScreenIndex?: number | null;
  referenceScreenCount?: number | null;
}

export interface ScreenPlan {
  name: string;
  type: 'root' | 'detail';
  description: string;
  roadmapStableKey?: string | null;
  roadmapItemId?: string | null;
  roadmapPriority?: ProjectRoadmapPriority;
  explicitlyRequested?: boolean;
  stateVariants?: ScreenStateVariantPlan[];
  layoutContract?: ScreenLayoutContract | null;
  chromePolicy?: ScreenChromePolicy | null;
  navigationItemId?: string | null;
  assetNeeds?: AssetRequirement[];
  referenceScreenIndex?: number | null;
  referenceScreenCount?: number | null;
  referenceTransfer?: ReferenceTransferContract | null;
}

export interface ScreenLayoutContract {
  version?: 1 | 2 | 3;
  viewportPlan: string;
  focalHierarchy: string;
  sectionRhythm: string;
  componentDensity: string;
  ctaPolicy: string;
  antiPatterns: string[];
  regions?: ScreenLayoutRegion[];
  /** v3: the numeric vertical budget the builder must fit inside. */
  viewportBudget?: ScreenViewportBudget | null;
  /** v3: per-region arrangement and content budgets. */
  regionContracts?: ScreenRegionContract[];
}

export type ScreenRegionPriority = "focal" | "primary" | "secondary";

export interface ScreenViewportBudgetRegion {
  id: string;
  minHPx: number;
  maxHPx: number;
  priority: ScreenRegionPriority;
}

export interface ScreenViewportBudget {
  frameHeightPx: number;
  /** Regions expected to be visible without scrolling, in reading order. */
  aboveFoldRegionIds: string[];
  regions: ScreenViewportBudgetRegion[];
}

export type ScreenRegionArrangement =
  | "single"
  | "two-column"
  | "three-column"
  | "grid"
  | "horizontal-scroll"
  | "stacked-rows";

/**
 * `equal-height` means siblings share one baseline and one internal anatomy.
 * `independent` is legal only for arrangements where items are not read as a
 * set, such as a horizontal scroll rail.
 */
export type ScreenSiblingBalance = "equal-height" | "independent";

export interface ScreenRegionCopyBudget {
  titleMaxChars: number;
  bodyMaxLines: number;
}

export interface ScreenRegionContract {
  id: string;
  arrangement: ScreenRegionArrangement;
  siblingBalance: ScreenSiblingBalance;
  itemCount: number;
  /** One anatomy list shared by every item in the region. */
  itemAnatomy: string[];
  copyBudget?: ScreenRegionCopyBudget | null;
}

export interface ScreenLayoutRegion {
  id: string;
  purpose: string;
  contentKind: "header" | "focal" | "chart" | "list" | "form" | "media" | "action" | "supporting" | "other";
}

export type ScreenSemanticCapability =
  | "onboarding"
  | "sequential-workflow"
  | "conversation"
  | "data-monitoring"
  | "exploration"
  | "transaction"
  | "form-entry"
  | "editorial-reading"
  | "spatial-navigation"
  | "media-immersive"
  | "profile-configuration"
  | "collection-browsing"
  | "detail-inspection"
  | "search-discovery"
  | "status-feedback";

export type SemanticCompositionPrimitiveKind =
  | "progressive-sequence"
  | "focal-anchor"
  | "layered-depth"
  | "editorial-rhythm"
  | "spatial-cluster"
  | "data-comparison"
  | "immersive-canvas"
  | "anchored-action"
  | "content-stream"
  | "modular-workspace"
  | "split-context"
  | "reveal-on-demand";

export interface SemanticCompositionPrimitive {
  id: string;
  kind: SemanticCompositionPrimitiveKind;
  label: string;
  purpose: string;
  sourceEvidence: string;
  transferableTraits: string[];
  suitableFor: ScreenSemanticCapability[];
  avoidFor: ScreenSemanticCapability[];
  adaptationGuidance: string;
  qualityDetails: string[];
  strength: "primary" | "supporting" | "accent";
  sourceScreenIndex?: number;
}

export interface SemanticTransferDecision {
  primitiveId: string;
  decision: "preserve" | "reinterpret" | "reject";
  suitabilityScore: number;
  targetCapability: ScreenSemanticCapability;
  rationale: string;
  adaptation: string | null;
  qualityTargets: string[];
}

/**
 * Makes reference provenance explicit instead of letting "style" silently
 * become "copy this screen". The planner owns the choices; the builder must
 * treat `reject` as higher priority than prose in the screen brief.
 */
export interface ReferenceTransferContract {
  version?: 1 | 2;
  layoutSource: "reference" | "screen-purpose";
  preserve: string[];
  adapt: string[];
  reject: string[];
  rationale: string;
  targetCapabilities: ScreenSemanticCapability[];
  semanticDecisions: SemanticTransferDecision[];
  premiumQualityTargets: string[];
  visualInvariants?: string[];
  compositionAdaptations?: ReferenceCompositionAdaptation[];
  localMotifs?: ReferenceLocalMotifRule[];
  forbiddenLiteralTransfers?: string[];
}

export interface ReferenceCompositionAdaptation {
  sourcePrimitiveId?: string;
  sourcePrimitiveKind?: SemanticCompositionPrimitiveKind;
  principle: string;
  targetRegionIds: string[];
  functionalPurpose: string;
}

export interface ReferenceLocalMotifRule {
  motifId: string;
  decision: "allow-local" | "reject";
  targetRegionIds: string[];
  requiredFunction: string;
  repetition: "once" | "per-approved-region";
  rationale: string;
}

export interface ScreenBaseStatePlan {
  stateKey: string;
  stateLabel: string;
}

export interface ScreenStateVariantPlan {
  id: string;
  stateKey: string;
  stateLabel: string;
  stateRole: string;
  triggerLabel: string;
  description: string;
  editInstruction: string;
  defaultSelected: boolean;
  roadmapStableKey?: string | null;
  roadmapItemId?: string | null;
  explicitlyRequested?: boolean;
}

export type GenerationRetryMode = "full_pipeline" | "missing_screens" | "state_variants";

export interface GenerationRetryContext {
  sourceGenerationRunId: string;
  mode: GenerationRetryMode;
  reuseScreenIdsByName?: Record<string, string>;
  parentScreenId?: string | null;
  reuseStateVariantIdsByKey?: Record<string, string>;
  /** Explicit subset of screen names selected for retry (optional). */
  targetScreenNames?: string[];
}

export interface ReferenceScreenAnalysis {
  index: number;
  suggestedRole: string;
  layoutSummary: string;
  visualHierarchy: string;
  components: string[];
  stylingCues: string[];
  interactionCues: string[];
  copyPatterns: string[];
  implementationNotes: string[];
  compositionRules?: string[];
  spacingRules?: string[];
  componentRules?: string[];
  antiPatterns?: string[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ReferenceDesignSystemSignals {
  palette: string;
  typography: string;
  surfaces: string;
  iconography: string;
  density: string;
  motionTone: string;
  layoutGrammar?: string;
  componentGrammar?: string;
  spacingLogic?: string;
  antiPatterns?: string;
  [key: string]: JsonValue | undefined;
}

export interface ReferenceNavigationItemEvidence {
  label: string | null;
  icon: string;
}

export interface ReferenceNavigationEvidence {
  present: boolean;
  repeatedAcrossScreens: boolean;
  itemCount: number;
  items: ReferenceNavigationItemEvidence[];
  anatomy: NavigationAnatomy | null;
  geometry: string;
  labels: "always" | "active-only" | "hidden" | null;
  activeState: string;
  elevation: string;
  safeAreaRelationship: string;
  activeItemByScreen: Array<{ screenIndex: number; itemIndex: number | null }>;
  visibleOnScreenIndexes?: number[];
  absentOnScreenIndexes?: number[];
  rootDetailPattern?: string;
  appearance?: NavigationAppearanceContract | null;
}

export type ReferenceGeometryRole =
  | "screen-rail"
  | "outer-surface-radius"
  | "inner-surface-radius"
  | "row-radius"
  | "icon-well-size"
  | "icon-well-radius"
  | "pill-radius"
  | "row-height"
  | "section-gap"
  | "internal-gap"
  | "button-height"
  | "navigation-height"
  | "navigation-inset"
  | "navigation-bottom-offset"
  | "navigation-icon-size"
  | "other";

export interface ReferenceGeometryMeasurement {
  role: ReferenceGeometryRole;
  minPx: number;
  maxPx: number;
  confidence: "high" | "medium" | "low";
  sourceScreenIndexes: number[];
  scope: "project-global" | "component-family" | "screen-local";
  sourceLayer: "app-ui" | "device-mockup";
  note: string;
}

export interface ReferenceGeometryProfile {
  measurements: ReferenceGeometryMeasurement[];
  diagnostics: string[];
}

export interface ReferenceMotifEvidence {
  id: string;
  description: string;
  functionalPurpose: string;
  sourceScreenIndexes: number[];
  scope: "global-material" | "component-local" | "screen-local-decoration";
}
export interface ReferenceAnalysis {
  overallVisualStyle: string;
  screenCountEstimate: number;
  screenReferences: ReferenceScreenAnalysis[];
  designSystemSignals: ReferenceDesignSystemSignals;
  primaryNavigation?: ReferenceNavigationEvidence | null;
  semanticCompositionPrimitives?: SemanticCompositionPrimitive[];
  geometryProfile?: ReferenceGeometryProfile;
  motifs?: ReferenceMotifEvidence[];
}

export interface ReferenceAnalysisResult {
  analysis: ReferenceAnalysis | null;
  screenCountEstimate: number | null;
  screenReferenceCount: number | null;
  confidence: "high" | "medium" | "low";
  scopeConfidence?: "high" | "medium" | "low";
  visualEvidenceConfidence?: "high" | "medium" | "low";
  evidenceCompleteness?: ReferenceEvidenceDiagnostics;
  source: "full_analysis" | "salvaged_analysis" | "count_only" | "none";
  diagnostics: string[];
  validationIssues?: string[];
}

export interface ReferenceEvidenceDiagnostics {
  geometry: "complete" | "partial" | "missing";
  navigation: "visible-complete" | "visible-partial" | "confirmed-absent" | "missing";
  motifs: "complete" | "missing";
}

export type GenerationScopeCountSource =
  | "planning_mode"
  | "prompt_count"
  | "named_screens"
  | "reference_image"
  | "default_single"
  | "open_project";

export interface ScreenScopeGroup {
  kind: string;
  count: number;
  orderedNames: string[];
  sourceText: string;
  surfaceKind?: "screen" | "state";
  parentName?: string | null;
}

export interface ScreenScopeScreen {
  index: number;
  name: string;
  kind: string;
  parentName?: string | null;
}

export interface GenerationScopeContract {
  version: 1 | 2;
  referenceMode: ReferenceMode;
  promptScreenCount: number | null;
  namedScreenCount: number | null;
  imageScreenCount: number | null;
  finalScreenCount: number | null;
  countSource: GenerationScopeCountSource;
  confidence: "high" | "medium" | "low";
  conflictResolution: {
    policy: "user_wins";
    promptScreenCount: number | null;
    imageScreenCount: number | null;
    resolvedCount: number | null;
    reason: string;
  } | null;
  allScreensRequested: boolean;
  reason: string;
  diagnostics: string[];
  groups?: ScreenScopeGroup[];
  screens?: ScreenScopeScreen[];
  ambiguities?: string[];
  requiresConfirmation?: boolean;
}

export type GenerationIntentKind =
  | "exact_recreate"
  | "style_reference_app"
  | "full_app"
  | "add_screen"
  | "edit_existing";

export interface GenerationIntentContract {
  kind: GenerationIntentKind;
  source: "planning_mode" | "prompt" | "reference_image" | "image_reference_mode";
  reason: string;
  exactScreenCount?: number | null;
  maxInitialScreens?: number | null;
  explicitScreenCount?: number | null;
  referenceScreenCount?: number | null;
  allowSharedNavigation: boolean;
  visibleNavigationHandling: "shared_navigation" | "inline_static_chrome";
}

export interface ScreenFamilyContract {
  summary: string;
  surfaces: string;
  typography: string;
  spacing: string;
  navigation: string;
  imagery: string;
  consistencyRules: string[];
}

export interface BuilderProjectContractV1 {
  version: 1;
  product: {
    appType: string;
    targetAudience: string;
    purpose: string;
    keyFeatures: string[];
  };
  screen: {
    name: string;
    type: "root" | "detail";
    purpose: string;
    regions: ScreenLayoutRegion[];
    chromePolicy: ScreenChromePolicy | null;
  };
  navigation: {
    enabled: boolean;
    destinations: Array<{ id: string; label: string; role: string; linkedScreenName: string | null }>;
    currentItemId: string | null;
  };
  family: ScreenFamilyContract | null;
  componentShapePolicy: DesignComponentShapePolicy;
}

export type UiContractDiagnosticCode =
  | "known_token_alias"
  | "unknown_token_reference"
  | "unknown_token_reference_with_fallback"
  | "status_role_repaired"
  | "raw_status_color"
  | "radius_role_repaired"
  | "ambiguous_radius_role"
  | "critical_truncation_risk"
  | "navigation_chrome_conflict"
  | "concentric_radius_repaired"
  | "nested_gap_exceeds_padding";

export type DesignCriticFindingCode =
  | "sibling_imbalance"
  | "decorative_dead_space"
  | "fabricated_object_art"
  | "raw_surface_color"
  | "above_fold_budget_exceeded"
  | "surface_text_contrast"
  | "radius_vocabulary_drift";

export interface DesignCriticFinding {
  code: DesignCriticFindingCode;
  selector: string | null;
  detail: string;
  severity: "high" | "medium";
}

export interface DesignCriticReportV1 {
  version: 1;
  findings: DesignCriticFinding[];
  /** Count of findings at "high" severity, the signal a composition repair would key on. */
  highSeverityCount: number;
}

export interface UiContractDiagnostic {
  code: UiContractDiagnosticCode;
  selector: string | null;
  detail: string;
}

export interface UiContractNormalizationReportV1 {
  version: 1;
  repairEnabled: boolean;
  repairs: UiContractDiagnostic[];
  warnings: UiContractDiagnostic[];
  critic?: DesignCriticReportV1 | null;
}

export type RenderedQualityIssueCode =
  | "horizontal_overflow"
  | "critical_text_truncation"
  | "collapsed_token_gap"
  | "nested_radius_violation"
  | "field_radius_mismatch"
  | "button_radius_mismatch"
  | "undersized_control"
  | "style_runtime_degraded";

export interface RenderedQualityIssue {
  code: RenderedQualityIssueCode;
  drawgleId: string | null;
  measured?: Record<string, number>;
}

export interface ScreenQualityDiagnosticsV1 {
  version: 1;
  codeHash: string;
  disposition: "clean" | "warning";
  static: UiContractNormalizationReportV1;
  rendered?: {
    checkedAt: string;
    viewport: { width: number; height: number };
    issues: RenderedQualityIssue[];
  } | null;
}

export interface ScreenCountContract {
  exactCount: number | null;
  source: "planning_mode" | "prompt_count" | "named_screens" | "reference_image" | "open_project";
  reason: string;
  namedScreens?: string[];
  referenceScreenCount?: number | null;
  disableSharedNavigation?: boolean;
  maxScreens?: number | null;
}

export type ScreenCountEnforcement = "none" | "trimmed" | "filled";

export interface PlannedUiFlow {
  requiresBottomNav: boolean;
  navigationArchitecture: NavigationArchitecture;
  navigationPlan: NavigationPlan;
  screens: ScreenPlan[];
  charter: ProjectCharter;
  scopeContract?: GenerationScopeContract;
  screenCountContract?: ScreenCountContract;
  screenCountEnforcement?: ScreenCountEnforcement;
  intentContract?: GenerationIntentContract;
  screenFamilyContract?: ScreenFamilyContract;
  roadmap?: ProjectRoadmap;
  initialBatchItemKeys?: string[];
  requestedParentCount?: number | null;
  remainingUnplannedCount?: number;
}

export interface ProjectBlueprintPlanV1 {
  version: 1;
  requiresBottomNav: boolean;
  navigationArchitecture: NavigationArchitecture;
  navigationPlan: NavigationPlan;
  charter: ProjectCharter;
  screenSeeds: ScreenPlanningSeed[];
  scopeContract: GenerationScopeContract;
  screenCountContract: ScreenCountContract;
  screenCountEnforcement: ScreenCountEnforcement;
  intentContract: GenerationIntentContract;
  screenFamilyContract: ScreenFamilyContract;
  roadmap: ProjectRoadmap;
  initialBatchItemKeys: string[];
  requestedParentCount: number | null;
  remainingUnplannedCount: number;
}

export interface GenerationJournalScreen {
  name: string;
  type?: ScreenPlan["type"] | null;
  description?: string | null;
  chrome?: ScreenChromeKind | null;
  navigationItemId?: string | null;
  assetNeedCount?: number;
  status?: "briefing" | "planned" | "preparing_assets" | "queued" | "building" | "ready" | "failed";
}

export interface GenerationJournalMetadata {
  version: 1;
  generationRunId: string;
  status: "queued" | "planning" | "building" | "completed" | "failed";
  title: string;
  detail?: string | null;
  activePhase?: string | null;
  phases: Array<{
    id: string;
    label: string;
    status: "pending" | "active" | "completed" | "failed";
    detail?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  }>;
  screens?: GenerationJournalScreen[];
  assetSummary?: {
    requested: number;
    resolved: number;
    placeholders: number;
    failures?: number;
  } | null;
}

export interface GenerationPreviewScreen {
  stableKey: string;
  roadmapItemId?: string | null;
  name: string;
  type: ScreenPlan["type"];
  index: number;
}

export interface GenerationPreviewMetadata {
  version: 1;
  stage: "screen_briefs" | "asset_resolution" | "building";
  screens: GenerationPreviewScreen[];
  updatedAt: string;
}

export type UiFlowPlanningProgress = {
  type: "blueprint_ready";
  screens: GenerationPreviewScreen[];
};

export type PlanningMode = "project" | "single-screen";

export type ScreenBlockKind =
  | "shell"
  | "header"
  | "hero"
  | "nav"
  | "section"
  | "form"
  | "list"
  | "grid"
  | "stats"
  | "chart"
  | "profile"
  | "settings"
  | "modal"
  | "footer";

export interface ScreenBlock {
  id: string;
  name: string;
  kind: ScreenBlockKind;
  tagName: string;
  depth: number;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  parentId?: string | null;
  preview: string;
  keywords: string[];
}

export interface ScreenBlockIndex {
  version: 1;
  rootId: string | null;
  blocks: ScreenBlock[];
}

export interface ProjectData {
  id: string;
  ownerId?: string;
  userId: string;
  name: string;
  prompt: string;
  status: ProjectStatus;
  charter?: ProjectCharter | null;
  designTokens?: DesignTokens | null;
  publicPreviewToken?: string | null;
  publicPreviewEnabled?: boolean;
  publicPreviewCreatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenData {
  id: string;
  projectId: string;
  ownerId?: string;
  userId: string;
  generationRunId?: string | null;
  name: string;
  code: string;
  sourceLoaded?: boolean;
  prompt: string;
  summary?: string | null;
  blockIndex?: ScreenBlockIndex | null;
  qualityDiagnostics?: ScreenQualityDiagnosticsV1 | null;
  chromePolicy?: ScreenChromePolicy | null;
  navigationItemId?: string | null;
  parentScreenId?: string | null;
  stateKey?: string | null;
  stateLabel?: string | null;
  stateRole?: string | null;
  roadmapItemId?: string | null;
  x: number;
  y: number;
  sortIndex?: number;
  status?: ScreenStatus;
  error?: string | null;
  triggerRunId?: string | null;
  streamPublicToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNavigationData {
  id: string;
  projectId: string;
  ownerId: string;
  plan: NavigationPlan;
  shellCode: string;
  blockIndex?: ScreenBlockIndex | null;
  status: ScreenStatus;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationRunData {
  id: string;
  projectId: string;
  ownerId: string;
  prompt: string;
  imagePath?: string | null;
  requestedScreenCount?: number | null;
  status: GenerationStatus;
  triggerRunId?: string | null;
  requiresBottomNav?: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  error?: string | null;
  metadata?: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  clientRequestId?: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
}

export type ProjectMessageType =
  | 'chat'
  | 'edit_applied'
  | 'screen_created'
  | 'generation_started'
  | 'generation_completed'
  | 'error';

export interface ProjectMessage {
  id: string;
  projectId: string;
  ownerId: string;
  screenId: string | null;
  role: 'user' | 'model' | 'system';
  content: string;
  messageType: ProjectMessageType;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/** Pass this to any service function to get Trigger.dev-visible LLM input + token usage logs. */
export type LlmLogFn = (label: string, data: Record<string, unknown>) => void;

export type LlmProviderEvent = {
  event: string;
  level?: "info" | "warn" | "error";
  [key: string]: unknown;
};

export interface LlmInputSnapshot {
  screenName: string;
  model: string;
  systemInstruction: string;
  userParts: string[];
  hasImage: boolean;
  referenceImageRole?: ReferenceImageRole | null;
  referenceAttachmentReason?: string | null;
  calibrationContractVersion?: number | null;
  promptMode: GenerationPromptMode;
  referenceMode?: ReferenceMode;
  referenceSource?: ReferenceSource | null;
  referenceId?: string | null;
  referenceScreenIndex?: number | null;
  referenceScreenCount?: number | null;
}

export interface BuildScreenInput {
  screenPlan: ScreenPlan;
  designTokens?: DesignTokens | null;
  prompt: string;
  image?: PromptImagePayload | null;
  referenceImageRole?: ReferenceImageRole | null;
  referenceAttachmentReason?: string | null;
  promptMode: GenerationPromptMode;
  referenceMode?: ReferenceMode;
  referenceSource?: ReferenceSource | null;
  referenceId?: string | null;
  referenceScreenIndex?: number | null;
  referenceScreenCount?: number | null;
  designStyle?: DesignStylePack | null;
  requiresBottomNav: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  assetRequirements?: AssetRequirement[];
  assetManifest?: ScreenAssetManifest[];
  productContract?: BuilderProjectContractV1 | null;
  projectContext?: string | null;
  onResponseChunk?: (chunk: unknown) => void;
  onProviderEvent?: (event: LlmProviderEvent) => void;
  onLlmInput?: (snapshot: LlmInputSnapshot) => void;
}
