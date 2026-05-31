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

export type VisualAssetPriority = "critical" | "supporting" | "optional";

export type VisualAssetRequirementOrigin =
  | "reference_visible"
  | "user_explicit"
  | "planner_inferred"
  | "heuristic_inferred";

export type VisualAssetSource = "user_upload" | "internal_library" | "stock" | "ai_generated" | "placeholder";

export type VisualAssetProvider =
  | "user"
  | "drawgle_r2"
  | "pexels"
  | "pixabay"
  | "placeholder"
  | "fal-ai/gpt-image-1.5"
  | "fal-ai/gpt-image-1-mini";

export type VisualAssetGenerationStatus =
  | "queued"
  | "submitted"
  | "processing"
  | "completed"
  | "failed";

export type VisualAssetVisibility = "public_reusable" | "owner_private" | "project_private";

export type VisualAssetVerificationStatus = "pending" | "verified" | "rejected" | "skipped";

export type VisualAssetVariantName = "original" | "thumb_256" | "preview_512" | "display_1024";

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
  assetType: VisualAssetType;
  hasAlpha: boolean;
  sourcePreference: VisualAssetSourcePreference;
  exactMatchCount: number;
  vectorMatchCount: number;
  tagFallbackMatchCount: number;
  selectedAssetId?: string | null;
  selectedVia?: "exact" | "vector" | "tag_fallback" | null;
  rejectedCandidates: Array<{
    assetId: string;
    subject: string | null;
    source: string | null;
    visibility: string | null;
    verificationStatus: string | null;
    assetType: string | null;
    hasAlpha: boolean | null;
    qualityScore: number | null;
    similarity?: number | null;
    reason: string;
  }>;
}

export type ImageReferenceMode = "recreate" | "style";

export type ReferenceSource = "user_upload" | "curated";

export type ReferenceMode = "user_recreate" | "user_style" | "curated_style" | "internal_style";

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
  [key: string]: JsonValue | undefined;
}

export interface DesignTypographyScale {
  size?: string;
  weight?: string | number;
  line_height?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignTypographyTokens {
  font_family?: string;
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
  elevation?: Record<string, string>;
  opacities?: Record<string, string>;
  z_index?: Record<string, string>;
  [key: string]: JsonValue | undefined;
}

export interface DesignTokenMetadata {
  recommendedFonts?: string[];
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
  id: DesignStyleId;
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
  id: DesignStyleId;
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

export interface NavigationPlanItem {
  id: string;
  label: string;
  icon: string;
  role: string;
  linkedScreenName: string;
}

export interface NavigationPlanScreenChrome {
  screenName: string;
  chrome: ScreenChromeKind;
  navigationItemId?: string | null;
}

export interface NavigationPlan {
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
  planningDiagnostics?: ProjectCharterPlanningDiagnostics | null;
  charterSource?: "planner" | "partial_planner" | "reference_fallback";
}

export interface ScreenPlan {
  name: string;
  type: 'root' | 'detail';
  description: string;
  chromePolicy?: ScreenChromePolicy | null;
  navigationItemId?: string | null;
  assetNeeds?: AssetRequirement[];
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
  screenCountContract?: ScreenCountContract;
  screenCountEnforcement?: ScreenCountEnforcement;
  intentContract?: GenerationIntentContract;
  screenFamilyContract?: ScreenFamilyContract;
}

export interface GenerationJournalScreen {
  name: string;
  type?: ScreenPlan["type"] | null;
  description?: string | null;
  chrome?: ScreenChromeKind | null;
  navigationItemId?: string | null;
  assetNeedCount?: number;
  status?: "planned" | "queued" | "building" | "ready" | "failed";
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
  }>;
  screens?: GenerationJournalScreen[];
  assetSummary?: {
    requested: number;
    resolved: number;
    placeholders: number;
  } | null;
}

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
  prompt: string;
  summary?: string | null;
  blockIndex?: ScreenBlockIndex | null;
  chromePolicy?: ScreenChromePolicy | null;
  navigationItemId?: string | null;
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

export interface LlmInputSnapshot {
  screenName: string;
  model: string;
  systemInstruction: string;
  userParts: string[];
  hasImage: boolean;
  referenceMode?: ReferenceMode;
  referenceSource?: ReferenceSource | null;
  referenceId?: string | null;
}

export interface BuildScreenInput {
  screenPlan: ScreenPlan;
  designTokens?: DesignTokens | null;
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode;
  referenceSource?: ReferenceSource | null;
  referenceId?: string | null;
  designStyle?: DesignStylePack | null;
  requiresBottomNav: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  assetManifest?: ScreenAssetManifest[];
  projectContext?: string | null;
  onResponseChunk?: (chunk: unknown) => void;
  onLlmInput?: (snapshot: LlmInputSnapshot) => void;
}
