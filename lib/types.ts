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
  title_large?: DesignTypographyScale;
  title_main?: DesignTypographyScale;
  body_primary?: DesignTypographyScale;
  body_secondary?: DesignTypographyScale;
  caption?: DesignTypographyScale;
  button_label?: DesignTypographyScale;
  [key: string]: JsonValue | undefined;
}

export interface DesignTokenValues {
  color?: DesignColorTokens;
  typography?: DesignTypographyTokens;
  spacing?: Record<string, string>;
  mobile_layout?: Record<string, string>;
  sizing?: Record<string, string>;
  radii?: Record<string, string>;
  border_widths?: Record<string, string>;
  shadows?: Record<string, string>;
  elevation?: Record<string, string>;
  opacities?: Record<string, string>;
  z_index?: Record<string, string>;
  [key: string]: JsonValue | undefined;
}

export interface DesignTokenRationale {
  color?: string;
  typography?: string;
  spacing?: string;
  radii?: string;
  shadows?: string;
  surfaces?: string;
  [key: string]: JsonValue | undefined;
}

export interface DesignTokenMetadata {
  recommendedFonts?: string[];
  rationale?: DesignTokenRationale;
  [key: string]: JsonValue | undefined;
}

export interface DesignTokens {
  system_schema?: string;
  tokens?: DesignTokenValues;
  meta?: DesignTokenMetadata;
  [key: string]: JsonValue | undefined;
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

export interface ProjectCharter {
  originalPrompt: string;
  imageReferenceSummary?: string | null;
  appType: string;
  targetAudience: string;
  navigationModel: string;
  keyFeatures: string[];
  designRationale: string;
  creativeDirection?: CreativeDirection | null;
}

export interface ScreenPlan {
  name: string;
  type: 'root' | 'detail';
  description: string;
}

export interface PlannedUiFlow {
  requiresBottomNav: boolean;
  screens: ScreenPlan[];
  charter: ProjectCharter;
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

export interface BuildScreenInput {
  screenPlan: ScreenPlan;
  designTokens?: DesignTokens | null;
  prompt: string;
  image?: PromptImagePayload | null;
  requiresBottomNav: boolean;
  projectContext?: string | null;
}
